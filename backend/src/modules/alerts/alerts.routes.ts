import { asyncRouter } from "../../utils/asyncRouter";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { HttpError } from "../../utils/httpError";

export const alertsRouter = asyncRouter();
alertsRouter.use(requireAdmin);

const listSchema = z.object({
  status: z.enum(["active", "open", "acknowledged", "resolved", "all"]).default("active"),
  app: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

alertsRouter.get("/", async (req, res) => {
  const q = listSchema.parse(req.query);
  const status =
    q.status === "all" ? undefined : q.status === "active" ? { in: ["open", "acknowledged"] } : q.status;
  const alerts = await prisma.alert.findMany({
    where: { status, appKey: q.app || undefined },
    orderBy: [{ lastSeenAt: "desc" }],
    take: q.limit,
  });
  res.json(alerts);
});

async function setStatus(id: string, status: "acknowledged" | "resolved") {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new HttpError(404, "Alerte introuvable");
  return prisma.alert.update({
    where: { id },
    data: status === "acknowledged" ? { status, ackAt: new Date() } : { status, resolvedAt: new Date() },
  });
}

alertsRouter.post("/:id/ack", async (req, res) => {
  res.json(await setStatus(req.params.id, "acknowledged"));
});

alertsRouter.post("/:id/resolve", async (req, res) => {
  res.json(await setStatus(req.params.id, "resolved"));
});
