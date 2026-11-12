import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";


export async function renderFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.renderApiKey) throw new HttpError(400, "Clé API Render non configurée (RENDER_API_KEY)");
  const res = await fetch(`${env.renderApiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${env.renderApiKey}`, ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(502, `Render a répondu ${res.status} : ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

interface RenderService {
  id: string;
  name: string;
  type: string;
  suspended: string;
  dashboardUrl?: string;
  serviceDetails?: { url?: string };
}

interface RenderDeploy {
  id: string;
  status: string;
  createdAt: string;
  finishedAt?: string;
  commit?: { id?: string; message?: string };
}

interface ServiceSummary {
  id: string;
  name: string;
  url: string | null;
}

let cache: { at: number; services: ServiceSummary[] } | null = null;

/** Tous les services du compte Render (gardés 10 minutes en mémoire). */
export async function listServices(): Promise<ServiceSummary[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.services;
  const services: ServiceSummary[] = [];
  let cursor = "";
  for (let page = 0; page < 10; page++) {
    const rows = await renderFetch<{ service: RenderService; cursor: string }[]>(`/services?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    services.push(...rows.map(({ service }) => ({ id: service.id, name: service.name, url: service.serviceDetails?.url ?? null })));
    if (rows.length < 100) break;
    cursor = rows[rows.length - 1].cursor;
  }
  cache = { at: Date.now(), services };
  return services;
}

/** Services Render d'une appli : par nom, ou par adresse surveillée (fonction pure, testée). */
export function matchServices(
  match: { names: RegExp[]; hosts: string[] },
  services: ServiceSummary[]
): ServiceSummary[] {
  return services.filter((s) => {
    if (match.names.some((re) => re.test(s.name))) return true;
    try {
      return s.url !== null && match.hosts.includes(new URL(s.url).hostname);
    } catch {
      return false;
    }
  });
}

/** Identifiants à utiliser : ceux imposés par la configuration, sinon ceux reconnus automatiquement. */
export async function resolveServiceIds(app: { renderServiceIds: string[]; renderMatch: { names: RegExp[]; hosts: string[] } }): Promise<string[]> {
  if (app.renderServiceIds.length) return app.renderServiceIds;
  if (!env.renderApiKey) return [];
  return matchServices(app.renderMatch, await listServices()).map((s) => s.id);
}

export async function describeService(id: string) {
  const [service, deploys] = await Promise.all([
    renderFetch<RenderService>(`/services/${id}`),
    renderFetch<{ deploy: RenderDeploy }[]>(`/services/${id}/deploys?limit=3`),
  ]);
  return {
    id: service.id,
    name: service.name,
    type: service.type,
    suspended: service.suspended !== "not_suspended",
    url: service.serviceDetails?.url ?? null,
    dashboardUrl: service.dashboardUrl ?? null,
    deploys: deploys.map(({ deploy }) => ({
      id: deploy.id,
      status: deploy.status,
      createdAt: deploy.createdAt,
      finishedAt: deploy.finishedAt ?? null,
      commit: deploy.commit?.message?.split("\n")[0] ?? null,
    })),
  };
}

export async function restartService(id: string): Promise<void> {
  await renderFetch(`/services/${id}/restart`, { method: "POST" });
}

