// Objectifs de la semaine : calcul des semaines et de ce que chaque semaine affiche.
// Une semaine va du lundi 00:00 au dimanche 23:59 (UTC, c'est l'heure d'Abidjan).
const DAY = 24 * 3600_000;
const WEEK = 7 * DAY;

/** Lundi 00:00 UTC de la semaine qui contient `d`. */
export function weekStartOf(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY);
}

export const addWeeks = (d: Date, n: number): Date => new Date(d.getTime() + n * WEEK);

/** « 2026-11-16 » → lundi de cette semaine ; null si la date est invalide. */
export function parseWeek(value: string | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : weekStartOf(d);
}

export const weekKey = (d: Date): string => d.toISOString().slice(0, 10);

export type ObjectiveRow = { id: string; title: string; weekStart: Date; doneAt: Date | null; createdAt: Date };

export type ObjectiveView = { id: string; title: string; done: boolean; doneAt: string | null; carried: number };

/**
 * Objectifs affichés pour la semaine `week` : ceux créés cette semaine ou avant et pas encore validés
 * avant elle (reportés d'une semaine à l'autre), triés par date de création. `carried` = nombre de
 * semaines de report. Une semaine future n'affiche rien.
 */
export function weekView(rows: ObjectiveRow[], week: Date, now: Date) {
  const current = weekStartOf(now);
  const items: ObjectiveView[] = week.getTime() > current.getTime() ? [] : rows
    .filter((r) => r.weekStart.getTime() <= week.getTime() && (!r.doneAt || weekStartOf(r.doneAt).getTime() >= week.getTime()))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => ({
      id: r.id,
      title: r.title,
      done: !!r.doneAt && weekStartOf(r.doneAt).getTime() === week.getTime(),
      doneAt: r.doneAt && weekStartOf(r.doneAt).getTime() === week.getTime() ? r.doneAt.toISOString() : null,
      carried: Math.round((week.getTime() - r.weekStart.getTime()) / WEEK),
    }));
  const done = items.filter((i) => i.done).length;
  return {
    week: weekKey(week),
    weekEnd: weekKey(new Date(week.getTime() + 6 * DAY)),
    current: week.getTime() === current.getTime(),
    previous: weekKey(addWeeks(week, -1)),
    next: week.getTime() < current.getTime() ? weekKey(addWeeks(week, 1)) : null,
    items,
    progress: { done, total: items.length },
  };
}
