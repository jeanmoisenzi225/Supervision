import { deriveAdminKey } from "../utils/adminSignature";
import { readOptionalEnv } from "./env";

/** Une adresse surveillée d'une appli (API, site, appli web...). */
export interface CheckTarget {
  id: string;
  label: string;
  url: string;
  /** "health" : réponse 2xx dont le JSON, s'il y en a un, ne signale pas d'erreur. */
  expect: "2xx" | "health";
  timeoutMs: number;
}

/** Nom d'espace de travail comparable : sans accents, espaces (y compris insécables ou en trop) réduits et retirés en bout. */
export function normWorkspace(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s\u00a0\u202f]+/g, " ").trim();
}

export interface AppTarget {
  key: string;
  envPrefix: string;
  name: string;
  description: string;
  /** Intervalle entre deux vérifications, en secondes. */
  intervalSec: number;
  /** Indique qu'une première réponse peut être lente (offre gratuite Render mise en veille). */
  sleepsWhenIdle: boolean;
  checks: CheckTarget[];
  ingestToken: string;
  adminUrl: string;
  adminToken: string;
  /** Identifiants imposés par <PREFIXE>_RENDER_SERVICES ; vide = reconnaissance automatique. */
  renderServiceIds: string[];
  /** Reconnaissance automatique des services Render de l'appli (nom ou adresse). */
  renderMatch: { names: RegExp[]; hosts: string[] };
  /** Espaces de travail Anthropic de l'appli (nom reconnu), pour rattacher les dépenses Claude (facturation). */
  claudeWorkspaces: RegExp[];
}

interface AppDefinition {
  key: string;
  envPrefix: string;
  name: string;
  description: string;
  intervalSec: number;
  sleepsWhenIdle?: boolean;
  defaultChecks: Omit<CheckTarget, "timeoutMs">[];
  /** Noms de services Render de l'appli, et adresses .onrender.com cachées derrière un domaine. */
  renderNames: RegExp[];
  renderHosts?: string[];
  /** Noms d'espaces de travail Anthropic de l'appli ; <PREFIXE>_CLAUDE_WORKSPACE (noms séparés par des virgules) les remplace. */
  claudeNames?: RegExp[];
  /** Adresse de base des routes `/supervision` de l'appli (sans `/supervision`). */
  defaultAdminUrl?: string;
}

/**
 * Catalogue des applis supervisées. Les adresses par défaut sont celles de
 * production connues au 2026-10-27 (Procedia : 2026-10-31) ; chacune peut être remplacée par la
 * variable <PREFIXE>_URLS (format "id|libellé|adresse" séparés par des
 * virgules, voir docs/integration.md).
 */
