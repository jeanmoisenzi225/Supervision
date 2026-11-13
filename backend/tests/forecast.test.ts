import { describe, expect, it } from "vitest";
import { convertUsd, forecastLines } from "../src/modules/billing/forecast";

const procedia = {
  name: "Procedia",
  render: {
    usd: 14.5,
    unknown: 1,
    lines: [
      { kind: "service" as const, name: "procedia-backend", plan: "0.5c-512mb", usd: 7 },
      { kind: "service" as const, name: "procedia-frontend", plan: "site statique", usd: 0, note: "site statique gratuit" },
      { kind: "database" as const, name: "procedia-db", plan: "0.1c-256mb", usd: 6 },
      { kind: "disk" as const, name: "Stockage de procedia-db", plan: "5 Go", usd: 1.5 },
      { kind: "service" as const, name: "procedia-x", plan: "2c-99g", usd: null },
    ],
  },
  claude: { usd: 12.5, workspaces: [{ workspace: "Procedia", usd: 12.5 }] },
};

describe("facture prévisionnelle : lignes importées des coûts", () => {
  it("convertit les dollars selon la devise (0 décimale en francs CFA)", () => {
    expect(convertUsd(7, "USD", 999)).toBe(7);
    expect(convertUsd(7, "EUR", 0.92)).toBe(6.44);
    expect(convertUsd(6, "XOF", 605.5)).toBe(3633);
    expect(convertUsd(1.5, "XOF", 605.5)).toBe(908);
  });

  it("reprend chaque poste tel quel, une ligne par poste, avec l'origine de la ligne", () => {
    const r = forecastLines([procedia], "USD", 1, true);
    expect(r.lines.map((l) => [l.description, l.unitPrice, l.source])).toEqual([
      ["Procedia — hébergement : service procedia-backend (offre 0.5c-512mb)", 7, "hosting"],
      ["Procedia — hébergement : base de données procedia-db (offre 0.1c-256mb)", 6, "hosting"],
      ["Procedia — hébergement : Stockage de procedia-db (5 Go)", 1.5, "hosting"],
      ["Procedia — intelligence artificielle (Claude) : espace « Procedia », dépenses du mois en cours", 12.5, "claude"],
    ]);
    expect(r.lines.every((l) => l.quantity === 1 && l.discountPercent === 0 && l.vatRate === 0)).toBe(true);
    expect(r.skippedFree).toBe(1);
  });

  it("signale une offre inconnue sans l'inventer, et peut exclure Claude", () => {
    const r = forecastLines([procedia], "EUR", 0.92, false);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain("procedia-x");
    expect(r.lines.some((l) => l.source === "claude")).toBe(false);
    expect(r.lines[0].unitPrice).toBe(6.44);
  });

  it("cumule en une seule ligne les espaces de travail Claude d'une même appli", () => {
    const app = { ...procedia, claude: { usd: 83.45, workspaces: [{ workspace: "Procedia", usd: 8.5 }, { workspace: "Espace par défaut", usd: 74.95 }] } };
    const r = forecastLines([app], "USD", 1, true);
    const claude = r.lines.filter((l) => l.source === "claude");
    expect(claude).toHaveLength(1);
    expect(claude[0].unitPrice).toBe(83.45);
    expect(claude[0].usd).toBe(83.45);
    expect(claude[0].description).toContain("« Procedia » et « Espace par défaut »");
  });
});
