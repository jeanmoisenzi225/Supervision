import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { parseSections, parseStories, type BacklogItem } from "./parse";

/** Backlogs suivis : un par application, lu dans son dépôt GitHub. */
export const BACKLOG_SOURCES = [
  { key: "mga", label: "MGA", repo: "jeanmoisenzi225/Mon-Garage-Auto", branch: "main", path: "BACKLOG.md", form: "sections" },
  { key: "procedia", label: "Procedia", repo: "jeanmoisenzi225/Procedia", branch: "njmdev/procedia", path: "BACKLOG.md", form: "sections" },
  { key: "yiri", label: "Yiri Invest", repo: "jeanmoisenzi225/JmDev", branch: "main", path: "agent-whatsapp-brvm/ROADMAP.md", form: "sections" },
  { key: "my-family", label: "My Family", repo: "jeanmoisenzi225/My-Family", branch: "main", path: "docs/BACKLOG.md", form: "stories" },
  { key: "supervision", label: "Supervision", repo: "jeanmoisenzi225/Supervision", branch: "main", path: "BACKLOG.md", form: "sections" },
] as const;

export type BacklogSource = (typeof BACKLOG_SOURCES)[number];

async function fetchMarkdown(src: BacklogSource): Promise<string> {
  const url = `https://api.github.com/repos/${src.repo}/contents/${src.path}?ref=${encodeURIComponent(src.branch)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      "User-Agent": "Supervision",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(env.githubToken ? { Authorization: `Bearer ${env.githubToken}` } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) throw new Error(env.githubToken ? "Fichier ou dépôt introuvable (ou jeton sans accès à ce dépôt)" : "Dépôt privé : jeton GitHub (GITHUB_TOKEN) nécessaire");
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status}`);
  return res.text();
}

const lastSync = new Map<string, { at: Date; error: string | null; count: number }>();

/**
 * Lit le backlog d'une appli et met à jour la base : nouveaux chantiers,
 * changements de statut (historique), chantiers disparus.
 */
export async function syncSource(src: BacklogSource, now = new Date()): Promise<{ changes: number }> {
  try {
    const md = await fetchMarkdown(src);
    const items: BacklogItem[] = src.form === "stories" ? parseStories(md) : parseSections(md);
    const existing = new Map((await prisma.backlogItem.findMany({ where: { source: src.key } })).map((i) => [i.key, i]));
    let changes = 0;
    // Première lecture du backlog : pas d'événement pour chaque chantier existant.
    const firstRead = existing.size === 0;
    for (const [position, item] of items.entries()) {
      const prev = existing.get(item.key);
      const data = {
        number: item.number,
        title: item.title,
        status: item.status,
        versions: item.versions,
        grp: item.group,
        priority: item.priority,
        subtasks: item.subtasks as unknown as Prisma.InputJsonValue,
        body: item.body,
        position,
        removedAt: null,
      };
      if (!prev) {
        await prisma.backlogItem.create({ data: { source: src.key, key: item.key, ...data, firstSeenAt: now, statusChangedAt: now } });
        if (!firstRead) {
          await prisma.backlogEvent.create({ data: { source: src.key, key: item.key, title: item.title, from: null, to: item.status, at: now } });
          changes++;
        }
      } else {
        const statusChanged = prev.status !== item.status;
        await prisma.backlogItem.update({ where: { id: prev.id }, data: { ...data, ...(statusChanged ? { statusChangedAt: now } : {}) } });
        if (statusChanged) {
          await prisma.backlogEvent.create({ data: { source: src.key, key: item.key, title: item.title, from: prev.status, to: item.status, at: now } });
          changes++;
        }
      }
      existing.delete(item.key);
    }
    // Chantiers qui ne figurent plus dans le fichier.
    for (const gone of existing.values()) {
      if (!gone.removedAt) await prisma.backlogItem.update({ where: { id: gone.id }, data: { removedAt: now } });
    }
    lastSync.set(src.key, { at: now, error: null, count: items.length });
    return { changes };
  } catch (err) {
    lastSync.set(src.key, { at: now, error: (err as Error).message, count: lastSync.get(src.key)?.count ?? 0 });
    throw err;
  }
}

export async function syncAll(): Promise<void> {
  for (const src of BACKLOG_SOURCES) await syncSource(src).catch((err) => console.error(`[backlog] ${src.key} : ${(err as Error).message}`));
}

export function startBacklogSync(): void {
  if (!env.monitorEnabled) return;
  setTimeout(() => void syncAll(), 30_000);
  setInterval(() => void syncAll(), 15 * 60_000);
}

const ORDER = ["in_progress", "waiting", "todo", "done", "dropped", "info"];

export async function backlogOverview() {
  const items = await prisma.backlogItem.findMany({ where: { removedAt: null }, select: { source: true, status: true } });
  return BACKLOG_SOURCES.map((src) => {
    const counts: Record<string, number> = {};
    for (const i of items.filter((x) => x.source === src.key)) counts[i.status] = (counts[i.status] ?? 0) + 1;
    const sync = lastSync.get(src.key) ?? null;
    return { key: src.key, label: src.label, repo: src.repo, path: src.path, counts, lastSync: sync };
  });
}

export async function backlogOf(source: string) {
  const [items, events] = await Promise.all([
    prisma.backlogItem.findMany({ where: { source, removedAt: null }, orderBy: { position: "asc" } }),
    prisma.backlogEvent.findMany({ where: { source }, orderBy: { at: "desc" }, take: 30 }),
  ]);
  const src = BACKLOG_SOURCES.find((s) => s.key === source);
  return {
    source: src ? { key: src.key, label: src.label, repo: src.repo, branch: src.branch, path: src.path } : null,
    lastSync: lastSync.get(source) ?? null,
    items: items
      .map(({ body: _b, ...i }) => i)
      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.position - b.position),
    events: events.map((e) => ({ ...e, id: e.id.toString() })),
  };
}

export async function backlogItem(source: string, key: string) {
  const item = await prisma.backlogItem.findUnique({ where: { source_key: { source, key } } });
  if (!item) return null;
  const events = await prisma.backlogEvent.findMany({ where: { source, key }, orderBy: { at: "desc" }, take: 20 });
  return { ...item, events: events.map((e) => ({ ...e, id: e.id.toString() })) };
}

export async function recentEvents(limit = 30) {
  const events = await prisma.backlogEvent.findMany({ orderBy: { at: "desc" }, take: limit });
  return events.map((e) => ({ ...e, id: e.id.toString() }));
}
