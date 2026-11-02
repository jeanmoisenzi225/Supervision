/**
 * Module d'envoi vers la Supervision, à copier tel quel dans le backend
 * d'une appli Node (MGA, Procedia, My Family). Aucune dépendance (Node 18+).
 *
 *   const supervision = createSupervision({
 *     url: process.env.SUPERVISION_URL,          // ex. https://supervision-api.onrender.com
 *     token: process.env.SUPERVISION_INGEST_TOKEN,
 *     source: "backend",
 *   });
 *   supervision.captureProcessErrors();
 *   supervision.mirrorConsole();                // console.log/warn/error partent aussi vers la supervision
 *   app.use(supervision.expressErrorLogger);    // juste avant le gestionnaire d'erreurs
 *   app.use("/api/supervision", supervisionAdminRouter(express.Router, { ingestToken: process.env.SUPERVISION_INGEST_TOKEN, actions, summary }));
 *
 * Sans SUPERVISION_URL ou sans jeton, tout devient silencieux : l'appli
 * fonctionne exactement comme avant.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { format } from "util";

type Level = "debug" | "info" | "warn" | "error" | "fatal";
const ORDER: Level[] = ["debug", "info", "warn", "error", "fatal"];

interface Entry {
  at: string;
  level: Level;
  message: string;
  source?: string;
  context?: Record<string, unknown>;
  requestId?: string;
}

export interface SupervisionOptions {
  url?: string;
  token?: string;
  source?: string;
  /** Niveau minimal envoyé (par défaut "info"). */
  minLevel?: Level;
  flushIntervalMs?: number;
  /** Recopie aussi chaque journal dans la console (par défaut true). */
  echo?: boolean;
}

