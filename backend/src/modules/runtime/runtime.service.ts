import { apps, type AppTarget } from "../../config/apps";
import { prisma } from "../../db/prisma";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";
import { renderFetch, resolveServiceIds } from "../actions/render";
import type { RenderEvent } from "../renderEvents/renderEvents.service";
import { callApp } from "../actions/actions.routes";
import { isPaused } from "../pause/pause.service";

// État en direct des services (v0.29.0) : la Supervision interroge toutes les 15 secondes le
// rapport signé `runtime` de chaque appli qui le propose (mémoire réelle, date de démarrage, retard
// de la boucle, imports en cours). Un changement de date de démarrage = redémarrage, détecté à la
// seconde près (Render ne le publie que 15 à 30 minutes plus tard) avec la dernière mémoire vue.
export interface RuntimeReport {
  startedAt: string;
  uptimeSec: number;
  rssMb: number;
  heapUsedMb: number;
  externalMb: number;
  loopLagMaxMs: number;
  imports?: { running: number; usedMb?: number; budgetMb?: number };
  jobs?: number | null;
  /** Imports en cours (Procedia v0.62.0) : durée et taille, sans nom de document. */
  runningImports?: { id: string; sinceSec: number; sizeMb: number | null }[];
}

/** Dernier rapport reçu par appli (en mémoire, au plus 15 secondes de retard). */
export const latestReport = new Map<string, { at: number; report: RuntimeReport }>();

export interface Restart {
  at: Date;
  /** Dernière mémoire vue avant le redémarrage (Mo). */
  lastRssMb: number | null;
  kind: "memory" | "other";
}

/** Au-delà de cette mémoire (Mo) juste avant un redémarrage, on parle de saturation (limite 512 Mo). */
export const MEMORY_SUSPECT_MB = 400;

/** Redémarrages vus dans une suite de relevés (fonction pure, testée). */
export function detectRestarts(samples: { at: Date; ok: boolean; startedAt: Date | null; rssMb: number | null }[]): Restart[] {
  const out: Restart[] = [];
  let prev: { startedAt: Date; rssMb: number | null } | null = null;
  for (const s of samples) {
    if (!s.ok || !s.startedAt) continue;
    if (prev && Math.abs(s.startedAt.getTime() - prev.startedAt.getTime()) > 2000) {
      out.push({ at: s.startedAt, lastRssMb: prev.rssMb, kind: prev.rssMb !== null && prev.rssMb >= MEMORY_SUSPECT_MB ? "memory" : "other" });
    }
    prev = { startedAt: s.startedAt, rssMb: s.rssMb };
  }
  return out;
}

/** Un déploiement Render couvre-t-il ce redémarrage ? (lancé dans les 15 min qui précèdent le démarrage, fini au plus 3 min avant) (fonction pure, testée). */
export function deployNear(events: RenderEvent[], startedAt: Date): boolean {
  const t = startedAt.getTime();
  return events.some((e) => {
    if (e.event.type !== "deploy_started") return false;
    const s = new Date(e.event.timestamp).getTime();
    return s <= t + 60_000 && t - s <= 15 * 60_000;
  });
}

async function deployExplains(app: AppTarget, startedAt: Date): Promise<boolean> {
  const ids = await resolveServiceIds(app).catch(() => [] as string[]);
  for (const id of ids) {
    const events = await renderFetch<RenderEvent[]>(`/services/${id}/events?limit=30`).catch(() => [] as RenderEvent[]);
    if (deployNear(events, startedAt)) return true;
  }
  return false;
}

const unsupported = new Map<string, number>();
const lastGood = new Map<string, { startedAt: Date; rssMb: number; at: Date; peakMb: number }>();
const lastRestart = new Map<string, Date>();
const QUIET_MS = 2 * 3600_000;

export async function pollRuntime(app: AppTarget, now = new Date()): Promise<void> {
  if (!app.adminUrl || !app.adminToken || app.sleepsWhenIdle) return;
  if (now.getTime() < (unsupported.get(app.key) ?? 0)) return;
  let report: RuntimeReport;
  try {
    report = await callApp<RuntimeReport>(app, "/supervision/reports/runtime");
  } catch (err) {
    const message = (err as Error).message;
    // L'appli ne propose pas (encore) ce rapport : on réessaie dans une heure, sans bruit.
    if (/répondu 404|Rapport inconnu/i.test(message)) {
      unsupported.set(app.key, now.getTime() + 3600_000);
      return;
    }
    await prisma.runtimeSample.create({ data: { appKey: app.key, at: now, ok: false, error: message.slice(0, 200) } });
    return;
  }
  const startedAt = new Date(report.startedAt);
  latestReport.set(app.key, { at: now.getTime(), report });
  await prisma.runtimeSample.create({
    data: {
      appKey: app.key,
      at: now,
      ok: true,
      startedAt,
      uptimeSec: report.uptimeSec,
      rssMb: report.rssMb,
      heapMb: report.heapUsedMb,
      externalMb: report.externalMb,
      loopLagMaxMs: report.loopLagMaxMs,
      imports: report.imports?.running ?? null,
      jobs: report.jobs ?? null,
    },
  });
  const prev = lastGood.get(app.key);
  if (prev && Math.abs(startedAt.getTime() - prev.startedAt.getTime()) > 2000) {
    const memory = prev.peakMb >= MEMORY_SUSPECT_MB;
    // Redémarrage dû à une mise en ligne (v0.32.1) : information, ni alerte ni notification.
    const deploy = !memory && (await deployExplains(app, startedAt));
    if (!deploy) lastRestart.set(app.key, now);
    await raiseAlert({
      appKey: app.key,
      kind: "app",
      severity: deploy ? "info" : memory ? "critical" : "warning",
      title: deploy ? `${app.name} — redémarrage pour une mise en ligne` : memory ? `${app.name} — redémarrage après saturation de la mémoire` : `${app.name} — redémarrage du service`,
      detail: `Le service a redémarré (démarrage à ${startedAt.toISOString().slice(11, 19)} UTC). Dernière mémoire vue avant l'arrêt : ${prev.rssMb} Mo (pic ${prev.peakMb} Mo sur les derniers relevés, limite 512 Mo). Dernier relevé normal : ${prev.at.toISOString().slice(11, 19)} UTC.`,
      fingerprint: deploy ? `restart-deploy:${app.key}` : `restart:${app.key}`,
    });
    lastGood.set(app.key, { startedAt, rssMb: report.rssMb, at: now, peakMb: report.rssMb });
  } else {
    // Pic mémoire retenu sur la durée de vie de ce processus (jusqu'au prochain redémarrage).
    lastGood.set(app.key, { startedAt, rssMb: report.rssMb, at: now, peakMb: Math.max(prev?.peakMb ?? 0, report.rssMb) });
  }
  await watchTrends(app, report, now).catch((e) => console.error(`[tendance] ${app.key}`, (e as Error).message));
  const lr = lastRestart.get(app.key);
  if (lr && now.getTime() - lr.getTime() > QUIET_MS) {
    lastRestart.delete(app.key);
    await resolveAlert(app.key, `restart:${app.key}`, `${app.name} — plus de redémarrage depuis 2 h`);
  }
}

