import type { Prisma } from "@prisma/client";
import { asyncRouter } from "../../utils/asyncRouter";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { apps } from "../../config/apps";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { HttpError } from "../../utils/httpError";
import { safeEqual } from "../../utils/safeEqual";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";
import { jobRunSchema, recordRun } from "../jobs/jobs.service";
import { cleanEntry, detectKnownIncident, errorFingerprint, ingestAlertSchema, ingestLogsSchema, LEVELS } from "./ingest";

function appFromToken(header: string | undefined) {
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const app = apps.find((a) => safeEqual(a.ingestToken, token));
  if (!app) throw new HttpError(401, "Jeton d'envoi inconnu");
  return app;
}

/** Routes appelées par les applis supervisées (jeton propre à chaque appli). */
export const ingestRouter = asyncRouter();

ingestRouter.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));

ingestRouter.post("/logs", async (req, res) => {
  const app = appFromToken(req.headers.authorization);
  const { entries } = ingestLogsSchema.parse(req.body);
  const clean = entries.map((e) => cleanEntry(e));
  await prisma.logEntry.createMany({
    data: clean.map((e) => ({ appKey: app.key, ...e, context: (e.context ?? undefined) as Prisma.InputJsonValue | undefined })),
  });
  // Incidents connus (crédit Claude épuisé, clé refusée…) : alerte dédiée,
  // quel que soit le niveau du journal, regroupée sous une seule clé.
  const generic: typeof clean = [];
  for (const e of clean) {
    const known = detectKnownIncident(e.message);
    if (known) {
      await raiseAlert({ appKey: app.key, kind: "app", severity: known.severity, title: `${app.name} — ${known.title}`, detail: known.detail, fingerprint: `known:${known.key}` });
    } else {
      generic.push(e);
    }
  }
  // Les incidents connus ont déjà leur alerte dédiée : pas d'alerte d'erreur en double.
  for (const e of generic.filter((x) => x.level === "error" || x.level === "fatal")) {
    await raiseAlert({
      appKey: app.key,
      kind: "error",
      severity: e.level === "fatal" ? "critical" : "warning",
      title: `${app.name} — ${e.message.split("\n")[0].slice(0, 140)}`,
      detail: e.message.slice(0, 1000),
      fingerprint: errorFingerprint(e.message),
    });
  }
  res.status(202).json({ received: clean.length });
});

ingestRouter.post("/alerts", async (req, res) => {
  const app = appFromToken(req.headers.authorization);
  const input = ingestAlertSchema.parse(req.body);
  const fingerprint = `app:${input.key}`;
  if (input.resolve) {
    await resolveAlert(app.key, fingerprint, `${app.name} — ${input.title ?? input.key} : rétabli`);
  } else {
    await raiseAlert({
      appKey: app.key,
      kind: "app",
      severity: input.severity,
      title: `${app.name} — ${input.title ?? input.key}`,
      detail: input.detail ?? null,
      fingerprint,
    });
  }
  res.status(202).json({ ok: true });
});

/** Exécution d'une tâche planifiée (rappels, récap, purge…). */
ingestRouter.post("/jobs", async (req, res) => {
  const app = appFromToken(req.headers.authorization);
  await recordRun(app, jobRunSchema.parse(req.body));
  res.status(202).json({ ok: true });
});

/** Consultation des journaux par le super administrateur. */
export const logsRouter = asyncRouter();
logsRouter.use(requireAdmin);

const querySchema = z.object({
  app: z.string().optional(),
  minLevel: z.enum(LEVELS).optional(),
  q: z.string().max(200).optional(),
  source: z.string().max(40).optional(),
  before: z.string().regex(/^\d+$/).optional(),
  after: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

logsRouter.get("/", async (req, res) => {
  const q = querySchema.parse(req.query);
  const levels = q.minLevel ? LEVELS.slice(LEVELS.indexOf(q.minLevel)) : undefined;
  const rows = await prisma.logEntry.findMany({
    where: {
      appKey: q.app || undefined,
      level: levels ? { in: [...levels] } : undefined,
      source: q.source || undefined,
      message: q.q ? { contains: q.q, mode: "insensitive" } : undefined,
      id: q.after ? { gt: BigInt(q.after) } : q.before ? { lt: BigInt(q.before) } : undefined,
    },
    orderBy: { id: "desc" },
    take: q.limit,
  });
  res.json(rows.map((r) => ({ ...r, id: r.id.toString() })));
});
