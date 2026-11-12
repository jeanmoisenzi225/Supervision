import { apps, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { describeService, fetchMetric, fetchPostgresSizes, listPostgres, matchPostgres, resolveServiceIds, type MetricSeries } from "../actions/render";
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
  /** true : courbe construite à partir des relevés de la Supervision (Render ne la fournit pas sur l'offre Hobby). */
  diskFromSamples: boolean;
  tables: { name: string; bytes: number }[];
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

/** Message d'erreur Render lisible (mesure réservée aux offres supérieures à Hobby). */
export function readableMetricError(label: string, message: string): string {
  if (/\b429\b|rate limit/i.test(message)) return `${label} (Render limite le nombre de demandes : réessayer dans une minute)`;
  if (/not allowed for plan/i.test(message)) {
    const plan = /plan:\s*([A-Za-z]+)/.exec(message)?.[1] ?? "actuelle";
    return `${label} (réservé aux offres Render supérieures à ${plan})`;
  }
  return `${label} : ${message}`;
}

/** Dernière valeur obtenue de Render pour chaque mesure : reprise si Render limite les demandes (429). */
const lastGood = new Map<string, unknown>();

async function safe<T>(errors: string[], label: string, memo: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const data = await load();
    lastGood.set(memo, data);
    return data;
  } catch (err) {
    const message = (err as Error).message;
    // Limite de Render atteinte : on garde la dernière valeur connue plutôt qu'un trou.
    if (/\b429\b|rate limit/i.test(message) && lastGood.has(memo)) return lastGood.get(memo) as T;
    errors.push(readableMetricError(label, message));
    return fallback;
  }
}

const sampleKey = (dbId: string) => `dbsize:${dbId}`;

/** Historique des tailles relevées par la Supervision. */
async function sampledPoints(key: string, start: Date): Promise<Points> {
  const rows = await prisma.resourceSample.findMany({ where: { key, at: { gte: start } }, orderBy: { at: "asc" }, select: { at: true, value: true } });
  return rows.map((r) => [r.at.getTime(), r.value] as [number, number]);
}

const bytes = (series: MetricSeries[]): Points =>
  sumSeries(series.map((s) => s.points.map(([t, v]) => [t, toBytes(v, s.unit)] as [number, number])));

async function serviceResources(id: string, start: Date, resolution: number): Promise<ServiceResources | null> {
  const s = await describeService(id);
  // Un site statique n'a ni mémoire ni processeur à surveiller.
  if (s.type === "static_site") return null;
  const errors: string[] = [];
  const [memory, memoryLimit, cpu, cpuLimit, requests, latency, disk, diskCapacity] = await Promise.all([
    safe(errors, "mémoire", `memory:${id}:${resolution}`, () => fetchMetric("memory", id, start, resolution, { aggregationMethod: "MAX" }), []),
    safe(errors, "limite mémoire", `memory-limit:${id}:${resolution}`, () => fetchMetric("memory-limit", id, start, resolution), []),
    safe(errors, "processeur", `cpu:${id}:${resolution}`, () => fetchMetric("cpu", id, start, resolution, { aggregationMethod: "MAX" }), []),
    safe(errors, "limite processeur", `cpu-limit:${id}:${resolution}`, () => fetchMetric("cpu-limit", id, start, resolution), []),
    safe(errors, "requêtes", `http-requests:${id}:${resolution}`, () => fetchMetric("http-requests", id, start, resolution, { aggregateBy: "statusCode" }), []),
    safe(errors, "temps de réponse", `http-latency:${id}:${resolution}`, () => fetchMetric("http-latency", id, start, resolution, { quantile: "0.95" }), []),
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
  const [disk, connections, sizes] = await Promise.all([
    safe(errors, "historique du disque", `disk-usage:${db.id}:${resolution}`, () => fetchMetric("disk-usage", db.id, start, resolution), []),
    safe(errors, "connexions", `active-connections:${db.id}:${resolution}`, () => fetchMetric("active-connections", db.id, start, resolution), []),
    safe(errors, "taille de la base", `sizes:${db.id}`, () => fetchPostgresSizes(db.id, db.databaseName), { databaseBytes: null, tables: [] }),
  ]);
  let diskPoints = bytes(disk);
  let diskFromSamples = false;
  if (diskPoints.length === 0 && sizes.databaseBytes !== null) {
    // Offre Hobby : pas d'historique Render, on s'appuie sur nos propres relevés.
    diskPoints = [...(await sampledPoints(sampleKey(db.id), start)), [Date.now(), sizes.databaseBytes]];
    diskFromSamples = true;
  }
  return {
    id: db.id,
    name: db.name,
    plan: db.plan,
    status: db.status,
    diskSizeGB: db.diskSizeGB,
    expiresAt: db.expiresAt,
    daysLeft: daysUntil(db.expiresAt),
    disk: diskPoints,
    diskFromSamples,
    tables: sizes.tables.slice(0, 8),
    connections: sumSeries(connections.map((x) => x.points)),
    errors,
  };
}

/** Temps de réponse mesuré par les vérifications de la Supervision, moyenné par intervalle. */
export function bucketLatency(rows: { at: Date; latencyMs: number | null; ok: boolean }[], resolutionSec: number): Points {
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const r of rows) {
    if (!r.ok || r.latencyMs === null) continue;
    const t = Math.floor(r.at.getTime() / (resolutionSec * 1000)) * resolutionSec * 1000;
    const b = buckets.get(t) ?? { sum: 0, n: 0 };
    b.sum += r.latencyMs;
    b.n += 1;
    buckets.set(t, b);
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, b]) => [t, Math.round(b.sum / b.n)] as [number, number]);
}

