import { describe, expect, it } from "vitest";
import { failuresSince, type RenderEvent } from "../src/modules/renderEvents/renderEvents.service";

const ev = (id: string, type: string, timestamp: string, reason: object = {}): RenderEvent => ({ event: { id, type, timestamp, details: { reason } } });

describe("Arrêts du service signalés par Render", () => {
  const events = [
    ev("c", "server_failed", "2026-11-13T10:49:55Z", { evicted: false, oomKilled: { memoryLimit: "512Mi" } }),
    ev("b", "server_available", "2026-11-13T10:28:25Z"),
    ev("a", "server_failed", "2026-11-13T10:10:27Z", { evicted: false, oomKilled: { memoryLimit: "512Mi" } }),
    ev("d", "server_failed", "2026-11-13T09:00:00Z", { evicted: true }),
  ];
  it("ne garde que les arrêts récents, du plus ancien au plus récent, et reconnaît la mémoire saturée", () => {
    const f = failuresSince(events, new Date("2026-11-13T10:00:00Z"));
    expect(f.map((x) => x.id)).toEqual(["a", "c"]);
    expect(f[0]).toMatchObject({ kind: "memory", memoryLimit: "512Mi" });
  });
  it("distingue un autre type d'arrêt", () => {
    const f = failuresSince(events, new Date("2026-11-13T08:00:00Z"));
    expect(f[0]).toMatchObject({ id: "d", kind: "other", memoryLimit: null });
  });
  it("ne renvoie rien si tout est déjà vu", () => {
    expect(failuresSince(events, new Date("2026-11-13T11:00:00Z"))).toEqual([]);
  });
});

import { errorRate } from "../src/modules/renderEvents/renderEvents.service";
import { restartsWithin } from "../src/modules/runtime/runtime.service";
describe("Alertes de tendance (v0.32.0)", () => {
  it("calcule la part des erreurs 5xx", () => {
    const s = [
      { labels: { statusCode: "200" }, points: [[0, 60], [1, 20]] as [number, number][] },
      { labels: { statusCode: "502" }, points: [[0, 15], [1, 5]] as [number, number][] },
    ];
    expect(errorRate(s)).toEqual({ total: 100, errors: 20, rate: 0.2 });
    expect(errorRate([])).toEqual({ total: 0, errors: 0, rate: 0 });
  });
  it("compte les redémarrages dans la fenêtre", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const r = (min: number) => ({ at: new Date(now.getTime() - min * 60_000), lastRssMb: 300, kind: "other" as const });
    expect(restartsWithin([r(5), r(20), r(59), r(90)], now, 3600_000)).toBe(3);
  });
});
