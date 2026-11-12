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
      const what = l.kind === "disk" ? `${l.name} (${l.plan})` : `${KIND_LABEL[l.kind]} ${l.name} (offre ${l.plan})`;
      lines.push({ description: `${app.name} — hébergement : ${what}`, quantity: 1, unitPrice: convertUsd(l.usd, currency, usdRate), discountPercent: 0, vatRate: 0, source: "hosting" });
    }
    if (includeClaude) {
      for (const w of app.claude.workspaces) {
        if (w.usd <= 0) continue;
        lines.push({ description: `${app.name} — intelligence artificielle (Claude) : espace « ${w.workspace} », dépenses du mois en cours`, quantity: 1, unitPrice: convertUsd(w.usd, currency, usdRate), discountPercent: 0, vatRate: 0, source: "claude" });
      }
    }
  }
  return { lines, skippedFree, warnings };
}