async function checkLatency(app: AppTarget, start: Date, resolution: number) {
  const rows = await prisma.checkResult.findMany({
    where: { appKey: app.key, at: { gte: start } },
    select: { checkId: true, at: true, latencyMs: true, ok: true },
    orderBy: { at: "asc" },
  });
  return app.checks.map((c) => ({ id: c.id, label: c.label, points: bucketLatency(rows.filter((r) => r.checkId === c.id), resolution) }));
}

/** Ressources d'une appli sur une période (gardées 2 minutes en mémoire ; `fresh` : actualisation demandée par l'utilisateur, sans attendre). */
export async function getAppResources(app: AppTarget, range: RangeKey, fresh = false) {
  if (!env.renderApiKey) {
    const { hours, resolution } = RANGES[range];
    return { configured: false, services: [], databases: [], checks: await checkLatency(app, new Date(Date.now() - hours * 3600_000), resolution) };
  }
  // Actualisation demandée : relecture, sauf si la dernière date de moins d'une minute (Render limite le nombre de demandes).
  const hit = cache.get(`${app.key}:${range}`);
  if (fresh && hit && Date.now() - hit.at > 60_000) cache.delete(`${app.key}:${range}`);
  return cached(`${app.key}:${range}`, 2 * 60_000, async () => {
    const { hours, resolution } = RANGES[range];
    const start = new Date(Date.now() - hours * 3600_000);
    const [ids, pgs] = await Promise.all([resolveServiceIds(app), listPostgres(fresh).catch(() => [])]);
    const services = (await Promise.all(ids.map((id) => serviceResources(id, start, resolution).catch(() => null)))).filter(
      (s): s is ServiceResources => s !== null
    );
    const databases = await Promise.all(matchPostgres(app.renderMatch.names, pgs).map((db) => databaseResources(db, start, resolution)));
    return { configured: true, services, databases, checks: await checkLatency(app, start, resolution) };
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
    // Relevé de la taille (historique maison), au plus un par heure.
    if (used !== null && db.diskFromSamples) {
      const recent = await prisma.resourceSample.findFirst({ where: { key: sampleKey(db.id), at: { gte: new Date(Date.now() - 55 * 60_000) } } });
      if (!recent) await prisma.resourceSample.create({ data: { key: sampleKey(db.id), value: used } });
    }
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
