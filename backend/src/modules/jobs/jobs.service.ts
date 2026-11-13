import { z } from "zod";
import { stamp } from "../../utils/time";
import { apps, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";
import { isPaused } from "../pause/pause.service";
import { minIntervalMinutes, nextFire, parseCron, previousFire } from "./cron";

export const jobRunSchema = z.object({
  key: z.string().regex(/^[a-z0-9:_.-]{1,60}$/i),
  label: z.string().min(1).max(120),
  cron: z.string().max(100).refine((c) => {
    try {
      parseCron(c);
      return true;
    } catch {
      return false;
    }
  }, "Expression cron invalide"),
  graceMinutes: z.number().int().min(1).max(24 * 60).default(15),
  status: z.enum(["ok", "error"]),
  message: z.string().max(500).optional(),
  durationMs: z.number().int().min(0).max(24 * 3600_000).optional(),
});

export type JobState = "ok" | "late" | "failed" | "waiting";

/**
 * État d'une tâche à l'instant `now` (fonction pure, testée) :
 * - late : l'échéance prévue (marge comprise) est passée sans exécution depuis ;
 * - failed : la dernière exécution a échoué ;
 * - waiting : déclarée mais pas encore d'échéance à vérifier ;
 * - ok sinon.
 */
export function jobState(
  job: { cron: string; graceMinutes: number; lastRunAt: Date | null; lastStatus: string | null; createdAt: Date },
  now = new Date()
): { state: JobState; expectedAt: Date | null } {
  const expectedAt = previousFire(job.cron, new Date(now.getTime() - job.graceMinutes * 60_000));
  const missed = expectedAt !== null && job.createdAt < expectedAt && (!job.lastRunAt || job.lastRunAt.getTime() < expectedAt.getTime() - 60_000);
  if (missed) return { state: "late", expectedAt };
  if (job.lastStatus === "error") return { state: "failed", expectedAt };
  if (!job.lastRunAt) return { state: "waiting", expectedAt };
  return { state: "ok", expectedAt };
}

const fmt = (d: Date) => stamp(d);

/** Enregistre une exécution envoyée par une appli, ouvre ou referme les alertes. */
export async function recordRun(app: AppTarget, input: z.infer<typeof jobRunSchema>, now = new Date()): Promise<void> {
  const job = await prisma.job.upsert({
    where: { appKey_key: { appKey: app.key, key: input.key } },
    create: { appKey: app.key, key: input.key, label: input.label, cron: input.cron, graceMinutes: input.graceMinutes },
    update: { label: input.label, cron: input.cron, graceMinutes: input.graceMinutes },
  });
  await prisma.jobRun.create({ data: { jobId: job.id, at: now, status: input.status, message: input.message ?? null, durationMs: input.durationMs ?? null } });
  await prisma.job.update({ where: { id: job.id }, data: { lastRunAt: now, lastStatus: input.status, lastMessage: input.message ?? null } });

  if (input.status === "error") {
    await raiseAlert({ appKey: app.key, kind: "app", severity: "warning", title: `${app.name} — tâche « ${input.label} » en échec`, detail: input.message ?? null, fingerprint: `jobfail:${input.key}` });
    return;
  }
  await resolveAlert(app.key, `jobfail:${input.key}`, `${app.name} — tâche « ${input.label} » de nouveau réussie`);
  await resolveAlert(app.key, `joblate:${input.key}`, `${app.name} — tâche « ${input.label} » exécutée`);

  // Exécutée deux fois pour une même échéance (tâches au plus toutes les 6 h).
  if (minIntervalMinutes(input.cron) >= 360) {
    const since = previousFire(input.cron, now);
    if (since) {
      const count = await prisma.jobRun.count({ where: { jobId: job.id, status: "ok", at: { gte: since } } });
      if (count > 1) {
        await raiseAlert({
          appKey: app.key,
          kind: "app",
          severity: "warning",
          title: `${app.name} — tâche « ${input.label} » exécutée ${count} fois`,
          detail: `${count} exécutions depuis l'échéance de ${fmt(since)} : risque d'envois en double (ex. notifications).`,
          fingerprint: `jobdup:${input.key}:${since.toISOString().slice(0, 16)}`,
        });
      }
    }
  }
}

/** Tâches d'une appli avec leur état et leurs dernières exécutions. */
export async function listJobs(appKey: string, now = new Date()) {
  const jobs = await prisma.job.findMany({
    where: { appKey },
    orderBy: { label: "asc" },
    include: { runs: { orderBy: { at: "desc" }, take: 10 } },
  });
  return jobs.map((j) => {
    const { state, expectedAt } = jobState(j, now);
    return {
      key: j.key,
      label: j.label,
      cron: j.cron,
      graceMinutes: j.graceMinutes,
      state,
      expectedAt,
      nextAt: nextFire(j.cron, now),
      lastRunAt: j.lastRunAt,
      lastStatus: j.lastStatus,
      lastMessage: j.lastMessage,
      runs: j.runs.map((r) => ({ at: r.at, status: r.status, message: r.message, durationMs: r.durationMs })),
    };
  });
}

/** Alerte « non exécutée » pour chaque tâche en retard (applis non coupées). */
export async function watchJobs(now = new Date()): Promise<void> {
  const jobs = await prisma.job.findMany();
  for (const j of jobs) {
    const app = apps.find((a) => a.key === j.appKey);
    if (!app || (await isPaused(app.key))) continue;
    const { state, expectedAt } = jobState(j, now);
    if (state === "late" && expectedAt) {
      await raiseAlert({
        appKey: app.key,
        kind: "app",
        severity: "critical",
        title: `${app.name} — tâche « ${j.label} » non exécutée`,
        detail: `Prévue le ${fmt(expectedAt)} (marge ${j.graceMinutes} min), aucune exécution reçue depuis.${j.lastRunAt ? ` Dernière exécution : ${fmt(j.lastRunAt)}.` : ""}`,
        fingerprint: `joblate:${j.key}`,
      });
    }
  }
}

export function startJobWatcher(): void {
  if (!env.monitorEnabled) return;
  setInterval(() => void watchJobs().catch((err) => console.error("[tâches]", (err as Error).message)), 5 * 60_000);
}
