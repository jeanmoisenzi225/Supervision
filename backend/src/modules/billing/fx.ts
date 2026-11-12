import type { Currency } from "./forecast";

/**
 * Taux de change (v0.21.0) : dollars → devise du document, repris automatiquement.
 * Source : taux de référence de la Banque centrale européenne, via Frankfurter (avec date) puis le fichier
 * du jour de la BCE en secours. Le franc CFA (XOF) n'est pas coté : il est rattaché à l'euro par une parité
 * fixe (1 euro = 655,957 FCFA), le taux en FCFA se déduit donc du taux en euro.
 */
export const XOF_PER_EUR = 655.957;

export interface FxRate {
  currency: Currency;
  /** Combien de la devise pour 1 dollar. */
  rate: number;
  /** Date du taux (jour ouvré de la BCE le plus proche). */
  date: string | null;
  source: string;
}

const TTL_MS = 6 * 3600_000;
const cache = new Map<string, { at: number; eurPerUsd: number; date: string; source: string }>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "NJMDev-Supervision" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Euros pour 1 dollar, d'après la réponse de Frankfurter (fonction pure, testée). */
export function parseFrankfurter(body: unknown): { eurPerUsd: number; date: string } {
  const b = body as { date?: string; rates?: { EUR?: number } };
  const rate = b?.rates?.EUR;
  if (typeof rate !== "number" || !(rate > 0) || typeof b.date !== "string") throw new Error("réponse Frankfurter inattendue");
  return { eurPerUsd: rate, date: b.date };
}

/** Euros pour 1 dollar, d'après le fichier XML du jour de la BCE (donne les dollars pour 1 euro). */
export function parseEcbXml(xml: string): { eurPerUsd: number; date: string } {
  const date = /<Cube time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  const usdPerEur = Number(/<Cube currency=['"]USD['"] rate=['"]([\d.]+)['"]/.exec(xml)?.[1]);
  if (!date || !(usdPerEur > 0)) throw new Error("réponse BCE inattendue");
  return { eurPerUsd: 1 / usdPerEur, date };
}

async function eurPerUsd(date: string | null): Promise<{ eurPerUsd: number; date: string; source: string }> {
  const key = date ?? "latest";
  const hit = cache.get(key);
  if (hit && (date || Date.now() - hit.at < TTL_MS)) return hit;
  let found: { eurPerUsd: number; date: string; source: string } | null = null;
  try {
    const r = parseFrankfurter(await getJson(`https://api.frankfurter.dev/v1/${date ?? "latest"}?base=USD&symbols=EUR`));
    found = { ...r, source: "BCE (Frankfurter)" };
  } catch {
    if (!date) {
      const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("Taux de change indisponible : réessayez ou saisissez le taux.");
      found = { ...parseEcbXml(await res.text()), source: "BCE" };
    }
  }
  if (!found) throw new Error("Taux de change indisponible : réessayez ou saisissez le taux.");
  cache.set(key, { at: Date.now(), ...found });
  return found;
}

/** Taux dollars → devise ; `date` (AAAA-MM-JJ) pour le taux d'un jour passé, sinon le dernier connu. */
export async function usdRate(currency: Currency, date?: string | null): Promise<FxRate> {
  if (currency === "USD") return { currency, rate: 1, date: null, source: "—" };
  const when = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < new Date().toISOString().slice(0, 10) ? date : null;
  const e = await eurPerUsd(when);
  const rate = currency === "EUR" ? e.eurPerUsd : e.eurPerUsd * XOF_PER_EUR;
  return { currency, rate: Math.round(rate * 10000) / 10000, date: e.date, source: currency === "XOF" ? `${e.source}, parité fixe 1 € = 655,957 FCFA` : e.source };
}

/** Un taux saisi est « absurde » s'il s'écarte de plus de 50 % du taux du marché (erreur d'unité typique : 655,957 FCFA par euro saisi comme dollars par euro). */
export function isAbsurdRate(entered: number, reference: number): boolean {
  return entered > reference * 1.5 || entered < reference / 1.5;
}

export function clearFxCache(): void {
  cache.clear();
}
