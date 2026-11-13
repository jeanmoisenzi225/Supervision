import { apps } from "../../config/apps";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { renderFetch, resolveServiceIds } from "../actions/render";
import { isPaused } from "../pause/pause.service";
import type { Level } from "../logs/ingest";

// Journaux de la plateforme Render en quasi-direct (v0.30.0) : toutes les 15 secondes, la Supervision
// lit la sortie standard de chaque service (lignes `[mémoire]`, démarrage, erreurs non transmises par
// l'appli) et les range dans la page Journaux avec la source « render ».
const ANSI = /\u001b\[[0-9;]*[A-Za-z]|\u001b\(B/g;

export function cleanLine(message: string): string {
  return message.replace(ANSI, "").replace(/\s+$/g, "");
}

/** Niveau déduit du texte d'une ligne de sortie (fonction pure, testée). */
export function levelOf(line: string, labels: Record<string, string> = {}): Level {
  const l = labels.level?.toLowerCase();
  if (l === "error" || l === "fatal") return l === "fatal" ? "fatal" : "error";
  if (l === "warn" || l === "warning") return "warn";
  if (/\b(fatal|unhandled|panic|out of memory|oom)\b/i.test(line)) return "fatal";
  if (/\b(error|erreur|exception|échec|failed|ECONNREFUSED|ETIMEDOUT)\b/i.test(line) && !/^\[mémoire\]/.test(line)) return "error";
  if (/ALERTE|\bwarn(ing)?\b|avertissement/i.test(line)) return "warn";
  return "info";
}

interface RenderLog {
  timestamp: string;
  message: string;
  labels?: { name: string; value: string }[];
}

const owners = new Map<string, string>();
const lastSeen = new Map<string, number>();

async function ownerOf(serviceId: string): Promise<string> {
  const hit = owners.get(serviceId);
  if (hit) return hit;
  const s = await renderFetch<{ ownerId: string }>(`/services/${serviceId}`);
  owners.set(serviceId, s.ownerId);
  return s.ownerId;
}

export async function pullRenderLogs(now = new Date()): Promise<number> {
  if (!env.renderApiKey) return 0;
  let stored = 0;
  for (const app of apps) {
    if (await isPaused(app.key)) continue;
    let ids: string[];
    try {
      ids = await resolveServiceIds(app);
    } catch {
      continue;
    }
    for (const id of ids) {
      const since = lastSeen.get(id) ?? now.getTime() - 120_000;
      const params = new URLSearchParams({
        ownerId: await ownerOf(id),
        resource: id,
        startTime: new Date(since + 1).toISOString(),
        endTime: now.toISOString(),
        direction: "forward",
        limit: "100",
      });
      params.append("type", "app");
      const res = await renderFetch<{ logs?: RenderLog[] }>(`/logs?${params.toString()}`);
      const logs = (res.logs ?? []).filter((l) => l.message?.trim());
      if (logs.length) lastSeen.set(id, Math.max(...logs.map((l) => new Date(l.timestamp).getTime())));
      else lastSeen.set(id, lastSeen.get(id) ?? since);
      if (!logs.length) continue;
      await prisma.logEntry.createMany({
        data: logs.map((l) => {
          const message = cleanLine(l.message).slice(0, 4000);
          const labels = Object.fromEntries((l.labels ?? []).map((x) => [x.name, x.value]));
          return { appKey: app.key, at: new Date(l.timestamp), level: levelOf(message, labels), source: "render", message, context: { service: id, instance: labels.instance ?? null } };
        }),
      });
      stored += logs.length;
    }
  }
  return stored;
}

let busy = false;
export function startRenderLogWatcher(): void {
  if (!env.monitorEnabled || !env.renderApiKey) return;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await pullRenderLogs();
    } catch (e) {
      console.error("[journaux render]", (e as Error).message);
    } finally {
      busy = false;
    }
  };
  setTimeout(() => void tick(), 25_000);
  setInterval(() => void tick(), 15_000);
}
