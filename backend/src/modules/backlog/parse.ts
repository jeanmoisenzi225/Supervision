/**
 * Lecture des backlogs Markdown des dépôts (fonctions pures, testées).
 *
 * Deux formes :
 * - « sections » (MGA, Procedia, Supervision, ROADMAP de Yiri) : un chantier
 *   par titre `## N. Titre`, avec cases à cocher `- [x]` / `- [ ]` facultatives ;
 * - « stories » (My Family) : des user stories `**CODE — Titre**` rangées sous
 *   des epics `### EPIC … (P0)`.
 *
 * Statut déduit, du plus explicite au plus implicite :
 * 1. marqueur dans le titre : ℹ️ / « (info) » → rubrique d'information (pas une tâche) ;
 *    ✅ / « fait » / « code prêt » → terminé ;
 *    ❌ / « abandonné » / « retiré » → abandonné ; 🚧 / « en cours » → en cours ;
 *    ⏸ / « en attente » / « en pause » / « à étudier » / « à évaluer » / « à trancher » → en attente ;
 * 2. cases à cocher : toutes cochées → terminé, une partie → en cours, aucune → à faire ;
 * 3. ✅ dans le corps du chantier (sous-tâches livrées) → en cours ;
 * 4. sinon → à faire.
 */

export type BacklogStatus = "done" | "in_progress" | "waiting" | "todo" | "dropped" | "info";

export interface BacklogItem {
  key: string;
  number: string | null;
  title: string;
  status: BacklogStatus;
  /** Versions citées dans le titre (ex. v0.87.0). */
  versions: string[];
  /** Regroupement (epic) pour la forme « stories ». */
  group: string | null;
  priority: string | null;
  subtasks: { text: string; done: boolean }[];
  /** Corps du chantier (Markdown brut, tronqué). */
  body: string;
}

const MAX_BODY = 6000;

function titleStatus(title: string): BacklogStatus | null {
  const t = title.toLowerCase();
  if (/ℹ️|\(info\)/.test(t)) return "info";
  if (/❌|abandonn/.test(t)) return "dropped";
  // ✅ prime sur les mots du titre (ex. « … bandeau retiré ✅ »).
  if (/✅|\bfait\b|code pr[êe]t|\bterminé/.test(t)) return "done";
  if (/\bretir[ée]/.test(t)) return "dropped";
  if (/🚧|en cours/.test(t)) return "in_progress";
  if (/⏸|en attente|en pause|à étudier|a etudier|à évaluer|a evaluer|à trancher|a trancher/.test(t)) return "waiting";
  return null;
}

/** Titre sans les marqueurs de statut ni la version entre parenthèses (affichés à part). */
function cleanTitle(title: string): string {
  return title
    .replace(/✅|🚧|⏸️?|❌|ℹ️/g, " ")
    .replace(/\s*\((?:v?\d+\.\d+\.\d+(?:\s*,\s*v?\d+\.\d+\.\d+)*)\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function parseSections(markdown: string): BacklogItem[] {
  const lines = markdown.split("\n");
  const items: BacklogItem[] = [];
  let current: { heading: string; body: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const m = /^(\d+(?:\s*(?:bis|ter|quater))?[a-z]?)\.\s+(.*)$/i.exec(current.heading);
    const number = m ? m[1].replace(/\s+/g, " ") : null;
    const rawTitle = m ? m[2] : current.heading;
    const body = current.body.join("\n").trim();
    const subtasks = [...body.matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/gm)].map((x) => ({ done: x[1].toLowerCase() === "x", text: x[2].replace(/\*\*/g, "").trim().slice(0, 200) }));
    let status = titleStatus(rawTitle);
    if (!status && subtasks.length) {
      const done = subtasks.filter((s) => s.done).length;
      status = done === subtasks.length ? "done" : done > 0 ? "in_progress" : "todo";
    }
    if (!status && /✅/.test(body)) status = "in_progress";
    const versions = [...new Set(rawTitle.match(/v?\d+\.\d+\.\d+/g) ?? [])].map((v) => (v.startsWith("v") ? v : `v${v}`));
    const title = cleanTitle(rawTitle);
    items.push({
      key: number ? `n${number.replace(/\s+/g, "")}` : slug(title),
      number,
      title,
      status: status ?? "todo",
      versions,
      group: null,
      priority: null,
      subtasks,
      body: body.slice(0, MAX_BODY),
    });
  };
  for (const line of lines) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h && !line.startsWith("###")) {
      flush();
      current = { heading: h[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  // Rubriques de présentation sans chantier (titre non numéroté et sans contenu de tâche) : écartées.
  return items.filter((i) => i.number !== null || i.subtasks.length > 0);
}

export function parseStories(markdown: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  let group: string | null = null;
  let priority: string | null = null;
  let current: { code: string; title: string; body: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const body = current.body.join("\n").trim();
    const subtasks = [...body.matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/gm)].map((x) => ({ done: x[1].toLowerCase() === "x", text: x[2].trim().slice(0, 200) }));
    let status = titleStatus(current.title);
    if (!status && subtasks.length) {
      const done = subtasks.filter((s) => s.done).length;
      status = done === subtasks.length ? "done" : done > 0 ? "in_progress" : "todo";
    }
    items.push({ key: slug(current.code), number: current.code, title: cleanTitle(current.title), status: status ?? "todo", versions: [], group, priority, subtasks, body: body.slice(0, MAX_BODY) });
    current = null;
  };
  for (const line of markdown.split("\n")) {
    const epic = /^###\s+(.+)$/.exec(line);
    const story = /^\*\*([A-Z]{2,6}-\d{1,3})\s+[—–-]\s+(.+?)\*\*\s*$/.exec(line.trim());
    if (/^##\s/.test(line) && !line.startsWith("###")) {
      flush();
      group = null;
      priority = null;
    } else if (epic) {
      flush();
      group = epic[1].replace(/\s*\((P\d(?:\/P\d)*)\)\s*$/, "").trim();
      priority = /\((P\d(?:\/P\d)*)\)\s*$/.exec(epic[1])?.[1] ?? null;
    } else if (story) {
      flush();
      current = { code: story[1], title: story[2], body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return items;
}
