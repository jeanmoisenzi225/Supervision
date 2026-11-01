/**
 * Lecture d'une expression cron à 5 champs (minute heure jour mois jour-de-semaine),
 * en UTC : `*`, valeurs, listes `a,b`, intervalles `a-b`, pas `*\/n` ou `a-b/n`.
 * Sert à savoir quand une tâche aurait dû tourner. Pas de dépendance.
 */
interface Field {
  values: Set<number>;
  any: boolean;
}

const RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

function parseField(expr: string, [min, max]: [number, number]): Field {
  const values = new Set<number>();
  for (const part of expr.split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    let lo: number;
    let hi: number;
    if (range === "*") {
      lo = min;
      hi = max;
    } else if (range.includes("-")) {
      [lo, hi] = range.split("-").map(Number);
    } else {
      lo = Number(range);
      hi = stepRaw ? max : lo;
    }
    if (![lo, hi, step].every(Number.isInteger) || step < 1 || lo < min || hi > max || lo > hi) {
      throw new Error(`Expression cron invalide : « ${expr} »`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return { values, any: expr === "*" };
}

export interface Cron {
  minute: Field;
  hour: Field;
  dom: Field;
  month: Field;
  dow: Field;
}

export function parseCron(expr: string): Cron {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expression cron invalide (5 champs attendus) : « ${expr} »`);
  const [minute, hour, dom, month, dow] = parts.map((p, i) => parseField(p, RANGES[i]));
  // 7 = dimanche, comme 0.
  if (dow.values.has(7)) dow.values.add(0);
  return { minute, hour, dom, month, dow };
}

function matches(c: Cron, d: Date): boolean {
  if (!c.minute.values.has(d.getUTCMinutes()) || !c.hour.values.has(d.getUTCHours()) || !c.month.values.has(d.getUTCMonth() + 1)) return false;
  const domOk = c.dom.values.has(d.getUTCDate());
  const dowOk = c.dow.values.has(d.getUTCDay());
  // Règle cron : si jour du mois ET jour de semaine sont restreints, l'un ou l'autre suffit.
  if (!c.dom.any && !c.dow.any) return domOk || dowOk;
  return domOk && dowOk;
}

const MINUTE = 60_000;
const SEARCH_LIMIT = 40 * 24 * 60; // 40 jours de minutes

/** Dernière échéance prévue au plus tard à `at` (minute comprise), ou null. */
export function previousFire(expr: string, at: Date): Date | null {
  const c = parseCron(expr);
  let t = Math.floor(at.getTime() / MINUTE) * MINUTE;
  for (let i = 0; i < SEARCH_LIMIT; i++, t -= MINUTE) if (matches(c, new Date(t))) return new Date(t);
  return null;
}

/** Prochaine échéance strictement après `at`, ou null. */
export function nextFire(expr: string, at: Date): Date | null {
  const c = parseCron(expr);
  let t = Math.floor(at.getTime() / MINUTE) * MINUTE + MINUTE;
  for (let i = 0; i < SEARCH_LIMIT; i++, t += MINUTE) if (matches(c, new Date(t))) return new Date(t);
  return null;
}

/** Plus petit écart entre deux échéances consécutives (minutes), estimé sur 8 jours. */
export function minIntervalMinutes(expr: string, from = new Date(Date.UTC(2026, 0, 5))): number {
  let prev = nextFire(expr, from);
  let min = Infinity;
  const end = from.getTime() + 8 * 24 * 60 * MINUTE;
  while (prev && prev.getTime() < end) {
    const n = nextFire(expr, prev);
    if (!n) break;
    min = Math.min(min, (n.getTime() - prev.getTime()) / MINUTE);
    prev = n;
  }
  return min;
}
