import { env } from "../../config/env";
import { raiseAlert, resolveAlert } from "../alerts/alerts.service";

/**
 * Dépenses Claude : rapport de coûts de l'API Admin Anthropic
 * (GET /v1/organizations/cost_report, appel HTTP direct : il n'existe pas
 * dans les SDK). Montants en centimes de dollar, chaînes décimales ; un
 * compartiment par jour (UTC). Données disponibles environ 5 minutes après
 * les appels ; une interrogation par minute au plus.
 */

interface CostResult {
  amount: string;
  currency: string;
  description: string | null;
  model: string | null;
  cost_type: string | null;
  token_type: string | null;
  workspace_id: string | null;
}

interface CostBucket {
  starting_at: string;
  ending_at: string;
  results: CostResult[];
}

export interface CostSummary {
  configured: boolean;
  budgetUsd: number | null;
  monthToDateUsd: number;
  todayUsd: number;
  yesterdayUsd: number;
  /** [début du jour (ms), dollars] sur 30 jours. */
  daily: [number, number][];
  byModel: { model: string; usd: number }[];
  byWorkspace: { workspace: string; usd: number }[];
  error?: string;
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${env.anthropicAdminApiUrl}${path}`, {
    headers: { "x-api-key": env.anthropicAdminKey, "anthropic-version": "2023-06-01", "User-Agent": "Supervision/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 200);
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      // Réponse non JSON : le début du texte suffit.
    }
    throw new Error(`Anthropic a répondu ${res.status} : ${message}`);
  }
  return JSON.parse(text) as T;
}

/** Libellé lisible d'un modèle ou d'un type de coût. */
function modelLabel(r: CostResult): string {
  if (r.model) return r.model;
  if (r.cost_type === "web_search") return "Recherche web";
  if (r.cost_type === "code_execution") return "Exécution de code";
  if (r.cost_type === "session_usage") return "Agents gérés (sessions)";
  return r.description ?? "Autre";
}

/** Agrège les compartiments du rapport (fonction pure, testée). */
export function summarize(buckets: CostBucket[], now = new Date(), workspaceNames: Record<string, string> = {}) {
  const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = dayStart(now);
  const yesterday = today - 86_400_000;
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const daily = new Map<number, number>();
  const byModel = new Map<string, number>();
  const byWorkspace = new Map<string, number>();
  let monthToDate = 0;
  for (const b of buckets) {
    const t = Date.parse(b.starting_at);
    if (t > now.getTime()) continue; // journée à venir (fenêtre demandée jusqu'à la fin de demain)
    let total = 0;
    for (const r of b.results) {
      const usd = Number(r.amount) / 100;
      if (!Number.isFinite(usd)) continue;
      total += usd;
      if (t >= monthStart) {
        byModel.set(modelLabel(r), (byModel.get(modelLabel(r)) ?? 0) + usd);
        const ws = r.workspace_id ? (workspaceNames[r.workspace_id] ?? r.workspace_id) : "Espace par défaut";
        byWorkspace.set(ws, (byWorkspace.get(ws) ?? 0) + usd);
      }
    }
    daily.set(t, (daily.get(t) ?? 0) + total);
    if (t >= monthStart) monthToDate += total;
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  const sorted = (m: Map<string, number>) => [...m.entries()].map(([k, v]) => ({ k, v: round(v) })).sort((a, b) => b.v - a.v);
  return {
    monthToDateUsd: round(monthToDate),
    todayUsd: round(daily.get(today) ?? 0),
    yesterdayUsd: round(daily.get(yesterday) ?? 0),
    daily: [...daily.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => [t, round(v)] as [number, number]),
    byModel: sorted(byModel).map(({ k, v }) => ({ model: k, usd: v })),
    byWorkspace: sorted(byWorkspace).map(({ k, v }) => ({ workspace: k, usd: v })),
  };
}

let cache: { at: number; data: CostSummary } | null = null;

/**
 * Fenêtre demandée (v0.24.1) : 30 jours dont aujourd'hui, et `ending_at` à la fin de demain. Sans `ending_at`, le rapport
 * ne renvoie que les journées terminées : la journée en cours manquait (le jour même, la Supervision affichait 0 $ et
 * un mois en retard de toutes les dépenses du jour, par exemple 52 $ au lieu de 83 $ dans la Console).
 */
export function costWindow(now = new Date()): { start: Date; end: Date } {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { start: new Date(today - 29 * 86_400_000), end: new Date(today + 2 * 86_400_000) };
}

async function fetchBuckets(start: Date, end: Date | null): Promise<CostBucket[]> {
  const buckets: CostBucket[] = [];
  let page: string | null = null;
  for (let i = 0; i < 5; i++) {
    const params = new URLSearchParams({ starting_at: start.toISOString(), bucket_width: "1d", limit: "31" });
    if (end) params.set("ending_at", end.toISOString());
    params.append("group_by[]", "description");
    params.append("group_by[]", "workspace_id");
    if (page) params.set("page", page);
    const res: { data: CostBucket[]; has_more: boolean; next_page: string | null } = await adminGet(`/cost_report?${params.toString()}`);
    buckets.push(...res.data);
    if (!res.has_more || !res.next_page) break;
    page = res.next_page;
  }
  return buckets;
}
/** Dépenses des 31 derniers jours (gardées 10 minutes en mémoire ; `fresh` relit Anthropic sans attendre). */
export async function getCosts(fresh = false): Promise<CostSummary> {
  const empty = { monthToDateUsd: 0, todayUsd: 0, yesterdayUsd: 0, daily: [], byModel: [], byWorkspace: [] };
  const budgetUsd = env.claudeMonthlyBudgetUsd || null;
  if (!env.anthropicAdminKey) return { configured: false, budgetUsd, ...empty };
  if (!fresh && cache && Date.now() - cache.at < 10 * 60_000) return cache.data;
  try {
    const now = new Date();
    const { start, end } = costWindow(now);
    // Avec la journée en cours ; si Anthropic refuse `ending_at`, on retombe sur la demande d'avant (journées terminées seulement).
    const buckets = await fetchBuckets(start, end).catch(() => fetchBuckets(new Date(start.getTime() - 86_400_000), null));
    // Noms des espaces de travail (facultatif : identifiants sinon).
    const names: Record<string, string> = {};
    await adminGet<{ data: { id: string; name: string }[] }>("/workspaces?limit=100")
      .then((r) => r.data.forEach((w) => (names[w.id] = w.name)))
      .catch(() => undefined);
    const data: CostSummary = { configured: true, budgetUsd, ...summarize(buckets, now, names) };
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    return { configured: true, budgetUsd, ...empty, error: (err as Error).message };
  }
}

/** Alerte de budget mensuel (80 % puis 100 %), rattachée à la supervision elle-même. */
export async function watchBudget(): Promise<void> {
  if (!env.anthropicAdminKey || !env.claudeMonthlyBudgetUsd) return;
  const c = await getCosts();
  if (c.error) return;
  const pct = (c.monthToDateUsd / env.claudeMonthlyBudgetUsd) * 100;
  const month = new Date().toISOString().slice(0, 7);
  const fp = `claude-budget:${month}`;
  if (pct >= 80) {
    await raiseAlert({
      appKey: "claude",
      kind: "app",
      severity: pct >= 100 ? "critical" : "warning",
      title: `Dépenses Claude : ${c.monthToDateUsd.toFixed(2).replace(".", ",")} $ ce mois-ci (${Math.round(pct)} % du budget)`,
      detail: `Budget mensuel : ${env.claudeMonthlyBudgetUsd} $. Détail par modèle et par espace de travail dans la page « Claude ».`,
      fingerprint: fp,
    });
  } else {
    await resolveAlert("claude", fp, "Dépenses Claude revenues sous 80 % du budget");
  }
}

export function startCostWatcher(): void {
  if (!env.monitorEnabled) return;
  setTimeout(() => void watchBudget().catch(() => undefined), 120_000);
  setInterval(() => void watchBudget().catch((err) => console.error("[claude]", (err as Error).message)), 60 * 60_000);
}
