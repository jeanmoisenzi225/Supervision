import { apps } from "../../config/apps";
import { env } from "../../config/env";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";
import { renderFetch, resolveServiceIds } from "../actions/render";
import { isPaused } from "../pause/pause.service";

// Arrêts du service constatés par Render (événements « server_failed », v0.26.0).
// Render les publie 15 à 30 minutes après l'arrêt réel : l'alerte vient donc après coup,
// mais elle rend visibles les boucles de redémarrage (ex. « mémoire saturée », 13/11).
export interface RenderEvent {
  event: { id: string; type: string; timestamp: string; details?: { instanceID?: string; reason?: { evicted?: boolean; oomKilled?: { memoryLimit?: string } | boolean } } };
}

export interface ServiceFailure {
  id: string;
  at: Date;
  kind: "memory" | "other";
  memoryLimit: string | null;
}

/** Arrêts du service plus récents que `since`, du plus ancien au plus récent (fonction pure, testée). */
export function failuresSince(events: RenderEvent[], since: Date): ServiceFailure[] {
  return events
    .filter((e) => e.event.type === "server_failed" && new Date(e.event.timestamp) > since)
    .map((e) => {
      const oom = e.event.details?.reason?.oomKilled;
      return {
        id: e.event.id,
        at: new Date(e.event.timestamp),
        kind: oom ? ("memory" as const) : ("other" as const),
        memoryLimit: oom && typeof oom === "object" ? (oom.memoryLimit ?? null) : null,
      };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
/** Au-delà de ce délai sans nouvel arrêt, l'alerte est refermée. */
export const QUIET_MS = 2 * 3600_000;

const lastSeen = new Map<string, Date>();
const lastFailure = new Map<string, Date>();

export async function watchRenderEvents(now = new Date()): Promise<void> {
  if (!env.renderApiKey) return;
  for (const app of apps) {
    if (await isPaused(app.key)) continue;
    let ids: string[];
    try {
      ids = await resolveServiceIds(app);
    } catch {
      continue;
    }
    for (const id of ids) {
      const events = await renderFetch<RenderEvent[]>(`/services/${id}/events?limit=30`);
      // Premier passage : seulement la dernière heure (pas de vieux incidents à chaque démarrage).
      const since = lastSeen.get(id) ?? new Date(now.getTime() - 3600_000);
      const failures = failuresSince(events, since);
      for (const f of failures) {
        lastSeen.set(id, f.at);
        lastFailure.set(id, f.at);
        await raiseAlert({
          appKey: app.key,
          kind: "app",
          severity: "warning",
          title: f.kind === "memory" ? `${app.name} — service arrêté : mémoire saturée` : `${app.name} — service arrêté par la plateforme`,
          detail:
            f.kind === "memory"
              ? `Render a arrêté le service le ${fmt(f.at)} UTC : mémoire dépassée${f.memoryLimit ? ` (limite ${f.memoryLimit})` : ""}. Les traitements en cours (imports…) sont interrompus. Le compteur compte chaque arrêt.`
              : `Render a signalé un arrêt du service le ${fmt(f.at)} UTC.`,
          fingerprint: `render-failed:${id}`,
        });
      }
      if (!failures.length) lastSeen.set(id, lastSeen.get(id) ?? since);
      const last = lastFailure.get(id);
      if (last && now.getTime() - last.getTime() > QUIET_MS) {
        lastFailure.delete(id);
        await resolveAlert(app.key, `render-failed:${id}`, `${app.name} — plus d'arrêt du service depuis 2 h`);
      }
    }
  }
}

export function startRenderEventWatcher(): void {
  if (!env.monitorEnabled) return;
  setTimeout(() => void watchRenderEvents().catch((e) => console.error("[render]", (e as Error).message)), 20_000);
  setInterval(() => void watchRenderEvents().catch((e) => console.error("[render]", (e as Error).message)), 10 * 60_000);
}
