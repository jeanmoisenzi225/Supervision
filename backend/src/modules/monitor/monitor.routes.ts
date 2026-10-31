import { z } from "zod";
import { apps, findApp, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { checkNow } from "./monitor";

export type AppStatus = "ok" | "degraded" | "down" | "unknown" | "not_deployed";

/** État global d'une appli à partir du dernier résultat de chaque adresse. */
export function computeStatus(lastResults: ({ ok: boolean } | null)[]): AppStatus {
  if (lastResults.length === 0) return "not_deployed";
  const known = lastResults.filter((r): r is { ok: boolean } => r !== null);
  if (known.length === 0) return "unknown";
  const failing = known.filter((r) => !r.ok).length;
  if (failing === 0) return known.length === lastResults.length ? "ok" : "unknown";
  return failing === lastResults.length ? "down" : "degraded";
}

async function appOverview(app: AppTarget) {
  const since = new Date(Date.now() - 24 * 3600_000);
  const checks = await Promise.all(
    app.checks.map(async (c) => {
      const [last, total, ok] = await Promise.all([
        prisma.checkResult.findFirst({ where: { appKey: app.key, checkId: c.id }, orderBy: { at: "desc" } }),
        prisma.checkResult.count({ where: { appKey: app.key, checkId: c.id, at: { gte: since } } }),
        prisma.checkResult.count({ where: { appKey: app.key, checkId: c.id, at: { gte: since }, ok: true } }),
      ]);
      return {
        id: c.id,
        label: c.label,
        url: c.url,
        last: last ? { ok: last.ok, at: last.at, latencyMs: last.latencyMs, statusCode: last.statusCode, error: last.error } : null,
        uptime24h: total ? Math.round((ok / total) * 1000) / 10 : null,
      };
    })
  );
  const [openAlerts, errors24h, lastLog] = await Promise.all([
    prisma.alert.count({ where: { appKey: app.key, status: { in: ["open", "acknowledged"] } } }),
    prisma.logEntry.count({ where: { appKey: app.key, at: { gte: since }, level: { in: ["error", "fatal"] } } }),
    prisma.logEntry.findFirst({ where: { appKey: app.key }, orderBy: { id: "desc" }, select: { receivedAt: true } }),
  ]);
  return {
    key: app.key,
    name: app.name,
    description: app.description,
    intervalSec: app.intervalSec,
    sleepsWhenIdle: app.sleepsWhenIdle,
    status: computeStatus(checks.map((c) => c.last)),
    checks,
    openAlerts,
    errors24h,
    lastLogAt: lastLog?.receivedAt ?? null,
    integration: {
      logs: Boolean(app.ingestToken),
      adminActions: Boolean(app.adminUrl && app.adminToken),
      render: Boolean(env.renderApiKey),
    },
  };
}

export const monitorRouter = asyncRouter();
monitorRouter.use(requireAdmin);

monitorRouter.get("/overview", async (_req, res) => {
  res.json({ generatedAt: new Date(), apps: await Promise.all(apps.map(appOverview)) });
});

function getApp(key: string): AppTarget {
  const app = findApp(key);
  if (!app) throw new HttpError(404, "Appli inconnue");
  return app;
}

monitorRouter.get("/apps/:key", async (req, res) => {
  res.json(await appOverview(getApp(req.params.key)));
});

monitorRouter.get("/apps/:key/checks", async (req, res) => {
  const app = getApp(req.params.key);
  const { hours } = z.object({ hours: z.coerce.number().int().min(1).max(24 * 30).default(24) }).parse(req.query);
  const since = new Date(Date.now() - hours * 3600_000);
  const results = await prisma.checkResult.findMany({
    where: { appKey: app.key, at: { gte: since } },
    orderBy: { at: "desc" },
    take: 5000,
  });
  // Regroupement par heure et par adresse pour la frise de disponibilité.
  const buckets = new Map<string, { checkId: string; hour: string; total: number; ok: number; latencySum: number }>();
  for (const r of results) {
    const hour = new Date(Math.floor(r.at.getTime() / 3600_000) * 3600_000).toISOString();
    const key = `${r.checkId}|${hour}`;
    const b = buckets.get(key) ?? { checkId: r.checkId, hour, total: 0, ok: 0, latencySum: 0 };
    b.total += 1;
    b.ok += r.ok ? 1 : 0;
    b.latencySum += r.latencyMs ?? 0;
    buckets.set(key, b);
  }
  res.json({
    hourly: [...buckets.values()]
      .map((b) => ({ checkId: b.checkId, hour: b.hour, total: b.total, ok: b.ok, avgLatencyMs: Math.round(b.latencySum / b.total) }))
      .sort((a, b) => a.hour.localeCompare(b.hour)),
    recent: results.slice(0, 50).map((r) => ({ ...r, id: r.id.toString() })),
  });
});

monitorRouter.post("/apps/:key/check-now", async (req, res) => {
  const app = getApp(req.params.key);
  await checkNow(app);
  res.json(await appOverview(app));
});
