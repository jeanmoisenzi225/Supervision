import { isFreshRequested } from "./refresh";
// Vide en production : l'interface est servie par l'API elle-même (même adresse).
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");
const TOKEN_KEY = "supervision.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : la session dure le temps de l'onglet.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(isFreshRequested() ? { "X-Refresh": "1" } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Serveur de supervision injoignable");
  }
  const data = await res.json().catch(() => ({}));
  // 401 d'une vérification de code (double authentification) : la session
  // reste valable, seul le code est refusé.
  if (res.status === 401 && path !== "/auth/login" && !(data as { totpRequired?: boolean }).totpRequired && !path.startsWith("/auth/2fa")) {
    setToken(null);
    window.dispatchEvent(new Event("supervision:logout"));
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erreur ${res.status}`, data as Record<string, unknown>);
  return data as T;
}


export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Serveur de supervision injoignable");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string; totpRequired?: boolean };
    if (res.status === 401 && path !== "/auth/login" && !data.totpRequired && !path.startsWith("/auth/2fa")) {
      setToken(null);
      window.dispatchEvent(new Event("supervision:logout"));
    }
    throw new ApiError(res.status, data.error ?? `Erreur ${res.status}`, data);
  }
  return res.blob();
}

export type AppStatus = "ok" | "degraded" | "down" | "unknown" | "not_deployed" | "paused";

export interface PauseInfo {
  until: string | null;
  reason: string | null;
  by: string;
  pausedAt: string;
}

export interface CheckSummary {
  id: string;
  label: string;
  url: string;
  last: { ok: boolean; at: string; latencyMs: number | null; statusCode: number | null; error: string | null } | null;
  uptime24h: number | null;
}

export interface AppOverview {
  key: string;
  name: string;
  description: string;
  intervalSec: number;
  sleepsWhenIdle: boolean;
  status: AppStatus;
  pause: PauseInfo | null;
  checks: CheckSummary[];
  openAlerts: number;
  errors24h: number;
  lastLogAt: string | null;
  integration: { logs: boolean; adminActions: boolean; render: boolean };
}

export interface Alert {
  id: string;
  appKey: string;
  kind: "down" | "error" | "app";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string | null;
  status: "open" | "acknowledged" | "resolved";
  count: number;
  openedAt: string;
  lastSeenAt: string;
  ackAt: string | null;
  resolvedAt: string | null;
}

export interface LogEntry {
  id: string;
  appKey: string;
  at: string;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  source: string | null;
  message: string;
  context: Record<string, unknown> | null;
  requestId: string | null;
}
