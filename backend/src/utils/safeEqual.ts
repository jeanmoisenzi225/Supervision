import { createHash, timingSafeEqual } from "crypto";

/** Comparaison de jetons à durée constante (pas de fuite par le temps de réponse). */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
