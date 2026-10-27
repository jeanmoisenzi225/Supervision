import webpush from "web-push";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";

export function isPushConfigured(): boolean {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.vapidSubject);
}

if (isPushConfigured()) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export async function sendPushToAll(message: PushMessage): Promise<void> {
  if (!isPushConfigured()) return;
  const subs = await prisma.pushSubscription.findMany();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message));
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Abonnement expiré ou révoqué côté navigateur : on le retire.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
        } else {
          console.error("[push]", status ?? err);
        }
      }
    })
  );
}
