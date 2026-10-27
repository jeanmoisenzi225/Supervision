const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "http://localhost:4100";
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
    message: string
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
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "Serveur de supervision injoignable");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/auth/login") {
    setToken(null);
    window.dispatchEvent(new Event("supervision:logout"));
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erreur ${res.status}`);
  return data as T;
}

export type AppStatus = "ok" | "degraded" | "down" | "unknown" | "not_deployed";

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
