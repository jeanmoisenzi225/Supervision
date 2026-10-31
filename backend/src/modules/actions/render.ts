import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";


async function renderFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