export const APP_DEFINITIONS: AppDefinition[] = [
  {
    key: "mga",
    envPrefix: "MGA",
    name: "MGA",
    // Plateforme multi-garages : chaque garage client a son appli à son nom
    // (« My Autonova » pour Autonova Group, premier client).
    description: "Mon Garage Auto, plateforme de gestion pour les garages (chaque garage client a son appli à son nom)",
    intervalSec: 60,
    defaultAdminUrl: "https://garage-backend-r7i3.onrender.com/api",
    renderNames: [/^garage-/, /^mga-/],
    claudeNames: [/mga|garage/i],
    renderHosts: ["garage-frontend-a7uv.onrender.com"],
    defaultChecks: [
      { id: "api", label: "API", url: "https://garage-backend-r7i3.onrender.com/health", expect: "health" },
      { id: "app", label: "Appli web", url: "https://www.mga-automotive.com/", expect: "2xx" },
    ],
  },
  {
    key: "site-autonova",
    envPrefix: "SITE_AUTONOVA",
    name: "Site Autonova",
    description: "Site vitrine d'Autonova Group, alimenté par MGA",
    intervalSec: 300,
    renderNames: [/autonova/i],
    defaultChecks: [{ id: "site", label: "Site", url: "https://autonova-group.ci/", expect: "2xx" }],
  },
  {
    key: "yiri",
    envPrefix: "YIRI",
    name: "Yiri Invest",
    description: "Veille BRVM, agent WhatsApp et appli d'investissement",
    intervalSec: 60,
    defaultAdminUrl: "https://agent-brvm.onrender.com/api",
    renderNames: [/brvm/i, /yiri/i],
    claudeNames: [/yiri|brvm/i],
    defaultChecks: [
      { id: "server", label: "Serveur", url: "https://agent-brvm.onrender.com/manifest.json", expect: "2xx" },
      { id: "app", label: "Appli web", url: "https://agent-brvm.onrender.com/app", expect: "2xx" },
    ],
  },
  {
    key: "my-family",
    envPrefix: "MY_FAMILY",
    name: "My Family",
    description: "Plateforme d'organisation familiale (pilote NZI FAMILY)",
    intervalSec: 300,
    renderNames: [/family/i],
    claudeNames: [/family/i],
    defaultChecks: [],
  },
  {
    key: "eden-sup",
    envPrefix: "EDEN_SUP",
    name: "EDEN Supervision",
    description: "Supervision technique multi-sites et multi-protocoles pour EDEN Telecom",
    intervalSec: 60,
    renderNames: [/^eden-sup-/i],
    claudeNames: [/eden/i],
    defaultChecks: [
      { id: "api", label: "API backend", url: "https://eden-sup-backend.onrender.com/api/v1/health", expect: "health" },
      { id: "app", label: "Application web", url: "https://eden-sup-app.onrender.com/", expect: "2xx" },
    ],
  },
  {
    key: "procedia",
    envPrefix: "PROCEDIA",
    name: "Procedia",
    description: "Modélisation et test des processus métier (Catalys Consulting)",
    // Offre payante Render (Starter, constatée le 2026-11-12) : le service ne
    // s'endort plus, vérification chaque minute comme MGA et Yiri Invest.
    // (Offre gratuite avant : 30 min, service réveillé par la vérification.)
    intervalSec: 60,
    defaultAdminUrl: "https://procedia-backend.onrender.com/api",
    renderNames: [/^procedia-/],
    claudeNames: [/procedia/i],
    defaultChecks: [
      { id: "api", label: "API", url: "https://procedia-backend.onrender.com/api/health", expect: "health" },
      { id: "app", label: "Appli web", url: "https://procedia-frontend.onrender.com/", expect: "2xx" },
    ],
  },
];

export function parseUrlsEnv(raw: string): Omit<CheckTarget, "timeoutMs">[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const pieces = part.split("|").map((p) => p.trim());
      const url = pieces[pieces.length - 1];
      const id = pieces.length >= 2 ? pieces[0] : `url${index + 1}`;
      const label = pieces.length >= 3 ? pieces[1] : id;
      return { id, label, url, expect: url.includes("health") ? "health" : "2xx" } as const;
    })
    .filter((c) => /^https?:\/\//.test(c.url));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function buildApps(read: (name: string) => string = readOptionalEnv): AppTarget[] {
  return APP_DEFINITIONS.map((def) => {
    const p = def.envPrefix;
    const override = read(`${p}_URLS`);
    const checks = override ? parseUrlsEnv(override) : def.defaultChecks;
    const sleeps = def.sleepsWhenIdle ?? false;
    return {
      key: def.key,
      envPrefix: p,
      name: def.name,
      description: def.description,
      intervalSec: Number(read(`${p}_INTERVAL_SEC`)) || def.intervalSec,
      sleepsWhenIdle: sleeps,
      // Service en veille : ~1 min pour se réveiller, d'où un délai long.
      checks: checks.map((c) => ({ ...c, timeoutMs: sleeps ? 90_000 : 15_000 })),
      ingestToken: read(`${p}_INGEST_TOKEN`),
      adminUrl: (read(`${p}_ADMIN_URL`) || def.defaultAdminUrl || "").replace(/\/+$/, ""),
      // Clé d'administration : imposée, sinon dérivée du jeton d'envoi des journaux.
      adminToken: read(`${p}_ADMIN_TOKEN`) || deriveAdminKey(read(`${p}_INGEST_TOKEN`)),
      renderServiceIds: read(`${p}_RENDER_SERVICES`)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      claudeWorkspaces: read(`${p}_CLAUDE_WORKSPACE`)
        ? read(`${p}_CLAUDE_WORKSPACE`)
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
            // Le nom de l'espace doit contenir le nom donné (sans tenir compte de la casse, des accents ni des espaces en trop).
            .map((n) => new RegExp(normWorkspace(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
        : (def.claudeNames ?? []),
      renderMatch: {
        names: def.renderNames,
        hosts: [...checks.map((c) => hostOf(c.url)), ...(def.renderHosts ?? [])].filter(Boolean),
      },
    };
  });
}

export const apps = buildApps();

export function findApp(key: string): AppTarget | undefined {
  return apps.find((a) => a.key === key);
}
