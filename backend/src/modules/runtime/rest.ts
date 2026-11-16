// Retour de la mémoire au repos après un import (v0.37.0). À partir des relevés en direct, repère les
// périodes où au moins un import était en cours, le niveau de base juste avant, le pic atteint et le
// temps mis par la mémoire pour redescendre près de ce niveau de base.

export interface RestSample {
  at: number;
  ok: boolean;
  rssMb: number | null;
  imports: number | null;
}

export interface ImportEpisode {
  startAt: number;
  /** Fin de la période d'import ; null tant qu'un import est en cours. */
  endAt: number | null;
  /** Niveau de base : plus bas relevé dans les 2 minutes avant l'import (null s'il n'y a pas de relevé avant). */
  baselineMb: number | null;
  peakMb: number | null;
  /** Mémoire au dernier relevé connu après la fin de l'import. */
  lastMb: number | null;
  /** Première fois où la mémoire est redescendue près du niveau de base ; null si pas encore. */
  restAt: number | null;
  restAfterSec: number | null;
  /** Un nouvel import a commencé avant le retour au repos. */
  interrupted: boolean;
}

/** Retour au repos : à moins de 15 % (30 Mo au minimum) au-dessus du niveau de base. */
export const restLimit = (baselineMb: number): number => baselineMb + Math.max(30, baselineMb * 0.15);
const BASELINE_WINDOW_MS = 2 * 60_000;

export function importEpisodes(input: RestSample[]): ImportEpisode[] {
  const samples = input.filter((s) => s.ok && s.rssMb !== null && s.imports !== null).sort((a, b) => a.at - b.at);
  const out: ImportEpisode[] = [];
  let current: ImportEpisode | null = null;
  let waiting: ImportEpisode | null = null; // épisode terminé dont le retour au repos est attendu

  for (const [i, s] of samples.entries()) {
    const running = (s.imports ?? 0) > 0;
    if (running) {
      // Un import qui démarre avant le retour au repos garde le niveau de base de l'import précédent :
      // la mémoire encore haute ne doit pas devenir la nouvelle référence.
      const inherited: number | null | undefined = waiting ? waiting.baselineMb : undefined;
      if (waiting) {
        waiting.interrupted = true;
        waiting = null;
      }
      if (!current) {
        const before = samples.slice(0, i).filter((p) => s.at - p.at <= BASELINE_WINDOW_MS).map((p) => p.rssMb!);
        current = { startAt: s.at, endAt: null, baselineMb: inherited !== undefined ? inherited : before.length ? Math.min(...before) : null, peakMb: s.rssMb, lastMb: s.rssMb, restAt: null, restAfterSec: null, interrupted: false };
        out.push(current);
      }
      current.peakMb = Math.max(current.peakMb ?? 0, s.rssMb!);
      current.lastMb = s.rssMb;
    } else {
      if (current) {
        current.endAt = s.at;
        waiting = current;
        current = null;
      }
      if (waiting) {
        waiting.peakMb = Math.max(waiting.peakMb ?? 0, s.rssMb!);
        waiting.lastMb = s.rssMb;
        if (waiting.baselineMb !== null && s.rssMb! <= restLimit(waiting.baselineMb)) {
          waiting.restAt = s.at;
          waiting.restAfterSec = Math.round((s.at - waiting.endAt!) / 1000);
          waiting = null;
        }
      }
    }
  }
  return out;
}

/** Épisode terminé depuis au moins `minMs` dont la mémoire n'est toujours pas redescendue (aucun nouvel import entre-temps). */
export function notSettled(episodes: ImportEpisode[], now: number, minMs = 15 * 60_000): ImportEpisode | null {
  const last = episodes[episodes.length - 1];
  if (!last || last.endAt === null || last.restAt !== null || last.interrupted || last.baselineMb === null) return null;
  return now - last.endAt >= minMs ? last : null;
}
