import { prisma } from "../../db/prisma";

export interface PauseState {
  appKey: string;
  until: Date | null;
  reason: string | null;
  by: string;
  pausedAt: Date;
}

/** Une coupure est en cours si elle n'a pas de fin, ou si sa fin n'est pas atteinte (fonction pure, testée). */
export function isActive(pause: Pick<PauseState, "until"> | undefined, now = new Date()): boolean {
  return pause !== undefined && (pause.until === null || pause.until > now);
}

let cache: { at: number; pauses: Map<string, PauseState> } | null = null;

async function load(): Promise<Map<string, PauseState>> {
  if (cache && Date.now() - cache.at < 10_000) return cache.pauses;
  const rows = await prisma.appPause.findMany();
  // Coupures arrivées à échéance : retirées, la supervision reprend seule.
  const expired = rows.filter((r) => !isActive(r));
  if (expired.length) await prisma.appPause.deleteMany({ where: { appKey: { in: expired.map((r) => r.appKey) } } });
  const pauses = new Map(rows.filter((r) => isActive(r)).map((r) => [r.appKey, r]));
  cache = { at: Date.now(), pauses };
  return pauses;
}

export async function getPause(appKey: string): Promise<PauseState | null> {
  return (await load()).get(appKey) ?? null;
}

export async function isPaused(appKey: string): Promise<boolean> {
  return (await load()).has(appKey);
}

export async function pauseApp(appKey: string, by: string, minutes: number | null, reason: string | null): Promise<PauseState> {
  const until = minutes ? new Date(Date.now() + minutes * 60_000) : null;
  const row = await prisma.appPause.upsert({
    where: { appKey },
    create: { appKey, until, reason, by },
    update: { until, reason, by, pausedAt: new Date() },
  });
  cache = null;
  return row;
}

export async function resumeApp(appKey: string): Promise<void> {
  await prisma.appPause.deleteMany({ where: { appKey } });
  cache = null;
}
