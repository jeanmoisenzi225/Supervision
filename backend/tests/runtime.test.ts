import { describe, expect, it } from "vitest";
import { detectRestarts } from "../src/modules/runtime/runtime.service";

const t0 = Date.UTC(2026, 10, 13, 10, 0, 0);
const at = (s: number) => new Date(t0 + s * 1000);
const s = (sec: number, started: number, rss: number | null, ok = true) => ({ at: at(sec), ok, startedAt: ok ? at(started) : null, rssMb: rss });

describe("Redémarrages repérés par la date de démarrage (v0.29.0)", () => {
  it("détecte un redémarrage, avec la dernière mémoire vue avant l'arrêt", () => {
    const r = detectRestarts([s(0, -100, 200), s(15, -100, 430), s(30, -100, 455), s(45, 38, 110), s(60, 38, 120)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ lastRssMb: 455, kind: "memory" });
  });
  it("un redémarrage à faible mémoire n'est pas une saturation", () => {
    const r = detectRestarts([s(0, -100, 180), s(15, 12, 100)]);
    expect(r[0]).toMatchObject({ lastRssMb: 180, kind: "other" });
  });
  it("ignore les relevés en échec et ne signale rien sans changement", () => {
    expect(detectRestarts([s(0, -100, 200), s(15, 0, null, false), s(30, -100, 210)])).toEqual([]);
  });
});