export async function deployService(id: string, clearCache: boolean): Promise<void> {
  await renderFetch(`/services/${id}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache: clearCache ? "clear" : "do_not_clear" }),
  });
}

/** Met le service hors ligne (Render le suspend : plus de trafic, plus de facturation de l'instance). */
export async function suspendService(id: string): Promise<void> {
  await renderFetch(`/services/${id}/suspend`, { method: "POST" });
}

/** Remet en ligne un service suspendu. */
export async function resumeService(id: string): Promise<void> {
  await renderFetch(`/services/${id}/resume`, { method: "POST" });
}

/* ---------- Bases de données et mesures (graphiques de ressources) ---------- */

export interface PostgresSummary {
  id: string;
  name: string;
  databaseName: string | null;
  plan: string;
  status: string;
  suspended: boolean;
  diskSizeGB: number | null;
  expiresAt: string | null;
  dashboardUrl: string | null;
}

let pgCache: { at: number; list: PostgresSummary[] } | null = null;

/** Bases PostgreSQL du compte Render (gardées 10 minutes en mémoire ; `fresh` relit Render sans attendre). */
export async function listPostgres(fresh = false): Promise<PostgresSummary[]> {
  if (!fresh && pgCache && Date.now() - pgCache.at < 10 * 60_000) return pgCache.list;
  const rows = await renderFetch<({ postgres: Record<string, unknown> } | Record<string, unknown>)[]>("/postgres?limit=100");
  const list = rows.map((row) => {
    const p = ("postgres" in row ? row.postgres : row) as Record<string, unknown>;
    return {
      id: String(p.id),
      name: String(p.name),
      databaseName: typeof p.databaseName === "string" ? p.databaseName : null,
      plan: String(p.plan ?? ""),
      status: String(p.status ?? ""),
      suspended: p.suspended === "suspended",
      diskSizeGB: typeof p.diskSizeGB === "number" ? p.diskSizeGB : null,
      expiresAt: typeof p.expiresAt === "string" ? p.expiresAt : null,
      dashboardUrl: typeof p.dashboardUrl === "string" ? p.dashboardUrl : null,
    };
  });
  pgCache = { at: Date.now(), list };
  return list;
}

/** Bases d'une appli : reconnues par leur nom (fonction pure, testée). */
export function matchPostgres(names: RegExp[], list: PostgresSummary[]): PostgresSummary[] {
  return list.filter((p) => names.some((re) => re.test(p.name)));
}

export interface MetricSeries {
  labels: Record<string, string>;
  unit: string;
  points: [number, number][];
}

/** Une mesure Render (`/metrics/<name>`) sur une période, pour un service ou une base. */
export async function fetchMetric(
  name: string,
  resource: string,
  startTime: Date,
  resolutionSeconds: number,
  extra: Record<string, string> = {}
): Promise<MetricSeries[]> {
  const params = new URLSearchParams({ resource, startTime: startTime.toISOString(), endTime: new Date().toISOString(), resolutionSeconds: String(resolutionSeconds), ...extra });
  const rows = await renderFetch<{ labels?: { field: string; value: string }[]; values?: { timestamp: string; value: number }[]; unit?: string }[]>(
    `/metrics/${name}?${params.toString()}`
  );
  return (rows ?? []).map((r) => ({
    labels: Object.fromEntries((r.labels ?? []).map((l) => [l.field, l.value])),
    unit: r.unit ?? "",
    points: (r.values ?? []).map((v) => [new Date(v.timestamp).getTime(), Number(v.value)] as [number, number]).sort((a, b) => a[0] - b[0]),
  }));
}

export interface PostgresSizes {
  databaseBytes: number | null;
  tables: { name: string; bytes: number }[];
}

/**
 * Tailles d'une base et de ses tables, à l'instant (route autorisée sur toutes
 * les offres, contrairement aux mesures `disk-usage`). Fonction de lecture pure
 * séparée (`parseSizes`) pour les tests.
 */
export async function fetchPostgresSizes(id: string, databaseName: string | null): Promise<PostgresSizes> {
  const res = await renderFetch<{ sizes?: { Database?: string; Schema?: string; Table?: string; Index?: string; Bytes?: number }[] }>(`/postgres/${id}/query/sizes`);
  return parseSizes(res.sizes ?? [], databaseName);
}

export function parseSizes(
  sizes: { Database?: string; Schema?: string; Table?: string; Index?: string; Bytes?: number }[],
  databaseName: string | null
): PostgresSizes {
  const dbRows = sizes.filter((r) => r.Database && !r.Table && !r.Index && typeof r.Bytes === "number");
  const main = (databaseName && dbRows.find((r) => r.Database === databaseName)) || dbRows.sort((a, b) => (b.Bytes ?? 0) - (a.Bytes ?? 0))[0];
  const tables = sizes
    .filter((r) => r.Table && !r.Index && typeof r.Bytes === "number")
    .map((r) => ({ name: r.Schema && r.Schema !== "public" ? `${r.Schema}.${r.Table}` : String(r.Table), bytes: r.Bytes! }))
    .sort((a, b) => b.bytes - a.bytes);
  // Render ne renvoie plus toujours la ligne « base entière » (constaté le 2026-11-12) : on additionne
  // alors les tables de la base (chaque ligne de table compte déjà ses index et ses données hors ligne).
  const dbName = main?.Database ?? databaseName ?? sizes.find((r) => r.Table)?.Database;
  const ownTables = sizes.filter((r) => r.Table && !r.Index && typeof r.Bytes === "number" && (!dbName || r.Database === dbName));
  const summed = ownTables.length ? ownTables.reduce((t, r) => t + (r.Bytes ?? 0), 0) : null;
  return { databaseBytes: main?.Bytes ?? summed, tables };
}
