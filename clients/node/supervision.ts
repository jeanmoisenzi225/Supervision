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
 *   app.use("/supervision", supervisionAdminRouter(express.Router, { token: process.env.SUPERVISION_ADMIN_TOKEN, actions, summary }));
 *
 * Sans SUPERVISION_URL ou sans jeton, tout devient silencieux : l'appli
 * fonctionne exactement comme avant.
 */

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

export interface SupervisionAction {
  id: string;
  label: string;
  description?: string;
  danger?: boolean;
  params?: { name: string; label: string; type?: "text" | "number" | "boolean"; required?: boolean }[];
  run: (params: Record<string, unknown>, by: string) => Promise<{ message?: string; data?: unknown } | void>;
}

export interface SupervisionAdminOptions {
  token?: string;
  actions: SupervisionAction[];
  /** Chiffres clés affichés dans la supervision (ex. nombre d'utilisateurs). */
  summary?: () => Promise<{ label: string; value: string | number; hint?: string }[]>;
}

// Types minimaux d'Express, pour ne pas imposer la dépendance à ce fichier.
interface Req {
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

export function supervisionAdminRouter<R extends RouterLike>(RouterFactory: () => R, options: SupervisionAdminOptions): R {
  const router = RouterFactory();
  const token = options.token ?? "";

  function authorized(req: Req): boolean {
    const header = String(req.headers.authorization ?? "");
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || given.length !== token.length) return false;
    // Comparaison à durée constante.
    let diff = 0;
    for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ given.charCodeAt(i);
    return diff === 0;
  }

  const guard = (handler: (req: Req, res: Res) => Promise<void>): Handler => (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "Non autorisé" });
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

  router.post(
    "/actions/:id",
    guard(async (req, res) => {
      const action = options.actions.find((a) => a.id === req.params.id);
      if (!action) return res.status(404).json({ ok: false, error: "Action inconnue" });
      const result = (await action.run(req.body?.params ?? {}, req.body?.by ?? "supervision")) ?? {};
      res.json({ ok: true, message: result.message ?? "Action effectuée", data: result.data ?? null });
    })
  );

  return router;
}
