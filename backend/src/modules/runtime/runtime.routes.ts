import { apps } from "../../config/apps";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { detectRestarts, latestReport } from "./runtime.service";

export const runtimeRouter = asyncRouter();
runtimeRouter.use(requireAdmin);

/** Relevés en direct d'une appli (`minutes` : 5 à 1440) et redémarrages repérés. */
runtimeRouter.get(
  "/:key/runtime",
  async (req, res) => {
    const app = apps.find((a) => a.key === req.params.key);
    if (!app) throw new HttpError(404, "Appli inconnue");
    const minutes = Math.min(1440, Math.max(5, Number(req.query.minutes ?? 30) || 30));
    const rows = await prisma.runtimeSample.findMany({ where: { appKey: app.key, at: { gte: new Date(Date.now() - minutes * 60_000) } }, orderBy: { at: "asc" } });
    const samples = rows.map((r) => ({ at: r.at.getTime(), ok: r.ok, startedAt: r.startedAt, rssMb: r.rssMb, heapMb: r.heapMb, externalMb: r.externalMb, loopLagMaxMs: r.loopLagMaxMs, imports: r.imports, jobs: r.jobs, uptimeSec: r.uptimeSec, error: r.error }));
    const restarts = detectRestarts(rows.map((r) => ({ at: r.at, ok: r.ok, startedAt: r.startedAt, rssMb: r.rssMb }))).map((r) => ({ at: r.at.getTime(), lastRssMb: r.lastRssMb, kind: r.kind }));
    res.json({ supported: rows.some((r) => r.ok), minutes, samples, restarts, last: samples.length ? samples[samples.length - 1] : null, current: latestReport.get(app.key) ?? null });
  },
);
