import fs from "node:fs";
import path from "node:path";

/**
 * Logos des clients imprimés en haut à droite de leurs documents (v0.50.0).
 * Chaque logo est un PNG de `backend/assets/clients/`, retrouvé d'après le nom du client.
 * Source : site officiel du client (Catalys) ou dépôt `site-autonova` (Autonova Group).
 */
const DIR = path.resolve(__dirname, "../../../assets/clients");
const REGISTRY: { match: RegExp; file: string }[] = [
  { match: /catalys/i, file: "catalys.png" },
  // « Antonova » : orthographe rencontrée dans la fiche client
  { match: /(au|an)tonova/i, file: "autonova-group.png" },
];
const cache = new Map<string, Buffer | null>();

export function clientLogoFor(clientName: string): Buffer | null {
  const entry = REGISTRY.find((r) => r.match.test(clientName));
  if (!entry) return null;
  if (!cache.has(entry.file)) {
    try { cache.set(entry.file, fs.readFileSync(path.join(DIR, entry.file))); } catch { cache.set(entry.file, null); }
  }
  return cache.get(entry.file) ?? null;
}

/** Dimensions d'un PNG (en-tête IHDR), pour garder les proportions dans le fichier Word. */
export function pngSize(png: Buffer): { width: number; height: number } | null {
  if (png.length < 24 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
