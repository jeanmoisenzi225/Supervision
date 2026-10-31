import { z } from "zod";
import { findApp, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { deployService, describeService, resolveServiceIds, restartService } from "./render";

export const actionsRouter = asyncRouter();
actionsRouter.use(requireAdmin);

function getApp(key: string): AppTarget {
  const app = findApp(key);
  if (!app) throw new HttpError(404, "Appli inconnue");
  return app;
}

/** Appel du protocole d'administration exposé par une appli (voir docs/integration.md). */
async function callApp<T>(app: AppTarget, path: string, init: RequestInit = {}): Promise<T> {
  if (!app.adminUrl || !app.adminToken) throw new HttpError(400, "Actions d'administration non configurées pour cette appli");
  const res = await fetch(`${app.adminUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${app.adminToken}` },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text.slice(0, 300) };
  }
  if (!res.ok) {
    const message = (body as { error?: string; message?: string } | null)?.error ?? (body as { message?: string } | null)?.message;
    throw new HttpError(502, `L'appli a répondu ${res.status}${message ? ` : ${message}` : ""}`);
  }
  return body as T;
}

async function audit(by: string, appKey: string, action: string, params: unknown, run: () => Promise<string | undefined>) {
  try {
    const message = await run();
    await prisma.actionAudit.create({ data: { by, appKey, action, params: params ?? undefined, ok: true, message: message ?? null } });
    return message;
  } catch (err) {
    await prisma.actionAudit.create({ data: { by, appKey, action, params: params ?? undefined, ok: false, message: (err as Error).message } });
    throw err;
  }
}

actionsRouter.get("/:key/actions", async (req, res) => {
  const app = getApp(req.params.key);
  const renderConfigured = Boolean(env.renderApiKey);
  let renderError: string | null = null;
  const serviceIds = renderConfigured
    ? await resolveServiceIds(app).catch((err: Error) => {
        renderError = err.message;
        return [] as string[];
      })
    : [];
  const [services, appActions, appSummary, history] = await Promise.all([
    Promise.all(serviceIds.map((id) => describeService(id).catch((err) => ({ id, error: (err as Error).message })))),
    app.adminUrl && app.adminToken
      ? callApp<{ actions: unknown[] }>(app, "/supervision/actions").then((r) => ({ actions: r.actions ?? [] }), (err) => ({ actions: [], error: (err as Error).message }))
      : Promise.resolve(null),
    app.adminUrl && app.adminToken
      ? callApp<{ metrics: unknown[] }>(app, "/supervision/summary").then((r) => r.metrics ?? [], () => [])
      : Promise.resolve([]),
    prisma.actionAudit.findMany({ where: { appKey: app.key }, orderBy: { at: "desc" }, take: 20 }),
  ]);
  res.json({
    render: { configured: renderConfigured, services, error: renderError },
    app: appActions ? { configured: true, ...appActions } : { configured: false, actions: [] },
    metrics: appSummary,
    history,
  });
});

/** « Tout relancer » : redémarre tous les services web de l'appli (un site statique n'a rien à redémarrer). */
actionsRouter.post("/:key/render/restart-all", async (req, res) => {
  const app = getApp(req.params.key);
  const ids = await resolveServiceIds(app);
  if (ids.length === 0) throw new HttpError(400, "Aucun service Render reconnu pour cette appli");
  const results: { id: string; name: string; outcome: string }[] = [];
  const message = await audit(req.admin!.email, app.key, "render:restart-all", { services: ids }, async () => {
    for (const id of ids) {
      try {
        const s = await describeService(id);
        if (s.type === "static_site") {
          results.push({ id, name: s.name, outcome: "site statique, rien à redémarrer" });
          continue;
        }
        await restartService(id);
        results.push({ id, name: s.name, outcome: "redémarrage demandé" });
      } catch (err) {
        results.push({ id, name: id, outcome: `échec : ${(err as Error).message}` });
      }
    }
    const failed = results.filter((r) => r.outcome.startsWith("échec"));
    if (failed.length) throw new HttpError(502, `Relance incomplète : ${failed.map((f) => `${f.name} (${f.outcome})`).join(", ")}`);
    return results.map((r) => `${r.name} : ${r.outcome}`).join(" · ");
  });
  res.json({ ok: true, message, results });
});

actionsRouter.post("/:key/render/:serviceId/:op", async (req, res) => {
  const app = getApp(req.params.key);
  const { serviceId, op } = req.params;
  if (!(await resolveServiceIds(app)).includes(serviceId)) throw new HttpError(404, "Service Render inconnu pour cette appli");
  const { clearCache } = z.object({ clearCache: z.boolean().default(false) }).parse(req.body ?? {});
  const message = await audit(req.admin!.email, app.key, `render:${op}:${serviceId}`, { clearCache }, async () => {
    if (op === "restart") {
      await restartService(serviceId);
      return "Redémarrage demandé à Render";
    }
    if (op === "deploy") {
      await deployService(serviceId, clearCache);
      return "Redéploiement lancé sur Render";
    }
    throw new HttpError(400, "Opération inconnue");
  });
  res.json({ ok: true, message });
});

actionsRouter.post("/:key/actions/:actionId", async (req, res) => {
  const app = getApp(req.params.key);
  const actionId = req.params.actionId;
  if (!/^[a-z0-9_-]{1,60}$/i.test(actionId)) throw new HttpError(400, "Action invalide");
  const { params } = z.object({ params: z.record(z.unknown()).default({}) }).parse(req.body ?? {});
  let result: { ok?: boolean; message?: string; data?: unknown } = {};
  const message = await audit(req.admin!.email, app.key, actionId, params, async () => {
    result = await callApp(app, `/supervision/actions/${actionId}`, { method: "POST", body: JSON.stringify({ params, by: req.admin!.email }) });
    if (result.ok === false) throw new HttpError(502, result.message ?? "Action refusée par l'appli");
    return result.message ?? "Action effectuée";
  });
  res.json({ ok: true, message, data: result.data ?? null });
});
