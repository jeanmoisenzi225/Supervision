import type { AppTarget } from "../../config/apps";
import { prisma } from "../../db/prisma";
import { raiseAlert } from "../alerts/alerts.service";
import { isPaused } from "../pause/pause.service";

/**
 * Alerte d'activité (v0.54.0, demandée le 2026-11-25 pour Procedia) : prévient dès que des utilisateurs se servent de l'appli
 * (par exemple quand ils l'utilisent sans avoir réglé). L'appli indique dans son rapport `runtime` les comptes actifs récemment
 * (`activity.users`) ; une alerte s'ouvre pour chaque compte qui reprend son activité, avec une notification, et se referme
 * sans bruit après 30 minutes d'inactivité. Désactivable à tout moment, appli par appli (réglage `activityAlert:<appli>`).
 */
export interface ActiveUser {
  id: string;
  name: string;
  role: string;
  lastSeenAt: string;
}

export const INACTIVITY_MS = 30 * 60_000;
const ROLE: Record<string, string> = { SUPER_ADMIN: "super administrateur", ADMIN: "administrateur", CONSULTANT: "consultant" };
const fp = (appKey: string, userId: string) => `activity:${appKey}:${userId}`;
const prefix = (appKey: string) => `activity:${appKey}:`;

/** Applis dont le rapport fournit l'activité (vu au dernier relevé). */
const supported = new Set<string>();
export const supportsActivity = (appKey: string) => supported.has(appKey);

let settingCache = new Map<string, { at: number; on: boolean }>();
const key = (appKey: string) => `activityAlert:${appKey}`;

/** L'alerte est active par défaut ; seule la valeur « off » la coupe. */
export async function isActivityAlertOn(appKey: string): Promise<boolean> {
  const hit = settingCache.get(appKey);
  if (hit && Date.now() - hit.at < 10_000) return hit.on;
  const row = await prisma.setting.findUnique({ where: { key: key(appKey) } });
  const on = row?.value !== "off";
  settingCache.set(appKey, { at: Date.now(), on });
  return on;
}

export async function setActivityAlert(appKey: string, on: boolean): Promise<void> {
  await prisma.setting.upsert({ where: { key: key(appKey) }, create: { key: key(appKey), value: on ? "on" : "off" }, update: { value: on ? "on" : "off" } });
  settingCache = new Map();
  // Coupée : les alertes d'activité encore ouvertes sont refermées tout de suite.
  if (!on) {
    await closeAlerts(appKey, () => true);
    for (const k of [...raisedAt.keys()]) if (k.startsWith(prefix(appKey))) raisedAt.delete(k);
  }
}

/** Referme sans notification les alertes d'activité ouvertes dont l'utilisateur répond au filtre. */
async function closeAlerts(appKey: string, filter: (userId: string) => boolean): Promise<number> {
  const open = await prisma.alert.findMany({ where: { appKey, fingerprint: { startsWith: prefix(appKey) }, status: { in: ["open", "acknowledged"] } }, select: { id: true, fingerprint: true } });
  const ids = open.filter((a) => filter(a.fingerprint.slice(prefix(appKey).length))).map((a) => a.id);
  if (ids.length) await prisma.alert.updateMany({ where: { id: { in: ids } }, data: { status: "resolved", resolvedAt: new Date() } });
  return ids.length;
}

/** Dernier relevé transmis à l'alerte (évite une écriture toutes les 15 s par compte actif). */
const raisedAt = new Map<string, number>();
const REFRESH_MS = 5 * 60_000;

const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Appelée à chaque relevé en direct de l'appli. */
export async function watchActivity(app: AppTarget, report: { activity?: { users?: ActiveUser[] } }, now = new Date()): Promise<void> {
  if (!report.activity || !Array.isArray(report.activity.users)) return;
  supported.add(app.key);
  if (!(await isActivityAlertOn(app.key)) || (await isPaused(app.key))) return;
  const active = report.activity.users.filter((u) => now.getTime() - Date.parse(u.lastSeenAt) < INACTIVITY_MS);
  const activeIds = new Set(active.map((u) => u.id));
  for (const u of active) {
    if (now.getTime() - (raisedAt.get(fp(app.key, u.id)) ?? 0) < REFRESH_MS) continue;
    raisedAt.set(fp(app.key, u.id), now.getTime());
    const seen = new Date(u.lastSeenAt);
    await raiseAlert({
      appKey: app.key,
      kind: "app",
      severity: "warning",
      title: `${app.name} — activité : ${u.name}`,
      detail: `${u.name} (${ROLE[u.role] ?? u.role.toLowerCase()}) utilise ${app.name}. Dernière action à ${hhmm(seen)}. Vous pouvez désactiver cette alerte à tout moment (page de l'appli, onglet Administration).`,
      fingerprint: fp(app.key, u.id),
    });
  }
  const closed = await closeAlerts(app.key, (userId) => !activeIds.has(userId));
  if (closed) for (const k of [...raisedAt.keys()]) if (k.startsWith(prefix(app.key)) && !activeIds.has(k.slice(prefix(app.key).length))) raisedAt.delete(k);
}
