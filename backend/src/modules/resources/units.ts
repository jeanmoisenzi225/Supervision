/** Conversion d'une valeur Render vers des octets selon l'unité annoncée (fonction pure, testée). */
export function toBytes(value: number, unit: string): number {
  const u = unit.trim().toLowerCase();
  const factor: Record<string, number> = {
    b: 1,
    byte: 1,
    bytes: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
  };
  if (u in factor) return value * factor[u];
  // Unité absente ou inconnue : une valeur de mémoire ou de disque est en octets.
  return value;
}

/** Somme point à point de plusieurs séries (même horodatage). */
export function sumSeries(series: [number, number][][]): [number, number][] {
  const totals = new Map<number, number>();
  for (const s of series) for (const [t, v] of s) totals.set(t, (totals.get(t) ?? 0) + v);
  return [...totals.entries()].sort((a, b) => a[0] - b[0]);
}

/** Dernière valeur d'une série, ou null. */
export function last(points: [number, number][]): number | null {
  return points.length ? points[points.length - 1][1] : null;
}

/** Part utilisée (0-100), ou null si l'une des valeurs manque. */
export function percent(used: number | null, limit: number | null): number | null {
  if (used === null || limit === null || limit <= 0) return null;
  return Math.round((used / limit) * 1000) / 10;
}

/** Jours restants avant une date (arrondi inférieur), ou null. */
export function daysUntil(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - now) / 86_400_000);
}

// `resolution` : pas d'affichage ; `fine` : pas demandé à Render pour la mémoire et le processeur
// (v0.28.0). Render ne conserve pas les pics aux pas larges (mesuré le 13/11 : 403 Mo à 30 s,
// 190 Mo à 600 s) : on demande un pas fin, puis on garde le maximum de chaque pas d'affichage.
export const RANGES = {
  "24h": { hours: 24, resolution: 600, fine: 60 },
  "7d": { hours: 24 * 7, resolution: 3600, fine: 300 },
  "30d": { hours: 24 * 30, resolution: 4 * 3600, fine: 900 },
} as const;

/** Regroupe une série par pas de `bucketSec` secondes en gardant le MAXIMUM de chaque pas (fonction pure, testée). */
export function maxBuckets(points: [number, number][], bucketSec: number): [number, number][] {
  const ms = bucketSec * 1000;
  const out = new Map<number, number>();
  for (const [t, v] of points) {
    const b = Math.floor(t / ms) * ms;
    out.set(b, Math.max(out.get(b) ?? -Infinity, v));
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]);
}

export type RangeKey = keyof typeof RANGES;