/** Alertes de tendance sur le relevé en direct (v0.32.0). */
export const MEM_WARN_MB = 400;
export const MEM_CRIT_MB = 460;
export const MEM_CLEAR_MB = 330;
export const RESTART_LOOP = { count: 3, windowMs: 3600_000 };
export const LOOP_LAG_MS = 1000;

/** Nombre de redémarrages dans la fenêtre donnée (fonction pure, testée). */
export function restartsWithin(restarts: Restart[], now: Date, windowMs: number): number {
  return restarts.filter((r) => now.getTime() - r.at.getTime() <= windowMs).length;
}

const lagStreak = new Map<string, number>();

export async function watchTrends(app: AppTarget, report: RuntimeReport, now = new Date()): Promise<void> {
  const memFp = `mem-high:${app.key}`;
  if (report.rssMb >= MEM_WARN_MB) {
    await raiseAlert({
      appKey: app.key,
      kind: "app",
      severity: report.rssMb >= MEM_CRIT_MB ? "critical" : "warning",
      title: `${app.name} — mémoire élevée : ${report.rssMb} Mo sur 512 Mo`,
      detail: `Relevé en direct à ${now.toISOString().slice(11, 19)} UTC. Au-delà de 512 Mo, Render arrête le service et coupe les traitements en cours (imports…).`,
      fingerprint: memFp,
    });
  } else if (report.rssMb < MEM_CLEAR_MB) {
    await resolveAlert(app.key, memFp, `${app.name} — mémoire revenue à ${report.rssMb} Mo`);
  }
  // Boucle d'événements bloquée deux relevés de suite : service saturé, avant même l'arrêt.
  const lagFp = `loop-lag:${app.key}`;
  const streak = report.loopLagMaxMs >= LOOP_LAG_MS ? (lagStreak.get(app.key) ?? 0) + 1 : 0;
  lagStreak.set(app.key, streak);
  if (streak >= 2) {
    await raiseAlert({ appKey: app.key, kind: "app", severity: "warning", title: `${app.name} — service saturé (retard de ${Math.round(report.loopLagMaxMs)} ms)`, detail: "Le processus met plus d'une seconde à traiter ses tâches, deux relevés de suite : les requêtes ralentissent.", fingerprint: lagFp });
  } else if (streak === 0) {
    await resolveAlert(app.key, lagFp, `${app.name} — service de nouveau réactif`);
  }
  // Redémarrages en boucle : 3 en une heure.
  const since = new Date(now.getTime() - RESTART_LOOP.windowMs);
  const rows = await prisma.runtimeSample.findMany({ where: { appKey: app.key, at: { gte: since } }, orderBy: { at: "asc" }, select: { at: true, ok: true, startedAt: true, rssMb: true } });
  const n = restartsWithin(detectRestarts(rows), now, RESTART_LOOP.windowMs);
  const loopFp = `restart-loop:${app.key}`;
  if (n >= RESTART_LOOP.count) {
    await raiseAlert({ appKey: app.key, kind: "app", severity: "critical", title: `${app.name} — redémarrages en boucle : ${n} en 1 heure`, detail: "Le service redémarre sans cesse (souvent mémoire saturée). Voir l'onglet « En direct » et « Chronologie ».", fingerprint: loopFp });
  } else if (n === 0) {
    await resolveAlert(app.key, loopFp, `${app.name} — plus de redémarrages en boucle`);
  }
}

let busy = false;
export function startRuntimeWatcher(): void {
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const app of apps) {
        if (await isPaused(app.key)) continue;
        await pollRuntime(app).catch((e) => console.error(`[direct] ${app.key}`, (e as Error).message));
      }
    } finally {
      busy = false;
    }
  };
  setTimeout(() => void tick(), 10_000);
  setInterval(() => void tick(), 15_000);
}
