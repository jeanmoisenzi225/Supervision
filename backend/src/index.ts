import { createApp } from "./app";
import { env } from "./config/env";
import { ensureAdmin } from "./modules/auth/auth.routes";
import { startPurge } from "./modules/maintenance/purge";
import { startMonitor } from "./modules/monitor/monitor";
import { startResourceWatcher } from "./modules/resources/resources.service";
import { startCostWatcher } from "./modules/costs/costs.service";
import { startRenderEventWatcher } from "./modules/renderEvents/renderEvents.service";
import { startRuntimeWatcher } from "./modules/runtime/runtime.service";
import { startRealSizeSampler } from "./modules/resources/realsize";
import { startRenderLogWatcher } from "./modules/renderLogs/renderLogs.service";
import { startJobWatcher } from "./modules/jobs/jobs.service";
import { startBacklogSync } from "./modules/backlog/backlog.service";
import { seedBillingProfile } from "./modules/billing/profile-seed";
import { initPush } from "./modules/push/push.service";

async function main() {
  await ensureAdmin();
  await initPush();
  await seedBillingProfile();
  createApp().listen(env.port, () => console.log(`Supervision API sur le port ${env.port}`));
  startMonitor();
  startPurge();
  startResourceWatcher();
  startCostWatcher();
  startJobWatcher();
  startRenderEventWatcher();
  startRuntimeWatcher();
  startRealSizeSampler();
  startRenderLogWatcher();
  startBacklogSync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
