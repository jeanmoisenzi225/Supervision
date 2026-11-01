import { describe, expect, it } from "vitest";
import { summarize } from "../src/modules/costs/costs.service";

const r = (amount: string, model: string | null, extra: Record<string, unknown> = {}) => ({
  amount,
  currency: "USD",
  description: model ? `${model} usage` : null,
  model,
  cost_type: model ? "tokens" : "web_search",
  token_type: null,
  workspace_id: null,
  ...extra,
});

describe("dépenses Claude", () => {
  const now = new Date("2026-11-03T15:00:00Z");
  const buckets = [
    { starting_at: "2026-10-31T00:00:00Z", ending_at: "2026-11-01T00:00:00Z", results: [r("5000", "claude-opus-5-5")] },
    { starting_at: "2026-11-01T00:00:00Z", ending_at: "2026-11-02T00:00:00Z", results: [r("123.45", "claude-opus-5-5"), r("10", null)] },
    { starting_at: "2026-11-02T00:00:00Z", ending_at: "2026-11-03T00:00:00Z", results: [r("250", "claude-sonnet-5-5", { workspace_id: "wrk_1" })] },
    { starting_at: "2026-11-03T00:00:00Z", ending_at: "2026-11-04T00:00:00Z", results: [] },
  ];

  it("convertit les centimes en dollars et cumule le mois en cours seulement", () => {
    const s = summarize(buckets, now, { wrk_1: "Procedia" });
    expect(s.monthToDateUsd).toBe(3.83); // 1,2345 + 0,10 + 2,50 (octobre exclu)
    expect(s.yesterdayUsd).toBe(2.5);
    expect(s.todayUsd).toBe(0);
    expect(s.daily.map(([, v]) => v)).toEqual([50, 1.33, 2.5, 0]);
  });

  it("répartit par modèle et par espace de travail", () => {
    const s = summarize(buckets, now, { wrk_1: "Procedia" });
    expect(s.byModel).toEqual([
      { model: "claude-sonnet-5-5", usd: 2.5 },
      { model: "claude-opus-5-5", usd: 1.23 },
      { model: "Recherche web", usd: 0.1 },
    ]);
    expect(s.byWorkspace).toEqual([
      { workspace: "Procedia", usd: 2.5 },
      { workspace: "Espace par défaut", usd: 1.33 },
    ]);
  });
});
