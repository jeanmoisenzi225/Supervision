const hhmm = (h: string, m: string) => `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Horaire lisible d'une expression cron simple (UTC = heure d'Abidjan) ; sinon l'expression brute. */
export function cronLabel(expr: string): string {
  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/);
  if (!m || dom !== "*" || mon !== "*") return expr;
  const everyMin = /^\*\/(\d+)$/.exec(m);
  if (everyMin && h === "*" && dow === "*") return `toutes les ${everyMin[1]} min`;
  if (/^\d+$/.test(m) && h === "*" && dow === "*") return `chaque heure à :${m.padStart(2, "0")}`;
  if (/^\d+$/.test(m) && /^[\d,]+$/.test(h)) {
    const times = h.split(",").map((x) => hhmm(x, m)).join(", ");
    if (dow === "*") return `chaque jour à ${times}`;
    if (/^\d$/.test(dow)) return `chaque ${DAYS[Number(dow)]} à ${times}`;
  }
  return expr;
}
