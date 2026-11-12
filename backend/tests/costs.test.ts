import { afterEach, describe, expect, it, vi } from "vitest";
import { costWindow, summarize } from "../src/modules/costs/costs.service";

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

describe("journée en cours dans le rapport de coûts (v0.24.1)", () => {
  it("demande jusqu'à la fin de demain pour inclure la journée en cours", () => {
    const { start, end } = costWindow(new Date("2026-11-12T17:19:00Z"));
    expect(start.toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-14T00:00:00.000Z");
  });

  it("compte la journée en cours dans « aujourd'hui » et le mois, et ignore les journées à venir", () => {
    const now = new Date("2026-11-12T17:19:00Z");
    const buckets = [
      { starting_at: "2026-11-11T00:00:00Z", ending_at: "2026-11-12T00:00:00Z", results: [r("3243", "claude-sonnet-5-5")] },
      { starting_at: "2026-11-12T00:00:00Z", ending_at: "2026-11-13T00:00:00Z", results: [r("3081", "claude-opus-5-5")] },
      { starting_at: "2026-11-13T00:00:00Z", ending_at: "2026-11-14T00:00:00Z", results: [] },
    ];
    const s = summarize(buckets, now);
    expect(s.todayUsd).toBe(30.81);
    expect(s.yesterdayUsd).toBe(32.43);
    expect(s.monthToDateUsd).toBe(63.24);
    expect(s.daily).toHaveLength(2);
  });
});

describe("lecture du rapport (requêtes vers Anthropic)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("envoie ending_at, et retombe sur l'ancienne demande si Anthropic la refuse", async () => {
    process.env.ANTHROPIC_ADMIN_KEY = "sk-ant-admin-test";
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        if (String(url).includes("/cost_report") && String(url).includes("ending_at")) return new Response('{"error":{"message":"ending_at invalide"}}', { status: 400 });
        if (String(url).includes("/cost_report")) return new Response(JSON.stringify({ data: [], has_more: false, next_page: null }), { status: 200 });
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      })
    );
    vi.resetModules();
    const { getCosts } = await import("../src/modules/costs/costs.service");
    const c = await getCosts(true);
    expect(c.error).toBeUndefined();
    const reports = urls.filter((u) => u.includes("/cost_report"));
    expect(reports[0]).toContain("ending_at=");
    expect(reports[1]).not.toContain("ending_at");
    delete process.env.ANTHROPIC_ADMIN_KEY;
  });
});
