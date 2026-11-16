import { apps } from "../../config/apps";
import { prisma } from "../../db/prisma";
import { getTimeline, type TimelineItem } from "../timeline/timeline.service";

// Rejeu (v0.39.0) : l'état de chaque appli, case par case, sur les dernières heures, avec les événements
// (alertes, redémarrages, mises en ligne) : de quoi rejouer ce qui s'est passé, à l'écran.
export type CellState = "ok" | "w" | "b" | null;
export interface Cell {
  /** ok = toutes les vérifications réussies ; w = certaines ont échoué ; b = toutes ont échoué ; null = aucun relevé. */
  s: CellState;
  /** Temps de réponse moyen de la case (ms). */
  ms: number | null;
  /** Mémoire réelle moyenne de la case (Mo), pour les applis qui l'exposent. */
  mem: number | null;
}

/** Découpe les relevés en cases de `stepMs` (fonction pure, testée). */
export function buildCells(checks: { at: number; ok: boolean; latencyMs: number | null }[], samples: { at: number; ok: boolean; rssMb: number | null }[], from: number, stepMs: number, n: number): Cell[] {
  const cells: { c: number; f: number; lat: number[]; mem: number[] }[] = Array.from({ length: n }, () => ({ c: 0, f: 0, lat: [], mem: [] }));
  const idx = (at: number) => Math.floor((at - from) / stepMs);
  for (const r of checks) {
    const i = idx(r.at);
    if (i < 0 || i >= n) continue;
    cells[i].c++;
    if (!r.ok) cells[i].f++;
    else if (r.latencyMs !== null) cells[i].lat.push(r.latencyMs);
  }
  for (const s of samples) {
    const i = idx(s.at);
    if (i < 0 || i >= n || !s.ok || s.rssMb === null) continue;
    cells[i].mem.push(s.rssMb);
  }
  const avg = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
  return cells.map((x) => ({ s: x.c === 0 ? null : x.f === 0 ? "ok" : x.f === x.c ? "b" : "w", ms: avg(x.lat), mem: avg(x.mem) }));
}

export interface ReplayEvent {
  at: number;
  appKey: string;
  kind: TimelineItem["kind"];
  level: TimelineItem["level"];
  title: string;
  detail?: string;
}

const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 60_000;

export async function getReplay(hours: number, stepMin: number) {
  const key = `${hours}:${stepMin}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const stepMs = stepMin * 60_000;
  const n = Math.ceil((hours * 3600_000) / stepMs);
  const to = Math.ceil(Date.now() / stepMs) * stepMs;
  const from = to - n * stepMs;
  const [checks, samples, timelines] = await Promise.all([
    prisma.checkResult.findMany({ where: { at: { gte: new Date(from) } }, select: { appKey: true, at: true, ok: true, latencyMs: true } }),
    prisma.runtimeSample.findMany({ where: { at: { gte: new Date(from) } }, select: { appKey: true, at: true, ok: true, rssMb: true } }),
    Promise.allSettled(apps.map((a) => getTimeline(a, hours))),
  ]);
  const events: ReplayEvent[] = [];
  timelines.forEach((t, i) => {
    if (t.status !== "fulfilled") return;
    for (const it of t.value.items) if (it.at >= from) events.push({ at: it.at, appKey: apps[i].key, kind: it.kind, level: it.level, title: it.title, detail: it.detail });
  });
  events.sort((a, b) => a.at - b.at);
  const data = {
    from,
    to,
    stepMin,
    n,
    apps: apps.map((a) => ({
      key: a.key,
      cells: buildCells(checks.filter((c) => c.appKey === a.key).map((c) => ({ at: c.at.getTime(), ok: c.ok, latencyMs: c.latencyMs })), samples.filter((s) => s.appKey === a.key).map((s) => ({ at: s.at.getTime(), ok: s.ok, rssMb: s.rssMb })), from, stepMs, n),
    })),
    events,
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
