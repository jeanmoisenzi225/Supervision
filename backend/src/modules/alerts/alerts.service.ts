import { prisma } from "../../db/prisma";
import { isPaused } from "../pause/pause.service";
import { sendPushToAll } from "../push/push.service";

export interface AlertInput {
  appKey: string;
  kind: "down" | "error" | "app";
  severity: "critical" | "warning" | "info";
  title: string;
  detail?: string | null;
  fingerprint: string;
}

/**
 * Ouvre une alerte, ou incrémente celle déjà ouverte avec la même empreinte
 * (une erreur répétée 200 fois reste une seule alerte, avec son compteur).
 */
export async function raiseAlert(input: AlertInput): Promise<void> {
  // Supervision coupée sur cette appli (maintenance) : ni alerte ni notification.
  if (await isPaused(input.appKey)) return;
  const existing = await prisma.alert.findFirst({
    where: { appKey: input.appKey, fingerprint: input.fingerprint, status: { in: ["open", "acknowledged"] } },
  });
  if (existing) {
    await prisma.alert.update({
      where: { id: existing.id },
      data: { count: { increment: 1 }, lastSeenAt: new Date(), detail: input.detail ?? existing.detail },
    });
    return;
  }
  const alert = await prisma.alert.create({ data: { ...input, detail: input.detail ?? null } });
  if (input.severity !== "info") {
    await sendPushToAll({
      title: input.severity === "critical" ? `🔴 ${input.title}` : `🟠 ${input.title}`,
      body: input.detail ?? "",
      url: `/supervision/alertes?id=${alert.id}`,
      tag: `${input.appKey}:${input.fingerprint}`,
    });
  }
}

export async function resolveAlert(appKey: string, fingerprint: string, message: string): Promise<void> {
  const { count } = await prisma.alert.updateMany({
    where: { appKey, fingerprint, status: { in: ["open", "acknowledged"] } },
    data: { status: "resolved", resolvedAt: new Date() },
  });
  if (count > 0) {
    await sendPushToAll({ title: `🟢 ${message}`, body: "Incident clos automatiquement", url: "/supervision/alertes", tag: `${appKey}:${fingerprint}` });
  }
}
