import { apps, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";
import { isPaused } from "../pause/pause.service";
import { nextTransition, runCheck } from "./check";

const failures = new Map<string, number>();
const lastRun = new Map<string, number>();
const running = new Set<string>();

export function downFingerprint(checkId: string): string {
  return `down:${checkId}`;
}

export async function checkApp(app: AppTarget): Promise<void> {
  for (const target of app.checks) {
    const outcome = await runCheck(target);
    await prisma.checkResult.create({
      data: { appKey: app.key, checkId: target.id, ok: outcome.ok, statusCode: outcome.statusCode, latencyMs: outcome.latencyMs, error: outcome.error },
    });
    const stateKey = `${app.key}:${target.id}`;
    const { failures: count, transition } = nextTransition(failures.get(stateKey), outcome.ok, env.alertAfterFailures);
    failures.set(stateKey, count);
    if (transition === "open") {
      await raiseAlert({
        appKey: app.key,
        kind: "down",
        severity: "critical",
        title: `${app.name} — ${target.label} ne répond plus`,
        detail: `${outcome.error ?? "Erreur"} (${target.url})`,
        fingerprint: downFingerprint(target.id),
      });
    } else if (transition === "resolve") {
      await resolveAlert(app.key, downFingerprint(target.id), `${app.name} — ${target.label} répond de nouveau`);
    }
  }
}

async function tick(): Promise<void> {
  const now = Date.now();
  for (const app of apps) {
    if (app.checks.length === 0 || running.has(app.key)) continue;
    if (await isPaused(app.key)) {
      // Au retour, le premier passage repart de zéro (et referme une alerte
      // de panne restée ouverte si l'appli répond).
      for (const c of app.checks) failures.delete(`${app.key}:${c.id}`);
      continue;
    }
    if (now - (lastRun.get(app.key) ?? 0) < app.intervalSec * 1000) continue;
    lastRun.set(app.key, now);
    running.add(app.key);
    checkApp(app)
      .catch((err) => console.error(`[monitor] ${app.key}`, err))
      .finally(() => running.delete(app.key));
  }
}

export function startMonitor(): void {
  if (!env.monitorEnabled) return;
  setTimeout(() => void tick(), 5_000);
  setInterval(() => void tick(), 15_000);
}

/** Relance immédiate des vérifications d'une appli (bouton « Vérifier maintenant »). */
export async function checkNow(app: AppTarget): Promise<void> {
  if (running.has(app.key)) return;
  running.add(app.key);
  lastRun.set(app.key, Date.now());
  try {
    await checkApp(app);
  } finally {
    running.delete(app.key);
  }
}
