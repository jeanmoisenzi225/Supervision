import { apps, type AppTarget } from "../../config/apps";
import { prisma } from "../../db/prisma";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";
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
  imports?: { running: number };
  jobs?: number | null;
}

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
    lastRestart.set(app.key, now);
    await raiseAlert({
      appKey: app.key,
      kind: "app",
      severity: memory ? "critical" : "warning",
      title: memory ? `${app.name} — redémarrage après saturation de la mémoire` : `${app.name} — redémarrage du service`,
      detail: `Le service a redémarré (démarrage à ${startedAt.toISOString().slice(11, 19)} UTC). Dernière mémoire vue avant l'arrêt : ${prev.rssMb} Mo (pic ${prev.peakMb} Mo sur les derniers relevés, limite 512 Mo). Dernier relevé normal : ${prev.at.toISOString().slice(11, 19)} UTC.`,
      fingerprint: `restart:${app.key}`,
    });
    lastGood.set(app.key, { startedAt, rssMb: report.rssMb, at: now, peakMb: report.rssMb });
  } else {
    // Pic mémoire retenu sur la durée de vie de ce processus (jusqu'au prochain redémarrage).
    lastGood.set(app.key, { startedAt, rssMb: report.rssMb, at: now, peakMb: Math.max(prev?.peakMb ?? 0, report.rssMb) });
  }
  const lr = lastRestart.get(app.key);
  if (lr && now.getTime() - lr.getTime() > QUIET_MS) {
    lastRestart.delete(app.key);
    await resolveAlert(app.key, `restart:${app.key}`, `${app.name} — plus de redémarrage depuis 2 h`);
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
