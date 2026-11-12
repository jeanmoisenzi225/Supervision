import { apps, type AppTarget } from "../../config/apps";
import { env } from "../../config/env";
import { listPostgres, listServices, matchPostgres, matchServices, type PostgresSummary, type ServiceSummary } from "../actions/render";
import { getCosts, type CostSummary } from "../costs/costs.service";
import { DB_STORAGE_USD_PER_GB, DISK_USD_PER_GB, PRICES_AS_OF, PRICES_SOURCE, computeUsd, postgresUsd } from "./prices";

/**
 * Facturation par appli (v0.17.0) : estimation mensuelle de l'hébergement Render
 * (offres des services et des bases, tarifs publics : voir prices.ts) et dépenses
 * Claude du mois en cours (rapport de coûts Anthropic, par espace de travail).
 */

export interface BillingLine {
  kind: "service" | "database" | "disk";
  name: string;
  /** Offre Render telle que renvoyée par l'API (ex. « 0.5c-512mb »). */
  plan: string;
  /** Dollars par mois ; null = offre inconnue de la table des tarifs. */
  usd: number | null;
  note?: string;
}

export interface BillingApp {
  key: string;
  name: string;
  render: { lines: BillingLine[]; usd: number; unknown: number };
  claude: { workspaces: { workspace: string; usd: number }[]; usd: number };
  totalUsd: number;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Lignes de facturation Render d'un ensemble de services et de bases (fonction pure, testée). */
export function renderLines(services: ServiceSummary[], dbs: PostgresSummary[]): BillingLine[] {
  const lines: BillingLine[] = [];
  for (const s of services) {
    const plan = s.plan ?? (s.type === "static_site" ? "site statique" : "inconnue");
    // Un service suspendu ne facture plus son instance ; son disque, lui, reste facturé.
    const usd = s.suspended ? 0 : computeUsd(s.type, s.plan);
    lines.push({ kind: "service", name: s.name, plan, usd, note: s.suspended ? "suspendu : instance non facturée" : usd === 0 ? (s.type === "static_site" ? "site statique gratuit" : "offre gratuite") : undefined });
    if (s.diskGB) lines.push({ kind: "disk", name: `Disque de ${s.name}`, plan: `${s.diskGB} Go`, usd: round(s.diskGB * DISK_USD_PER_GB), note: s.suspended ? "disque conservé, supposé facturé" : undefined });
  }
  for (const d of dbs) {
    const base = d.suspended ? 0 : postgresUsd(d.plan);
    lines.push({ kind: "database", name: d.name, plan: d.plan, usd: base, note: d.suspended ? "suspendue : instance non facturée" : base === 0 ? "offre gratuite (expire)" : undefined });
    if (d.diskSizeGB && base !== 0) lines.push({ kind: "disk", name: `Stockage de ${d.name}`, plan: `${d.diskSizeGB} Go`, usd: round(d.diskSizeGB * DB_STORAGE_USD_PER_GB) });
  }
  return lines;
}

export function sumLines(lines: BillingLine[]) {
  return { usd: round(lines.reduce((t, l) => t + (l.usd ?? 0), 0)), unknown: lines.filter((l) => l.usd === null).length };
}

type Target = Pick<AppTarget, "key" | "name" | "renderMatch" | "claudeWorkspaces">;

/** NJMDev lui-même (la Supervision) : ses services et sa base, et un éventuel espace Claude « NJMDev ». */
const NJMDEV: Target = { key: "njmdev", name: "NJMDev (Supervision)", renderMatch: { names: [/^supervision/i], hosts: [] }, claudeWorkspaces: [/njm|supervision/i] };

/** Assemble la facturation par appli (fonction pure, testée). `other` regroupe ce qu'aucune appli ne revendique. */
export function buildBilling(apps: Target[], services: ServiceSummary[], dbs: PostgresSummary[], costs: Pick<CostSummary, "byWorkspace">) {
  const targets = [...apps, NJMDEV];
  const takenServices = new Set<string>();
  const takenDbs = new Set<string>();
  const takenWorkspaces = new Set<string>();
  const rows: BillingApp[] = targets.map((app) => {
    const mine = matchServices(app.renderMatch, services).filter((s) => !takenServices.has(s.id));
    mine.forEach((s) => takenServices.add(s.id));
    const myDbs = matchPostgres(app.renderMatch.names, dbs).filter((d) => !takenDbs.has(d.id));
    myDbs.forEach((d) => takenDbs.add(d.id));
    const lines = renderLines(mine, myDbs);
    const workspaces = costs.byWorkspace.filter((w) => !takenWorkspaces.has(w.workspace) && app.claudeWorkspaces.some((re) => re.test(w.workspace)));
    workspaces.forEach((w) => takenWorkspaces.add(w.workspace));
    const claudeUsd = round(workspaces.reduce((t, w) => t + w.usd, 0));
    const render = { lines, ...sumLines(lines) };
    return { key: app.key, name: app.name, render, claude: { workspaces, usd: claudeUsd }, totalUsd: round(render.usd + claudeUsd) };
  });
  const otherLines = renderLines(
    services.filter((s) => !takenServices.has(s.id)),
    dbs.filter((d) => !takenDbs.has(d.id))
  );
  const otherWorkspaces = costs.byWorkspace.filter((w) => !takenWorkspaces.has(w.workspace));
  const other: BillingApp = {
    key: "other",
    name: "Non rattaché à une appli",
    render: { lines: otherLines, ...sumLines(otherLines) },
    claude: { workspaces: otherWorkspaces, usd: round(otherWorkspaces.reduce((t, w) => t + w.usd, 0)) },
    totalUsd: 0,
  };
  other.totalUsd = round(other.render.usd + other.claude.usd);
  const all = [...rows.filter((a) => a.key !== "njmdev" || a.render.lines.length || a.claude.workspaces.length), ...(other.render.lines.length || other.claude.workspaces.length ? [other] : [])];
  return {
    apps: all,
    totals: {
      renderUsd: round(all.reduce((t, a) => t + a.render.usd, 0)),
      claudeUsd: round(all.reduce((t, a) => t + a.claude.usd, 0)),
      totalUsd: round(all.reduce((t, a) => t + a.totalUsd, 0)),
      unknown: all.reduce((t, a) => t + a.render.unknown, 0),
    },
  };
}

export async function getBilling(fresh = false) {
  const base = { pricesAsOf: PRICES_AS_OF, pricesSource: PRICES_SOURCE, currency: "USD" };
  const costs = await getCosts(fresh);
  const claude = { configured: costs.configured, error: costs.error, monthToDateUsd: costs.monthToDateUsd };
  if (!env.renderApiKey) return { ...base, renderConfigured: false, claude, apps: [], totals: { renderUsd: 0, claudeUsd: 0, totalUsd: 0, unknown: 0 } };
  const [services, dbs] = await Promise.all([listServices(fresh), listPostgres(fresh)]);
  return { ...base, renderConfigured: true, claude, ...buildBilling(apps, services, dbs, costs) };
}
