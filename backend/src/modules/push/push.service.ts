import webpush from "web-push";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";

let vapidPublicKey: string | null = null;

/**
 * Sujet des notifications : doit être un vrai mailto: ou une vraie URL,
 * sinon Apple (Safari/iOS) refuse les envois.
 */
export function vapidSubject(): string {
  if (env.vapidSubject) return env.vapidSubject;
  if (env.publicUrl.startsWith("https://")) return env.publicUrl;
  if (env.adminEmail) return `mailto:${env.adminEmail}`;
  return "mailto:supervision@localhost";
}

/**
 * Prépare les notifications push. Les clés VAPID viennent des variables
 * d'environnement si elles sont définies ; sinon elles sont générées au
 * premier démarrage et gardées en base (table Setting) : rien à saisir dans
 * Render, et les abonnements des téléphones restent valables d'un
 * redémarrage à l'autre.
 */
export async function initPush(): Promise<void> {
  let keys = env.vapidPublicKey && env.vapidPrivateKey ? { publicKey: env.vapidPublicKey, privateKey: env.vapidPrivateKey } : null;
  if (!keys) {
    const stored = await prisma.setting.findUnique({ where: { key: "vapid" } });
    if (stored) {
      keys = JSON.parse(stored.value) as { publicKey: string; privateKey: string };
    } else {
      keys = webpush.generateVAPIDKeys();
      await prisma.setting.create({ data: { key: "vapid", value: JSON.stringify(keys) } });
      console.log("[push] clés de notification générées et enregistrées en base");
    }
  }
  try {
    webpush.setVapidDetails(vapidSubject(), keys.publicKey, keys.privateKey);
    vapidPublicKey = keys.publicKey;
  } catch (err) {
    // Les notifications restent coupées, le reste de la supervision démarre.
    console.error("[push] notifications désactivées :", (err as Error).message);
  }
}

export function isPushConfigured(): boolean {
  return vapidPublicKey !== null;
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey;
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
