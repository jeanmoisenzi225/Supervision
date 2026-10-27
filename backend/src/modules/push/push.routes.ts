import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { isPushConfigured, sendPushToAll } from "./push.service";

export const pushRouter = asyncRouter();
pushRouter.use(requireAdmin);

pushRouter.get("/public-key", async (_req, res) => {
  res.json({ configured: isPushConfigured(), publicKey: isPushConfigured() ? env.vapidPublicKey : null });
});

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

pushRouter.post("/subscribe", async (req, res) => {
  if (!isPushConfigured()) throw new HttpError(400, "Notifications non configurées sur le serveur");
  const sub = subscriptionSchema.parse(req.body);
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  res.json({ ok: true });
});

pushRouter.post("/unsubscribe", async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  res.json({ ok: true });
});

pushRouter.post("/test", async (_req, res) => {
  await sendPushToAll({ title: "Supervision", body: "Les notifications fonctionnent ✅", url: "/" });
  res.json({ ok: true });
});
