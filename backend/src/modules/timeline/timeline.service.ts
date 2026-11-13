import { prisma } from "../../db/prisma";
import type { AppTarget } from "../../config/apps";
import { renderFetch, resolveServiceIds } from "../actions/render";
import { detectRestarts } from "../runtime/runtime.service";
import type { RenderEvent } from "../renderEvents/renderEvents.service";

// Chronologie des incidents d'une appli (v0.31.0) : alertes, arrêts et déploiements Render,
// redémarrages détectés en direct, sur une seule frise triée par date.
export type TimelineKind = "alert" | "render-failed" | "render-recovered" | "deploy" | "deploy-failed" | "restart" | "render-other";
export type TimelineLevel = "critical" | "warning" | "ok" | "info";

export interface TimelineItem {
  at: number;
  kind: TimelineKind;
  level: TimelineLevel;
  title: string;
  detail?: string;
}

/** Événement Render converti en ligne de chronologie, ou null s'il est sans intérêt (fonction pure, testée). */
export function renderEventItem(e: RenderEvent["event"] & { details?: Record<string, unknown> }): TimelineItem | null {
  const at = new Date(e.timestamp).getTime();
  const d = (e.details ?? {}) as Record<string, unknown>;
  switch (e.type) {
    case "server_failed": {
      const reason = (d.reason ?? {}) as { oomKilled?: { memoryLimit?: string } | boolean };
      const memory = Boolean(reason.oomKilled);
      return { at, kind: "render-failed", level: "critical", title: memory ? "Service arrêté par Render : mémoire saturée" : "Service arrêté par Render", detail: memory && typeof reason.oomKilled === "object" && reason.oomKilled?.memoryLimit ? `Limite ${reason.oomKilled.memoryLimit}` : undefined };
    }
    case "server_available":
      return { at, kind: "render-recovered", level: "ok", title: "Service de nouveau disponible" };
    case "deploy_started":
      return { at, kind: "deploy", level: "info", title: "Déploiement lancé" };
    case "deploy_ended": {
      const ok = d.deployStatus === "succeeded" || d.status === 2;
      return ok ? { at, kind: "deploy", level: "ok", title: "Déploiement terminé" } : { at, kind: "deploy-failed", level: "critical", title: "Déploiement en échec", detail: String(d.deployStatus ?? "") || undefined };
    }
    case "build_ended": {
      const ok = d.buildStatus === "succeeded" || d.status === 2;
      return ok ? null : { at, kind: "deploy-failed", level: "critical", title: "Construction en échec", detail: String(d.buildStatus ?? "") || undefined };
    }
    default:
      return /suspend|resume|maintenance/i.test(e.type) ? { at, kind: "render-other", level: "info", title: e.type.replace(/_/g, " ") } : null;
  }
}

export function mergeTimeline(...lists: TimelineItem[][]): TimelineItem[] {
  return lists.flat().sort((a, b) => b.at - a.at);
}

/** Disponibilité en % sur la période : vérifications réussies / vérifications faites (null si aucune). */
export function availability(ok: number, total: number): number | null {
  return total > 0 ? Math.round((ok / total) * 10000) / 100 : null;
}

export async function getTimeline(app: AppTarget, hours: number) {
  const since = new Date(Date.now() - hours * 3600_000);
  const [alerts, runtime, okCount, totalCount, ids] = await Promise.all([
    prisma.alert.findMany({ where: { appKey: app.key, openedAt: { gte: since } }, orderBy: { openedAt: "desc" }, take: 200 }),
    prisma.runtimeSample.findMany({ where: { appKey: app.key, at: { gte: since } }, orderBy: { at: "asc" }, select: { at: true, ok: true, startedAt: true, rssMb: true } }),
    prisma.checkResult.count({ where: { appKey: app.key, at: { gte: since }, ok: true } }),
    prisma.checkResult.count({ where: { appKey: app.key, at: { gte: since } } }),
    resolveServiceIds(app).catch(() => [] as string[]),
  ]);
  const alertItems: TimelineItem[] = alerts.map((a) => ({
    at: a.openedAt.getTime(),
    kind: "alert",
    level: a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info",
    title: a.title,
    detail: `${a.status === "resolved" ? "Résolue" : a.status === "acknowledged" ? "Prise en compte" : "Ouverte"}${a.count > 1 ? ` · ${a.count} occurrences` : ""}`,
  }));
  const restartItems: TimelineItem[] = detectRestarts(runtime).map((r) => ({
    at: r.at.getTime(),
    kind: "restart",
    level: r.kind === "memory" ? "critical" : "warning",
    title: r.kind === "memory" ? "Redémarrage après saturation de la mémoire" : "Redémarrage du service",
    detail: r.lastRssMb !== null ? `Dernière mémoire vue : ${r.lastRssMb} Mo` : undefined,
  }));
  const renderItems: TimelineItem[] = [];
  for (const id of ids) {
    const events = await renderFetch<RenderEvent[]>(`/services/${id}/events?limit=100`).catch(() => [] as RenderEvent[]);
    for (const e of events) {
      if (new Date(e.event.timestamp) < since) continue;
      const item = renderEventItem(e.event);
      if (item) renderItems.push(item);
    }
  }
  return { hours, availability: availability(okCount, totalCount), checks: totalCount, items: mergeTimeline(alertItems, restartItems, renderItems) };
}
