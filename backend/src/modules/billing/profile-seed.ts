import { prisma } from "../../db/prisma";

/**
 * Remplissage initial du profil prestataire (v0.46.3) : si la variable BILLING_PROFILE_SEED (JSON) est présente,
 * ses champs complètent le profil de facturation, **sans jamais écraser** une valeur déjà saisie dans l'application.
 * Permet de renseigner l'identité sans la mettre dans le dépôt ; la variable peut être retirée ensuite.
 */
const ALLOWED = ["legalName", "legalForm", "businessAddress", "contactEmail", "phone"] as const;

export function mergeSeed(current: Record<string, unknown>, seed: Record<string, unknown>): { merged: Record<string, unknown>; changed: string[] } {
  const merged = { ...current };
  const changed: string[] = [];
  for (const key of ALLOWED) {
    const value = seed[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const existing = merged[key];
    if (typeof existing === "string" && existing.trim()) continue;
    merged[key] = value.trim();
    changed.push(key);
  }
  return { merged, changed };
}

export async function seedBillingProfile(raw = process.env.BILLING_PROFILE_SEED): Promise<void> {
  if (!raw || !raw.trim()) return;
  try {
    const seed = JSON.parse(raw) as Record<string, unknown>;
    const row = await prisma.setting.findUnique({ where: { key: "billing.profile" } });
    const current = row ? (JSON.parse(row.value) as Record<string, unknown>) : { brandName: "NJMDev", country: "Côte d’Ivoire", defaultCurrency: "XOF", fxMode: "market", legalProfileComplete: false };
    const { merged, changed } = mergeSeed(current, seed);
    if (!changed.length) return;
    const value = JSON.stringify(merged);
    await prisma.setting.upsert({ where: { key: "billing.profile" }, create: { key: "billing.profile", value }, update: { value } });
    console.log(`[facturation] profil prestataire complété : ${changed.join(", ")}`);
  } catch (err) {
    console.error("[facturation] BILLING_PROFILE_SEED ignorée :", (err as Error).message);
  }
}
