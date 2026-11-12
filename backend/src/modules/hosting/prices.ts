/**
 * Tarifs publics de Render (dollars par mois), relevés le 2026-11-12 sur
 * https://render.com/pricing. Render n'expose aucune route de facturation :
 * la facturation est donc une ESTIMATION à partir des offres des services
 * et des bases (hors bande passante, minutes de construction et forfait de
 * l'espace de travail). À remettre à jour quand Render change ses tarifs.
 */
export const PRICES_AS_OF = "2026-11-12";
export const PRICES_SOURCE = "render.com/pricing";

/** Services web, services privés, tâches de fond (par offre ; anciens noms inclus). */
const COMPUTE: Record<string, number> = {
  free: 0,
  "0.5c-512mb": 7,
  starter: 7,
  "1c-2g": 25,
  standard: 25,
  "2c-4g": 85,
  pro: 85,
  "2c-8g": 135,
  "2c-16g": 200,
  "4c-8g": 175,
  pro_plus: 175,
  "4c-16g": 225,
  pro_max: 225,
  "4c-32g": 350,
  "8c-16g": 300,
  "8c-32g": 450,
  pro_ultra: 450,
  "8c-64g": 1000,
  "12c-24g": 450,
  "12c-48g": 800,
  "12c-96g": 1500,
};

/** Bases PostgreSQL (par offre ; anciens noms inclus). Le stockage se facture à part. */
const POSTGRES: Record<string, number> = {
  free: 0,
  "0.1c-256mb": 6,
  basic_256mb: 6,
  "0.5c-1g": 19,
  basic_1gb: 19,
  "1c-2g": 40,
  "1c-4g": 55,
  pro_4gb: 55,
  "2c-4g": 75,
  basic_4gb: 75,
  "2c-8g": 100,
  pro_8gb: 100,
  "2c-16g": 160,
  accelerated_16gb: 160,
  "4c-16g": 200,
  pro_16gb: 200,
};

/** Stockage d'une base (dollars par Go et par mois) et disque persistant d'un service. */
export const DB_STORAGE_USD_PER_GB = 0.3;
export const DISK_USD_PER_GB = 0.25;

/** Cherche une offre sous son nom tel quel (« 0.5c-512mb »), puis sous l'ancien nom (« pro-plus » → « pro_plus »). */
function find(table: Record<string, number>, plan: string | null | undefined): number | null {
  const p = (plan ?? "").toLowerCase().trim();
  if (p in table) return table[p];
  const legacy = p.replace(/-/g, "_");
  return legacy in table ? table[legacy] : null;
}

/** Prix mensuel d'une offre de service, ou null si l'offre est inconnue. Un site statique est gratuit. */
export function computeUsd(type: string | undefined, plan: string | null | undefined): number | null {
  if (type === "static_site") return 0;
  return find(COMPUTE, plan);
}

/** Prix mensuel de l'offre d'une base (hors stockage), ou null si l'offre est inconnue. */
export function postgresUsd(plan: string | null | undefined): number | null {
  return find(POSTGRES, plan);
}
