import { prisma } from "../../db/prisma";
import { apps, type AppTarget } from "../../config/apps";
import { callApp } from "../actions/actions.routes";
import { isPaused } from "../pause/pause.service";
import { lastBuckets } from "./units";

/**
 * Taille réelle de la base d'une appli (v0.43.0, demandé le 2026-11-20).
 *
 * PostgreSQL ne rend pas au disque la place des lignes supprimées : après la suppression de documents, la taille
 * mesurée par Render reste au niveau du pic, même si les données utiles ont baissé. L'appli (rapport signé `database`)
 * dit combien elle garde réellement ; la Supervision le relève toutes les 5 minutes pour tracer la courbe en direct,
 * sans jamais compacter la base.
 */
export interface RealSizeReport {
  at: string;
  diskBytes: number;
  liveBytes: number;
  reusableBytes: number;
  documents: { count: number; storedBytes: number; tableBytes: number };
}

export const liveKey = (appKey: string) => `dbreal:${appKey}`;
export const diskKey = (appKey: string) => `dbdisk:${appKey}`;

const SAMPLE_EVERY_MS = 5 * 60_000;
/** Applis qui ne proposent pas ce rapport (404) : réessayées toutes les heures. */
const unsupported = new Map<string, number>();

/** Relève la taille réelle d'une appli et la garde (deux relevés : données utiles et disque occupé). */
export async function sampleRealSize(app: AppTarget, now = new Date()): Promise<RealSizeReport | null> {
  if (!app.adminUrl || !app.adminToken) return null;
  if (now.getTime() < (unsupported.get(app.key) ?? 0)) return null;
  let report: RealSizeReport;
  try {
    report = await callApp<RealSizeReport>(app, "/supervision/reports/database");
  } catch (err) {
    if (/répondu 404|Rapport inconnu/i.test((err as Error).message)) unsupported.set(app.key, now.getTime() + 3600_000);
    return null;
  }
  if (!Number.isFinite(report.liveBytes) || !Number.isFinite(report.diskBytes)) return null;
  await prisma.resourceSample.createMany({ data: [
    { key: liveKey(app.key), at: now, value: report.liveBytes },
    { key: diskKey(app.key), at: now, value: report.diskBytes },
  ] });
  return report;
}

/** Un moment où des documents ont été supprimés (regroupés par 10 minutes), pour les repères sur la courbe. */
export interface DeletionEvent { at: number; count: number; manual: number; auto: number }

/** Suppressions de documents des `days` derniers jours, lues dans le rapport de l'appli (vide si elle ne répond pas ou ne le fournit pas). */
export async function fetchDeletions(app: AppTarget, days: number, now = new Date()): Promise<DeletionEvent[]> {
  if (!app.adminUrl || !app.adminToken) return [];
  if (now.getTime() < (unsupported.get(app.key) ?? 0)) return [];
  try {
    const rep = await callApp<{ deletions?: { at: string; count: number; manual: number; auto: number }[] }>(app, `/supervision/reports/database?days=${Math.max(1, Math.min(90, Math.round(days)))}`);
    return (rep.deletions ?? [])
      .map((d) => ({ at: Date.parse(d.at), count: Number(d.count), manual: Number(d.manual) || 0, auto: Number(d.auto) || 0 }))
      .filter((d) => Number.isFinite(d.at) && Number.isFinite(d.count) && d.count > 0);
  } catch (err) {
    if (/répondu 404|Rapport inconnu/i.test((err as Error).message)) unsupported.set(app.key, now.getTime() + 3600_000);
    return [];
  }
}

export interface RealSizeSeries {
  /** Données encore utiles (octets) : suit les suppressions en direct. */
  live: [number, number][];
  /** Espace disque occupé (octets) : reste au pic tant que la base n'est pas compactée. */
  disk: [number, number][];
  latest: { at: number; liveBytes: number; diskBytes: number; reusableBytes: number } | null;
  /** Moments de suppression de documents sur la période (repères en direct sur la courbe). */
  deletions: DeletionEvent[];
}

/** Les deux courbes sur la période, ramenées à ~un point par pas de `resolution` secondes. */
export async function realSizeSeries(appKey: string, start: Date, resolution: number): Promise<RealSizeSeries | null> {
  const rows = await prisma.resourceSample.findMany({ where: { key: { in: [liveKey(appKey), diskKey(appKey)] }, at: { gte: start } }, orderBy: { at: "asc" }, select: { key: true, at: true, value: true } });
  const pts = (k: string) => rows.filter((r) => r.key === k).map((r) => [r.at.getTime(), r.value] as [number, number]);
  const live = pts(liveKey(appKey));
  if (live.length === 0) return null;
  const disk = pts(diskKey(appKey));
  const l = live[live.length - 1];
  const d = disk[disk.length - 1] ?? l;
  return {
    live: lastBuckets(live, resolution),
    disk: lastBuckets(disk, resolution),
    latest: { at: l[0], liveBytes: l[1], diskBytes: d[1], reusableBytes: Math.max(0, d[1] - l[1]) },
    deletions: [],
  };
}

let busy = false;
export function startRealSizeSampler(): void {
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const app of apps) {
        if (await isPaused(app.key)) continue;
        await sampleRealSize(app).catch((e) => console.error(`[taille réelle] ${app.key}`, (e as Error).message));
      }
    } finally {
      busy = false;
    }
  };
  setTimeout(() => void tick(), 25_000);
  setInterval(() => void tick(), SAMPLE_EVERY_MS);
}
