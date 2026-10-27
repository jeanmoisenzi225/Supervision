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
  renderServiceIds: string[];
}

interface AppDefinition {
  key: string;
  envPrefix: string;
  name: string;
  description: string;
  intervalSec: number;
  sleepsWhenIdle?: boolean;
  defaultChecks: Omit<CheckTarget, "timeoutMs">[];
}

/**
 * Catalogue des applis supervisées. Les adresses par défaut sont celles de
 * production connues au 2026-10-27 ; chacune peut être remplacée par la
 * variable <PREFIXE>_URLS (format "id|libellé|adresse" séparés par des
 * virgules, voir docs/integration.md).
 */
export const APP_DEFINITIONS: AppDefinition[] = [
  {
    key: "mga",
    envPrefix: "MGA",
    name: "MGA · My Autonova",
    description: "Appli de gestion du garage et espace client My Autonova",
    intervalSec: 60,
    defaultChecks: [
      { id: "api", label: "API", url: "https://garage-backend-r7i3.onrender.com/health", expect: "health" },
      { id: "app", label: "Appli web", url: "https://www.mga-automotive.com/", expect: "2xx" },
    ],
  },
  {
    key: "site-autonova",
    envPrefix: "SITE_AUTONOVA",
    name: "Site Autonova",
    description: "Site vitrine d'Autonova Group, alimenté par My Autonova",
    intervalSec: 300,
    defaultChecks: [{ id: "site", label: "Site", url: "https://autonova-group.ci/", expect: "2xx" }],
  },
  {
    key: "yiri",
    envPrefix: "YIRI",
    name: "Yiri Invest",
    description: "Veille BRVM, agent WhatsApp et appli d'investissement",
    intervalSec: 60,
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
    defaultChecks: [],
  },
  {
    key: "procedia",
    envPrefix: "PROCEDIA",
    name: "Procedia",
    description: "Modélisation et test des processus métier (Catalys Consulting)",
    // Offre gratuite Render : chaque vérification réveille le service, qui
    // reste alors éveillé 15 minutes. Un intervalle long évite de consommer
    // tout le quota mensuel d'heures gratuites (voir docs/integration.md).
    intervalSec: 1800,
    sleepsWhenIdle: true,
    defaultChecks: [],
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
      adminUrl: read(`${p}_ADMIN_URL`).replace(/\/+$/, ""),
      adminToken: read(`${p}_ADMIN_TOKEN`),
      renderServiceIds: read(`${p}_RENDER_SERVICES`)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
  });
}

export const apps = buildApps();

export function findApp(key: string): AppTarget | undefined {
  return apps.find((a) => a.key === key);
}
