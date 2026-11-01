import { createApp } from "./app";
import { env } from "./config/env";
import { ensureAdmin } from "./modules/auth/auth.routes";
import { startPurge } from "./modules/maintenance/purge";
import { startMonitor } from "./modules/monitor/monitor";
import { startResourceWatcher } from "./modules/resources/resources.service";
import { initPush } from "./modules/push/push.service";

async function main() {
  await ensureAdmin();
  await initPush();
  createApp().listen(env.port, () => console.log(`Supervision API sur le port ${env.port}`));
  startMonitor();
  startPurge();
  startResourceWatcher();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
