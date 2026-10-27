import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { actionsRouter } from "./modules/actions/actions.routes";
import { alertsRouter } from "./modules/alerts/alerts.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { ingestRouter, logsRouter } from "./modules/logs/logs.routes";
import { monitorRouter } from "./modules/monitor/monitor.routes";
import { pushRouter } from "./modules/push/push.routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));

  // Envoi des journaux : appelé de serveur à serveur par les applis
  // supervisées, authentifié par leur jeton, donc ouvert à toute origine.
  app.use("/api/ingest", cors({ origin: "*", credentials: false }), express.json({ limit: "1mb" }), ingestRouter);

  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || env.corsOrigins.includes(origin));
      },
    })
  );
  app.use(express.json({ limit: "200kb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter);
  app.use("/api", monitorRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/logs", logsRouter);
  app.use("/api/apps", actionsRouter);
  app.use("/api/push", pushRouter);

  app.use(errorHandler);
  return app;
}
