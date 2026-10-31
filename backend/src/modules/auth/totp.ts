import { authenticator } from "otplib";

// Tolère un pas de 30 s d'avance ou de retard (horloge du téléphone).
authenticator.options = { window: 1 };

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, "Supervision", secret);
}

/**
 * Vérifie un code à 6 chiffres. Renvoie le pas de temps accepté, ou null.
 * Un code déjà utilisé (même pas que lastStep) est refusé : il ne peut pas
 * être rejoué.
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null, now = Date.now()): number | null {
  const token = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return null;
  const delta = authenticator.checkDelta(token, secret);
  if (delta === null) return null;
  const step = Math.floor(now / 30_000) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}
