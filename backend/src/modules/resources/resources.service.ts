import { apps, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { describeService, fetchMetric, listPostgres, matchPostgres, resolveServiceIds, type MetricSeries } from "../actions/render";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";
import { isPaused } from "../pause/pause.service";
import { daysUntil, last, percent, RANGES, sumSeries, toBytes, type RangeKey } from "./units";

type Points = [number, number][];

export interface ServiceResources {
  id: string;
  name: string;
  type: string;
  memory: Points; // octets
  memoryLimit: number | null; // octets
  cpu: Points; // cœurs
  cpuLimit: number | null;
  requests: Points; // requêtes par intervalle
  errors5xx: Points;
  latencyP95: Points; // millisecondes
  /** Disque persistant du service (octets), s'il en a un. */
  disk: Points;
  diskCapacity: number | null;
  errors: string[];
}

export interface DatabaseResources {
  id: string;
  name: string;
  plan: string;
  status: string;
  diskSizeGB: number | null;
  expiresAt: string | null;
  daysLeft: number | null;
  disk: Points; // octets
  connections: Points;
  errors: string[];
}

const cache = new Map<string, { at: number; data: unknown }>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = await load();
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function safe<T>(errors: string[], label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (err) {
    errors.push(`${label} : ${(err as Error).message}`);
    return fallback;
  }
}

const bytes = (series: MetricSeries[]): Points =>
  sumSeries(series.map((s) => s.points.map(([t, v]) => [t, toBytes(v, s.unit)] as [number, number])));

async function serviceResources(id: string, start: Date, resolution: number): Promise<ServiceResources | null> {
  const s = await describeService(id);
  // Un site statique n'a ni mémoire ni processeur à surveiller.
  if (s.type === "static_site") return null;
  const errors: string[] = [];
  const [memory, memoryLimit, cpu, cpuLimit, requests, latency, disk, diskCapacity] = await Promise.all([
    safe(errors, "mémoire", () => fetchMetric("memory", id, start, resolution, { aggregationMethod: "MAX" }), []),
    safe(errors, "limite mémoire", () => fetchMetric("memory-limit", id, start, resolution), []),
    safe(errors, "processeur", () => fetchMetric("cpu", id, start, resolution, { aggregationMethod: "MAX" }), []),
    safe(errors, "limite processeur", () => fetchMetric("cpu-limit", id, start, resolution), []),
    safe(errors, "requêtes", () => fetchMetric("http-requests", id, start, resolution, { aggregateBy: "statusCode" }), []),
    safe(errors, "temps de réponse", () => fetchMetric("http-latency", id, start, resolution, { quantile: "0.95" }), []),
    // Disque persistant : séries vides pour un service sans disque (pas une erreur).
    fetchMetric("disk-usage", id, start, resolution).catch(() => [] as MetricSeries[]),
    fetchMetric("disk-capacity", id, start, resolution).catch(() => [] as MetricSeries[]),
  ]);
  const limitPoints = bytes(memoryLimit);
  return {
    id,
    name: s.name,
    type: s.type,
    memory: bytes(memory),
    memoryLimit: last(limitPoints),
    cpu: sumSeries(cpu.map((x) => x.points)),
    cpuLimit: last(sumSeries(cpuLimit.map((x) => x.points))),
    requests: sumSeries(requests.map((x) => x.points)),
    errors5xx: sumSeries(requests.filter((x) => /^5/.test(x.labels.statusCode ?? "")).map((x) => x.points)),
    latencyP95: sumSeries(latency.map((x) => x.points)),
    disk: bytes(disk),
    diskCapacity: last(bytes(diskCapacity)),
    errors,
  };
}

async function databaseResources(db: Awaited<ReturnType<typeof listPostgres>>[number], start: Date, resolution: number): Promise<DatabaseResources> {
  const errors: string[] = [];
  const [disk, connections] = await Promise.all([
    safe(errors, "disque", () => fetchMetric("disk-usage", db.id, start, resolution), []),
    safe(errors, "connexions", () => fetchMetric("active-connections", db.id, start, resolution), []),
  ]);
  return {
    id: db.id,
    name: db.name,
    plan: db.plan,
    status: db.status,
    diskSizeGB: db.diskSizeGB,
    expiresAt: db.expiresAt,
    daysLeft: daysUntil(db.expiresAt),
    disk: bytes(disk),
    connections: sumSeries(connections.map((x) => x.points)),
    errors,
  };
}

/** Ressources d'une appli sur une période (gardées 2 minutes en mémoire). */
export async function getAppResources(app: AppTarget, range: RangeKey) {
  if (!env.renderApiKey) return { configured: false, services: [], databases: [] };
  return cached(`${app.key}:${range}`, 2 * 60_000, async () => {
    const { hours, resolution } = RANGES[range];
    const start = new Date(Date.now() - hours * 3600_000);
    const [ids, pgs] = await Promise.all([resolveServiceIds(app), listPostgres().catch(() => [])]);
    const services = (await Promise.all(ids.map((id) => serviceResources(id, start, resolution).catch(() => null)))).filter(
      (s): s is ServiceResources => s !== null
    );
    const databases = await Promise.all(matchPostgres(app.renderMatch.names, pgs).map((db) => databaseResources(db, start, resolution)));
    return { configured: true, services, databases };
  });
}

/* ---------- Alertes de ressources ---------- */

export const MEMORY_ALERT = 85;
export const MEMORY_CLEAR = 75;
export const DISK_ALERT = 80;
export const DISK_CLEAR = 70;
export const EXPIRY_WARN_DAYS = 7;

/** Ouvre ou referme les alertes de ressources d'une appli. */
export async function watchApp(app: AppTarget): Promise<void> {
  if (await isPaused(app.key)) return;
  const data = await getAppResources(app, "24h");
  for (const s of data.services) {
    const pct = percent(last(s.memory), s.memoryLimit);
    if (pct === null) continue;
    const fp = `memory:${s.id}`;
    if (pct >= MEMORY_ALERT) {
      await raiseAlert({ appKey: app.key, kind: "app", severity: pct >= 95 ? "critical" : "warning", title: `${app.name} — mémoire à ${pct} % (${s.name})`, detail: `Au-delà de ${MEMORY_ALERT} % de la limite du plan : risque de redémarrage forcé par Render.`, fingerprint: fp });
    } else if (pct < MEMORY_CLEAR) {
      await resolveAlert(app.key, fp, `${app.name} — mémoire revenue à ${pct} % (${s.name})`);
    }
  }
  for (const s of data.services) {
    const pct = percent(last(s.disk), s.diskCapacity);
    if (pct === null) continue;
    const fp = `svcdisk:${s.id}`;
    if (pct >= DISK_ALERT) {
      await raiseAlert({ appKey: app.key, kind: "app", severity: pct >= 95 ? "critical" : "warning", title: `${app.name} — disque de ${s.name} rempli à ${pct} %`, detail: "Disque persistant du service presque plein : l'appli ne pourra plus enregistrer ses données. Agrandir le disque dans Render ou faire du ménage.", fingerprint: fp });
    } else if (pct < DISK_CLEAR) {
      await resolveAlert(app.key, fp, `${app.name} — disque de ${s.name} à ${pct} %`);
    }
  }
  for (const db of data.databases) {
    const used = last(db.disk);
    const pct = db.diskSizeGB ? percent(used, db.diskSizeGB * 1024 ** 3) : null;
    if (pct !== null) {
      const fp = `disk:${db.id}`;
      if (pct >= DISK_ALERT) {
        await raiseAlert({ appKey: app.key, kind: "app", severity: pct >= 95 ? "critical" : "warning", title: `${app.name} — base ${db.name} remplie à ${pct} %`, detail: `${db.diskSizeGB} Go au total : prévoir un agrandissement ou un nettoyage.`, fingerprint: fp });
      } else if (pct < DISK_CLEAR) {
        await resolveAlert(app.key, fp, `${app.name} — base ${db.name} à ${pct} %`);
      }
    }
    if (db.daysLeft !== null && db.daysLeft <= EXPIRY_WARN_DAYS) {
      await raiseAlert({
        appKey: app.key,
        kind: "app",
        severity: db.daysLeft <= 2 ? "critical" : "warning",
        title: `${app.name} — base gratuite ${db.name} : expiration ${db.daysLeft <= 0 ? "atteinte" : `dans ${db.daysLeft} jour(s)`}`,
        detail: `Render supprime une base gratuite après son expiration (délai de grâce de 14 jours). Passer à une offre payante pour garder les données.`,
        fingerprint: `expiry:${db.id}`,
      });
    }
  }
}

export function startResourceWatcher(): void {
  if (!env.monitorEnabled) return;
  const run = async () => {
    if (!env.renderApiKey) return;
    for (const app of apps) await watchApp(app).catch((err) => console.error(`[ressources] ${app.key}`, (err as Error).message));
  };
  setTimeout(() => void run(), 90_000);
  setInterval(() => void run(), 15 * 60_000);
}
