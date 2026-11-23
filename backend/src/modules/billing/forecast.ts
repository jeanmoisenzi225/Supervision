import { Prisma } from "@prisma/client";
import type { BillingApp } from "../hosting/hosting.service";

/**
 * Lignes d'une facture prévisionnelle (v0.19.0) : les coûts d'hébergement et d'IA de la page « Coûts »,
 * repris tels quels (un poste = une ligne), convertis dans la devise du document. Les lignes restent
 * modifiables dans le brouillon ; la facture définitive sera établie après la facture de Render.
 */

export type Currency = "XOF" | "EUR" | "USD";

export interface ForecastLine {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  source: "hosting" | "claude";
  /** Montant d'origine en dollars : sert à recalculer la ligne si le taux change. */
  usd: number;
  /** Détail technique (nom du service, offre…), réservé à l'application : jamais imprimé sur les documents du client. */
  tech?: string;
}

export interface ForecastResult {
  lines: ForecastLine[];
  /** Postes gratuits ou suspendus non repris (0 $). */
  skippedFree: number;
  /** Postes dont l'offre est inconnue de la table des tarifs : non repris, à saisir à la main. */
  warnings: string[];
}

/** Prix converti dans la devise du document : 0 décimale pour le franc CFA, 2 sinon. */
export function convertUsd(usd: number, currency: Currency, usdRate: number): number {
  const precision = currency === "XOF" ? 0 : 2;
  return new Prisma.Decimal(usd).mul(currency === "USD" ? 1 : usdRate).toDecimalPlaces(precision).toNumber();
}

const KIND_LABEL = { service: "service", database: "base de données", disk: "" } as const;

export function forecastLines(apps: Pick<BillingApp, "name" | "render" | "claude">[], currency: Currency, usdRate: number, includeClaude: boolean): ForecastResult {
  const lines: ForecastLine[] = [];
  const warnings: string[] = [];
  let skippedFree = 0;
  for (const app of apps) {
    for (const l of app.render.lines) {
      if (l.usd === null) {
        warnings.push(`${app.name} : « ${l.name} » (offre ${l.plan}) n'a pas de tarif connu, à saisir à la main.`);
        continue;
      }
      if (l.usd === 0) {
        skippedFree++;
        continue;
      }
      // Intitulés compréhensibles par le client ; le nom technique reste dans `tech`, visible seulement dans l'application.
      const tech = l.kind === "disk" ? `${l.name} (${l.plan})` : `${KIND_LABEL[l.kind]} ${l.name} (offre ${l.plan})`;
      const what =
        l.kind === "service" ? "Serveur de l'application (fonctionnement et traitements)"
        : l.kind === "database" ? "Base de données (conservation des données de l'application)"
        : /^Stockage de/.test(l.name) ? `Espace de stockage de la base de données (${l.plan})`
        : `Espace de stockage de l'application (${l.plan})`;
      lines.push({ description: `${app.name} — hébergement : ${what}`, quantity: 1, unitPrice: convertUsd(l.usd, currency, usdRate), discountPercent: 0, vatRate: 0, source: "hosting", usd: l.usd, tech });
    }
    if (includeClaude) {
      // Une seule ligne par appli : les espaces de travail Claude de l'appli sont cumulés (v0.25.0).
      const spaces = app.claude.workspaces.filter((w) => w.usd > 0);
      const total = Math.round(spaces.reduce((t, w) => t + w.usd, 0) * 100) / 100;
      if (total > 0) {
        const detail = spaces.length > 1 ? `espaces ${spaces.map((w) => `« ${w.workspace} »`).join(" et ")}` : `espace « ${spaces[0].workspace} »`;
        lines.push({ description: `${app.name} — intelligence artificielle : traitements automatisés (consommation du mois en cours)`, quantity: 1, unitPrice: convertUsd(total, currency, usdRate), discountPercent: 0, vatRate: 0, source: "claude", usd: total, tech: `Claude, ${detail}` });
      }
    }
  }
  return { lines, skippedFree, warnings };
}
