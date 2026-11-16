import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { parseWeek, weekStartOf, weekView } from "./weeks";

export const objectivesRouter = asyncRouter();
objectivesRouter.use(requireAdmin);

const titleSchema = z.string().trim().min(1, "Écrivez l'objectif").max(300);

async function viewOf(week: Date) {
  const rows = await prisma.objective.findMany({ orderBy: { createdAt: "asc" } });
  return weekView(rows, week, new Date());
}

/** Objectifs d'une semaine (la semaine en cours par défaut) : `?week=2026-11-16`. */
objectivesRouter.get("/", async (req, res) => {
  const week = req.query.week === undefined ? weekStartOf(new Date()) : parseWeek(String(req.query.week));
  if (!week) throw new HttpError(400, "Semaine invalide");
  res.json(await viewOf(week));
});

objectivesRouter.post("/", async (req, res) => {
  const title = titleSchema.parse(req.body?.title);
  const now = new Date();
  await prisma.objective.create({ data: { title, weekStart: weekStartOf(now) } });
  res.status(201).json(await viewOf(weekStartOf(now)));
});

/** Modifier le texte, ou valider / rouvrir un objectif de la semaine en cours. */
objectivesRouter.patch("/:id", async (req, res) => {
  const body = z.object({ title: titleSchema.optional(), done: z.boolean().optional() }).parse(req.body ?? {});
  const current = await prisma.objective.findUnique({ where: { id: req.params.id } });
  if (!current) throw new HttpError(404, "Objectif introuvable");
  const now = new Date();
  const thisWeek = weekStartOf(now);
  const data: { title?: string; doneAt?: Date | null } = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.done === true && !current.doneAt) data.doneAt = now;
  if (body.done === false && current.doneAt) {
    // Un objectif validé une semaine passée reste validé : l'historique ne se réécrit pas.
    if (weekStartOf(current.doneAt).getTime() !== thisWeek.getTime()) throw new HttpError(409, "Cet objectif a été validé une semaine passée");
    data.doneAt = null;
  }
  await prisma.objective.update({ where: { id: current.id }, data });
  res.json(await viewOf(thisWeek));
});

objectivesRouter.delete("/:id", async (req, res) => {
  await prisma.objective.deleteMany({ where: { id: req.params.id } });
  res.json(await viewOf(weekStartOf(new Date())));
});
