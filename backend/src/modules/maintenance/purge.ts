import { env } from "../../config/env";
import { prisma } from "../../db/prisma";

/** Supprime les journaux et vérifications plus anciens que la durée de conservation. */
export async function purgeOldData(): Promise<void> {
  const day = 24 * 3600_000;
  await prisma.jobRun.deleteMany({ where: { at: { lt: new Date(Date.now() - env.logRetentionDays * day) } } });
  await prisma.runtimeSample.deleteMany({ where: { at: { lt: new Date(Date.now() - 7 * day) } } });
  await prisma.resourceSample.deleteMany({ where: { at: { lt: new Date(Date.now() - 90 * day) } } });
  const [logs, checks] = await Promise.all([
    prisma.logEntry.deleteMany({ where: { at: { lt: new Date(Date.now() - env.logRetentionDays * day) } } }),
    prisma.checkResult.deleteMany({ where: { at: { lt: new Date(Date.now() - env.checkRetentionDays * day) } } }),
  ]);
  if (logs.count || checks.count) console.log(`[purge] ${logs.count} journaux, ${checks.count} vérifications supprimés`);
}

export function startPurge(): void {
  setTimeout(() => void purgeOldData().catch(console.error), 60_000);
  setInterval(() => void purgeOldData().catch(console.error), 6 * 3600_000);
}