export function createSupervision(options: SupervisionOptions) {
  const url = (options.url ?? "").replace(/\/+$/, "");
  const token = options.token ?? "";
  const enabled = Boolean(url && token);
  const minIndex = ORDER.indexOf(options.minLevel ?? "info");
  const echo = options.echo ?? true;
  let queue: Entry[] = [];
  let flushing = false;

  async function post(path: string, body: unknown): Promise<void> {
    await fetch(`${url}/api/ingest/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  }

  async function flush(): Promise<void> {
    if (!enabled || flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.slice(0, 500);
    try {
      await post("logs", { entries: batch });
      queue = queue.slice(batch.length);
    } catch {
      // Supervision injoignable : on garde les journaux (dans la limite de 5 000) pour le prochain envoi.
      if (queue.length > 5000) queue = queue.slice(-5000);
    } finally {
      flushing = false;
    }
  }

  const timer = enabled ? setInterval(() => void flush(), options.flushIntervalMs ?? 5000) : null;
  timer?.unref?.();

  function enqueue(level: Level, message: string, source?: string, context?: Record<string, unknown>, requestId?: string): void {
    if (!enabled || ORDER.indexOf(level) < minIndex) return;
    queue.push({ at: new Date().toISOString(), level, message, source: source ?? options.source, context, requestId });
    if (level === "error" || level === "fatal" || queue.length >= 200) void flush();
  }

  function log(level: Level, message: string, context?: Record<string, unknown>, requestId?: string): void {
    if (echo) (level === "error" || level === "fatal" ? console.error : level === "warn" ? console.warn : console.log)(`[${level}] ${message}`, context ?? "");
    enqueue(level, message, undefined, context, requestId);
  }

  function errorToEntry(err: unknown): { message: string; context: Record<string, unknown> } {
    const e = err instanceof Error ? err : new Error(String(err));
    return { message: `${e.name}: ${e.message}\n${e.stack ?? ""}`.trim(), context: {} };
  }

  return {
    log,
    debug: (m: string, c?: Record<string, unknown>) => log("debug", m, c),
    info: (m: string, c?: Record<string, unknown>) => log("info", m, c),
    warn: (m: string, c?: Record<string, unknown>) => log("warn", m, c),
    error: (m: string | Error, c?: Record<string, unknown>) =>
      typeof m === "string" ? log("error", m, c) : log("error", errorToEntry(m).message, c),
    fatal: (m: string, c?: Record<string, unknown>) => log("fatal", m, c),
    flush,

    /** Alerte métier (ex. "paiement en échec") ; la même clé n'ouvre qu'une alerte. */
    async alert(key: string, title: string, detail?: string, severity: "critical" | "warning" | "info" = "warning") {
      if (enabled) await post("alerts", { key, title, detail, severity }).catch(() => undefined);
    },
    async resolve(key: string, title?: string) {
      if (enabled) await post("alerts", { key, title, resolve: true }).catch(() => undefined);
    },

    /**
     * Tâche planifiée surveillée : enveloppe la fonction de la tâche, mesure sa
     * durée et signale chaque exécution (réussie ou en échec) à la supervision,
     * qui alerte si la tâche ne tourne pas à l'heure prévue, échoue ou tourne deux fois.
     * `cron` : horaire attendu (5 champs, UTC), le même que celui du planificateur.
     * La fonction renvoyée se comporte comme l'originale (même résultat, même erreur).
     *
     *   cron.schedule("0 20 * * *", supervision.job("rappels-veille", { label: "Rappels de la veille", cron: "0 20 * * *" }, runDayBeforeReminderCheck));
     */
    job<T>(key: string, opts: { label: string; cron: string; graceMinutes?: number; summarize?: (result: T) => string | undefined }, fn: () => Promise<T>): () => Promise<T> {
      return async () => {
        const started = Date.now();
        const report = (status: "ok" | "error", message?: string) => {
          if (!enabled) return;
          void post("jobs", { key, label: opts.label, cron: opts.cron, graceMinutes: opts.graceMinutes ?? 15, status, message: message?.slice(0, 500), durationMs: Date.now() - started }).catch(
            () => undefined
          );
        };
        try {
          const result = await fn();
          let message: string | undefined;
          try {
            message = opts.summarize ? opts.summarize(result) : typeof result === "number" ? `${result} élément(s) traité(s)` : undefined;
          } catch {
            message = undefined;
          }
          report("ok", message);
          return result;
        } catch (err) {
          report("error", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
          throw err;
        }
      };
    },

    /**
     * Erreurs non rattrapées du processus : journalisées et envoyées avant
     * l'arrêt. Le processus s'arrête toujours ensuite, comme le fait Node sans
     * ce module (l'hébergeur le redémarre). L'arrêt demandé par l'hébergeur
     * (SIGTERM, à chaque déploiement) est aussi journalisé.
     */
    captureProcessErrors(): void {
      const stop = (code: number) => {
        void Promise.race([flush(), new Promise((r) => setTimeout(r, 3000))]).finally(() => process.exit(code));
      };
      process.on("uncaughtException", (err) => {
        log("fatal", `Erreur non rattrapée, arrêt du serveur : ${errorToEntry(err).message}`);
        stop(1);
      });
      process.on("unhandledRejection", (reason) => {
        log("fatal", `Promesse rejetée non gérée, arrêt du serveur : ${errorToEntry(reason).message}`);
        stop(1);
      });
      process.once("SIGTERM", () => {
        log("info", "Arrêt du serveur demandé par l'hébergeur (déploiement ou redémarrage)");
        stop(0);
      });
    },

    /**
     * Recopie console.log / info / warn / error vers la supervision (la
     * console continue d'afficher comme avant). Un préfixe « [module] » en
     * tête de message devient la source du journal.
     */
    mirrorConsole(): void {
      const levels: [keyof Console & ("log" | "info" | "warn" | "error"), Level][] = [
        ["log", "info"],
        ["info", "info"],
        ["warn", "warn"],
        ["error", "error"],
      ];
      for (const [method, level] of levels) {
        const original = console[method].bind(console) as (...args: unknown[]) => void;
        (console as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
          original(...args);
          try {
            const message = format(...args);
            enqueue(level, message, sourceFromMessage(message));
          } catch {
            // Un journal impossible à mettre en forme ne doit jamais casser l'appli.
          }
        };
      }
    },

    /** Middleware Express : journalise chaque erreur 5xx avec la route concernée, puis passe la main. */
    expressErrorLogger(err: unknown, req: { method: string; originalUrl: string }, _res: unknown, next: (err: unknown) => void): void {
      const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode ?? 500;
      if (status >= 500) {
        const { message } = errorToEntry(err);
        log("error", message, { route: `${req.method} ${req.originalUrl.split("?")[0]}`, status });
      }
      next(err);
    },
  };
}

/** « [news] échec… » → "news" ; sinon undefined (source par défaut). */
export function sourceFromMessage(message: string): string | undefined {
  const match = /^\[([^\]]{1,40})\]/.exec(message);
  return match ? match[1] : undefined;
}

/* ---------- Actions super administrateur (protocole /supervision) ---------- */

/** Clé d'administration dérivée du jeton d'envoi des journaux (même calcul que la supervision). */
export function deriveAdminKey(ingestToken: string): string {
  return ingestToken ? createHmac("sha256", ingestToken).update("supervision-admin").digest("hex") : "";
}

export function signAdminRequest(key: string, timestamp: number, method: string, relPath: string, body: string): string {
  return createHmac("sha256", key).update(`${timestamp}.${method.toUpperCase()}.${relPath}.${body}`).digest("hex");
}

/**
 * Vérifie un appel signé par la supervision (fonction pure, testée) :
 * signature exacte et horodatage à moins de 5 minutes (pas de rejeu).
 */
export function verifyAdminRequest(
  key: string,
  headers: { timestamp?: string; signature?: string },
  method: string,
  relPath: string,
  body: string,
  now = Date.now()
): boolean {
  if (!key || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60_000) return false;
  const expected = Buffer.from(signAdminRequest(key, ts, method, relPath, body), "hex");
  const given = Buffer.from(headers.signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface SupervisionAction {
  id: string;
  label: string;
  description?: string;
  danger?: boolean;
  params?: { name: string; label: string; type?: "text" | "number" | "boolean"; required?: boolean }[];
  run: (params: Record<string, unknown>, by: string) => Promise<{ message?: string; data?: unknown } | void>;
}

/** Un client de l'appli (garage, compte, abonné…) dans la liste de la supervision. */
export interface TenantSummary {
  id: string;
  name: string;
  /** Ligne secondaire (ville, rôle…). */
  subtitle?: string;
  /** Étiquettes courtes (« Site publié », « Désactivé »…). */
  badges?: string[];
  /** Quelques chiffres clés affichés dans la liste. */
  fields?: { label: string; value: string | number }[];
}

/** Fiche détaillée d'un client, en sections. */
export interface TenantDetail {
  name: string;
  subtitle?: string;
  sections: { title: string; items: { label: string; value: string | number }[] }[];
}

export interface SupervisionAdminOptions {
  /** Jeton d'envoi des journaux (SUPERVISION_INGEST_TOKEN) : la clé d'administration en est dérivée. */
  ingestToken?: string;
  /** Clé imposée (SUPERVISION_ADMIN_TOKEN), prioritaire sur la clé dérivée. */
  key?: string;
  actions: SupervisionAction[];
  /** Chiffres clés affichés dans la supervision (ex. nombre d'utilisateurs). */
  summary?: () => Promise<{ label: string; value: string | number; hint?: string }[]>;
  /**
   * Clients de l'appli (ex. les garages de MGA) : liste et fiche détaillée.
   * Caractéristiques et activité seulement, jamais de données confidentielles
   * du client (chiffre d'affaires, montants, contenu de ses dossiers).
   */
  tenants?: { label: string; list: () => Promise<TenantSummary[]>; detail: (id: string) => Promise<TenantDetail | null> };
}

// Types minimaux d'Express, pour ne pas imposer la dépendance à ce fichier.
interface Req {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  body?: { params?: Record<string, unknown>; by?: string };
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}
type Handler = (req: Req, res: Res) => void;
interface RouterLike {
  get(path: string, handler: Handler): unknown;
  post(path: string, handler: Handler): unknown;
}

/**
 * Routes `/supervision/...` à monter dans l'appli (après express.json()).
 * Sans clé (ni SUPERVISION_INGEST_TOKEN ni SUPERVISION_ADMIN_TOKEN), tout appel est refusé.
 */
export function supervisionAdminRouter<R extends RouterLike>(RouterFactory: () => R, options: SupervisionAdminOptions): R {
  const router = RouterFactory();
  const key = options.key || deriveAdminKey(options.ingestToken ?? "");

  const header = (req: Req, name: string) => {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] : v;
  };

  const guard = (handler: (req: Req, res: Res) => Promise<void>): Handler => (req, res) => {
    const body = req.method.toUpperCase() === "GET" ? "" : JSON.stringify(req.body ?? {});
    const ok = verifyAdminRequest(key, { timestamp: header(req, "x-supervision-timestamp"), signature: header(req, "x-supervision-signature") }, req.method, req.path, body);
    if (!ok) return res.status(401).json({ error: "Non autorisé" });
    handler(req, res).catch((err: Error) => res.status(500).json({ ok: false, error: err.message }));
  };

  router.get(
    "/actions",
    guard(async (_req, res) => {
      res.json({ actions: options.actions.map(({ run: _run, ...a }) => a) });
    })
  );

  router.get(
    "/summary",
    guard(async (_req, res) => {
      res.json({ metrics: options.summary ? await options.summary() : [] });
    })
  );

  router.get(
    "/tenants",
    guard(async (_req, res) => {
      if (!options.tenants) return res.json({ label: null, items: [] });
      res.json({ label: options.tenants.label, items: await options.tenants.list() });
    })
  );

  router.get(
    "/tenants/:id",
    guard(async (req, res) => {
      const detail = options.tenants ? await options.tenants.detail(req.params.id) : null;
      if (!detail) return res.status(404).json({ error: "Introuvable" });
      res.json(detail);
    })
  );

  router.post(
    "/actions/:id",
    guard(async (req, res) => {
      const action = options.actions.find((a) => a.id === req.params.id);
      if (!action) return res.status(404).json({ ok: false, error: "Action inconnue" });
      try {
        const result = (await action.run(req.body?.params ?? {}, req.body?.by ?? "supervision")) ?? {};
        res.json({ ok: true, message: result.message ?? "Action effectuée", data: result.data ?? null });
      } catch (err) {
        // Refus métier (paramètre manquant, utilisateur introuvable…) : message lisible, pas d'erreur 500.
        res.status(422).json({ ok: false, error: (err as Error).message });
      }
    })
  );

  return router;
}
