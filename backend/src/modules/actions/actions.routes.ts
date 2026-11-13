import { z } from "zod";
import { findApp, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { pauseApp, resumeApp } from "../pause/pause.service";
import { signAdminRequest } from "../../utils/adminSignature";
import { deployService, describeService, resolveServiceIds, restartService, resumeService, suspendService } from "./render";

export const actionsRouter = asyncRouter();
actionsRouter.use(requireAdmin);

function getApp(key: string): AppTarget {
  const app = findApp(key);
  if (!app) throw new HttpError(404, "Appli inconnue");
  return app;
}

/** Appel du protocole d'administration exposé par une appli (voir docs/integration.md). */
export async function callApp<T>(app: AppTarget, path: string, init: RequestInit = {}): Promise<T> {
  if (!app.adminUrl || !app.adminToken) throw new HttpError(400, "Actions d'administration non configurées pour cette appli");
  const method = (init.method ?? "GET").toUpperCase();
  const payload = typeof init.body === "string" ? init.body : "";
  const timestamp = Date.now();
  // La signature porte sur le chemin seul, sans les paramètres d'adresse (?limit=…), comme la vérification côté appli.
  const relPath = path.replace(/^\/supervision/, "").split("?")[0];
  const res = await fetch(`${app.adminUrl}${path}`, {
    ...init,
    method,
    body: payload || undefined,
    // Une appli au repos (offre gratuite) peut mettre une minute à se réveiller.
    signal: AbortSignal.timeout(app.sleepsWhenIdle ? 90_000 : 30_000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Supervision-Timestamp": String(timestamp),
      "X-Supervision-Signature": signAdminRequest(app.adminToken, timestamp, method, relPath, payload),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text.slice(0, 300) };
  }
  if (!res.ok) {
    // `error` (applis Node) ou `detail` (FastAPI, Yiri).
    const b = body as { error?: string; message?: string; detail?: unknown } | null;
    const message = b?.error ?? (typeof b?.detail === "string" ? b.detail : undefined) ?? b?.message;
    // Refus métier de l'appli (paramètre manquant, compte introuvable…) : message tel quel.
    if (res.status === 422 && message) throw new HttpError(422, message);
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
      ? callApp<{ actions: unknown[] }>(app, "/supervision/actions").then(
          (r) => ({ actions: r.actions ?? [] }),
          (err) => {
            const message = (err as Error).message;
            // 404 : l'appli n'expose pas encore les actions (version pas encore en ligne).
            return /répondu 404/.test(message) ? { actions: [], notReady: true } : { actions: [], error: message };
          }
        )
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

/**
 * Coupure complète du service : tous les services Render de l'appli sont
 * suspendus (l'appli est hors ligne). La supervision de l'appli est coupée
 * en même temps, sans échéance, pour ne pas alerter sur une panne voulue.
 * Confirmation : le nom de l'appli doit être retapé (`confirm`).
 */
/** Clients de l'appli (ex. garages de MGA) : liste, puis fiche détaillée. */
actionsRouter.get("/:key/tenants", async (req, res) => {
  const app = getApp(req.params.key);
  if (!app.adminUrl || !app.adminToken) return res.json({ configured: false, label: null, items: [] });
  try {
    const r = await callApp<{ label: string | null; items: unknown[] }>(app, "/supervision/tenants");
    res.json({ configured: true, label: r.label, items: r.items ?? [] });
  } catch (err) {
    const message = (err as Error).message;
    res.json(/répondu 404/.test(message) ? { configured: true, notReady: true, label: null, items: [] } : { configured: true, label: null, items: [], error: message });
  }
});

/** Historique des imports de documents (Procedia) : relayé depuis la route signée `/supervision/reports/imports`. */
actionsRouter.get("/:key/imports", async (req, res) => {
  const app = getApp(req.params.key);
  if (!app.adminUrl || !app.adminToken) return res.json({ configured: false });
  const qs = new URLSearchParams();
  for (const k of ["status", "limit", "before", "client"] as const) {
    const v = req.query[k];
    if (typeof v === "string" && /^[\w:.\-]{1,40}$/.test(v)) qs.set(k, v);
  }
  try {
    const r = await callApp<Record<string, unknown>>(app, `/supervision/reports/imports${qs.size ? `?${qs}` : ""}`);
    res.json({ configured: true, ...r });
  } catch (err) {
    const message = (err as Error).message;
    res.json(/répondu 404/.test(message) ? { configured: true, notReady: true } : { configured: true, error: message });
  }
});

actionsRouter.get("/:key/tenants/:id", async (req, res) => {
  const app = getApp(req.params.key);
  if (!/^[\w.:@-]{1,100}$/.test(req.params.id)) throw new HttpError(400, "Identifiant invalide");
  res.json(await callApp(app, `/supervision/tenants/${encodeURIComponent(req.params.id)}`));
});

actionsRouter.post("/:key/render/suspend-all", async (req, res) => {
  const app = getApp(req.params.key);
  const { confirm, reason } = z.object({ confirm: z.string(), reason: z.string().max(200).nullable().default(null) }).parse(req.body ?? {});
  if (confirm.trim().toLowerCase() !== app.name.toLowerCase()) throw new HttpError(400, `Pour confirmer, tape exactement : ${app.name}`);
  const ids = await resolveServiceIds(app);
  if (ids.length === 0) throw new HttpError(400, "Aucun service Render reconnu pour cette appli");
  await pauseApp(app.key, req.admin!.email, null, reason ? `Service coupé : ${reason}` : "Service coupé");
  const results: string[] = [];
  const message = await audit(req.admin!.email, app.key, "render:suspend-all", { services: ids, reason }, async () => {
    const failed: string[] = [];
    for (const id of ids) {
      const name = await describeService(id).then((s) => s.name, () => id);
      try {
        await suspendService(id);
        results.push(`${name} : coupé`);
      } catch (err) {
        failed.push(`${name} (${(err as Error).message})`);
      }
    }
    if (failed.length) throw new HttpError(502, `Coupure incomplète : ${failed.join(", ")}${results.length ? ` — déjà coupés : ${results.join(", ")}` : ""}`);
    return `Service coupé · ${results.join(" · ")}`;
  });
  res.json({ ok: true, message });
});

/** Remise en service : services Render relancés, supervision reprise. */
actionsRouter.post("/:key/render/resume-all", async (req, res) => {
  const app = getApp(req.params.key);
  const ids = await resolveServiceIds(app);
  if (ids.length === 0) throw new HttpError(400, "Aucun service Render reconnu pour cette appli");
  const results: string[] = [];
  const message = await audit(req.admin!.email, app.key, "render:resume-all", { services: ids }, async () => {
    const failed: string[] = [];
    for (const id of ids) {
      const s = await describeService(id).catch(() => null);
      if (s && !s.suspended) continue;
      try {
        await resumeService(id);
        results.push(`${s?.name ?? id} : remis en service`);
      } catch (err) {
        failed.push(`${s?.name ?? id} (${(err as Error).message})`);
      }
    }
    if (failed.length) throw new HttpError(502, `Remise en service incomplète : ${failed.join(", ")}`);
    await resumeApp(app.key);
    return results.length ? `${results.join(" · ")} · supervision reprise` : "Aucun service n'était coupé · supervision reprise";
  });
  res.json({ ok: true, message });
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
