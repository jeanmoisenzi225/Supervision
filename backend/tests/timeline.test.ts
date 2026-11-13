import { describe, expect, it } from "vitest";
import { availability, mergeTimeline, renderEventItem } from "../src/modules/timeline/timeline.service";

const ev = (type: string, details: Record<string, unknown> = {}) => ({ id: "e", type, timestamp: "2026-11-13T10:49:55Z", details });

describe("Chronologie des incidents (v0.31.0)", () => {
  it("convertit les événements Render utiles et ignore le bruit", () => {
    expect(renderEventItem(ev("server_failed", { reason: { oomKilled: { memoryLimit: "512Mi" } } }))).toMatchObject({ kind: "render-failed", level: "critical", title: expect.stringContaining("mémoire saturée"), detail: "Limite 512Mi" });
    expect(renderEventItem(ev("server_failed", { reason: { evicted: true } }))).toMatchObject({ title: "Service arrêté par Render" });
    expect(renderEventItem(ev("server_available"))).toMatchObject({ level: "ok" });
    expect(renderEventItem(ev("deploy_ended", { deployStatus: "succeeded" }))).toMatchObject({ kind: "deploy", level: "ok" });
    expect(renderEventItem(ev("deploy_ended", { deployStatus: "build_failed" }))).toMatchObject({ kind: "deploy-failed" });
    expect(renderEventItem(ev("build_ended", { buildStatus: "succeeded" }))).toBeNull();
    expect(renderEventItem(ev("build_started"))).toBeNull();
  });
  it("trie du plus récent au plus ancien", () => {
    const m = mergeTimeline([{ at: 1, kind: "alert", level: "info", title: "a" }], [{ at: 3, kind: "deploy", level: "info", title: "c" }, { at: 2, kind: "restart", level: "warning", title: "b" }]);
    expect(m.map((x) => x.title)).toEqual(["c", "b", "a"]);
  });
  it("calcule la disponibilité", () => {
    expect(availability(997, 1000)).toBe(99.7);
    expect(availability(0, 0)).toBeNull();
  });
});
