import type { CheckTarget } from "../../config/apps";

export interface CheckOutcome {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

const HEALTHY_STATUSES = new Set(["ok", "healthy", "up", "pass"]);

/** Interprète la réponse d'une adresse surveillée (fonction pure, testée). */
export function interpretResponse(target: CheckTarget, statusCode: number, body: string): string | null {
  if (statusCode < 200 || statusCode >= 300) return `Réponse HTTP ${statusCode}`;
  if (target.expect !== "health") return null;
  try {
    const json = JSON.parse(body) as { status?: unknown };
    if (typeof json.status === "string" && !HEALTHY_STATUSES.has(json.status.toLowerCase())) {
      return `État signalé : ${json.status}`;
    }
  } catch {
    // Une réponse 2xx non JSON reste acceptée.
  }
  return null;
}

export async function runCheck(target: CheckTarget, fetchImpl: typeof fetch = fetch): Promise<CheckOutcome> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs);
  try {
    const res = await fetchImpl(target.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Supervision/1.0 (+surveillance de disponibilite)" },
    });
    const body = (await res.text()).slice(0, 2000);
    const error = interpretResponse(target, res.status, body);
    return { ok: error === null, statusCode: res.status, latencyMs: Date.now() - started, error };
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return {
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      error: aborted ? `Pas de réponse en ${Math.round(target.timeoutMs / 1000)} s` : `Injoignable : ${(err as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type Transition = "open" | "resolve" | "none";

/**
 * Décide quoi faire de l'alerte « en panne » d'une adresse après une
 * vérification. `previousFailures` vaut undefined au premier passage après
 * un démarrage : une éventuelle alerte restée ouverte est alors refermée si
 * l'adresse répond.
 */
export function nextTransition(
  previousFailures: number | undefined,
  ok: boolean,
  threshold: number
): { failures: number; transition: Transition } {
  if (ok) {
    const wasDown = previousFailures === undefined || previousFailures >= threshold;
    return { failures: 0, transition: wasDown ? "resolve" : "none" };
  }
  const failures = (previousFailures ?? 0) + 1;
  return { failures, transition: failures === threshold ? "open" : "none" };
}
