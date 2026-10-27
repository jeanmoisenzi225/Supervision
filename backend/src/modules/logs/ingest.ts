import { createHash } from "crypto";
import { z } from "zod";

export const LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
export type Level = (typeof LEVELS)[number];

const MAX_MESSAGE = 4000;
const MAX_CONTEXT_BYTES = 8000;

const levelSchema = z
  .string()
  .transform((l) => l.toLowerCase())
  .transform((l) => (l === "warning" ? "warn" : l === "critical" ? "fatal" : l))
  .pipe(z.enum(LEVELS));

const entrySchema = z.object({
  at: z.coerce.date().optional(),
  level: levelSchema.default("info"),
  message: z.string().min(1),
  source: z.string().max(40).optional(),
  context: z.record(z.unknown()).optional(),
  requestId: z.string().max(100).optional(),
});

export const ingestLogsSchema = z.object({ entries: z.array(entrySchema).min(1).max(500) });

export const ingestAlertSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200).optional(),
  detail: z.string().max(2000).optional(),
  severity: z.enum(["critical", "warning", "info"]).default("warning"),
  resolve: z.boolean().default(false),
});

export interface CleanEntry {
  at: Date;
  level: Level;
  message: string;
  source: string | null;
  context: Record<string, unknown> | null;
  requestId: string | null;
}

/** Normalise une entrée reçue : tronque les champs trop longs, date future ramenée à maintenant. */
export function cleanEntry(entry: z.infer<typeof entrySchema>, now = new Date()): CleanEntry {
  let context: Record<string, unknown> | null = entry.context ?? null;
  if (context && JSON.stringify(context).length > MAX_CONTEXT_BYTES) {
    context = { _tronque: true, apercu: JSON.stringify(context).slice(0, MAX_CONTEXT_BYTES) };
  }
  const at = entry.at && !Number.isNaN(entry.at.getTime()) && entry.at <= now ? entry.at : now;
  return {
    at,
    level: entry.level,
    message: entry.message.slice(0, MAX_MESSAGE),
    source: entry.source ?? null,
    context,
    requestId: entry.requestId ?? null,
  };
}

/**
 * Empreinte d'une erreur : la même erreur avec un identifiant, un nombre ou
 * une date différents doit retomber sur la même alerte.
 */
export function errorFingerprint(message: string): string {
  const normalized = message
    .split("\n")[0]
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, "#")
    .replace(/\b[a-z0-9]{20,}\b/g, "#")
    .replace(/\d+/g, "#")
    .slice(0, 200);
  return "error:" + createHash("sha1").update(normalized).digest("hex").slice(0, 16);
}
