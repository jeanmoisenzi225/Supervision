import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

const BASE = "https://api.render.com/v1";

async function renderFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!env.renderApiKey) throw new HttpError(400, "Clé API Render non configurée (RENDER_API_KEY)");
  const res = await fetch(`${BASE}${path}`, {
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
