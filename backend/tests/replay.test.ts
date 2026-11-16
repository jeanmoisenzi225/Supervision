import { describe, expect, it } from "vitest";
import { buildCells } from "../src/modules/replay/replay.service";

const MIN = 60_000;
const at = (m: number) => m * MIN;

describe("rejeu : cases d'état", () => {
  it("ok, dégradé, arrêt et sans relevé", () => {
    const checks = [
      { at: at(1), ok: true, latencyMs: 100 },
      { at: at(2), ok: true, latencyMs: 200 }, // case 0 : ok, 150 ms
      { at: at(6), ok: true, latencyMs: 100 },
      { at: at(7), ok: false, latencyMs: null }, // case 1 : dégradé
      { at: at(11), ok: false, latencyMs: null }, // case 2 : arrêt
    ];
    const cells = buildCells(checks, [], 0, 5 * MIN, 4);
    expect(cells.map((c) => c.s)).toEqual(["ok", "w", "b", null]);
    expect(cells[0].ms).toBe(150);
    expect(cells[2].ms).toBeNull();
  });
  it("mémoire moyenne par case, relevés hors fenêtre ignorés", () => {
    const cells = buildCells([], [{ at: at(1), ok: true, rssMb: 200 }, { at: at(3), ok: true, rssMb: 220 }, { at: at(4), ok: false, rssMb: null }, { at: at(99), ok: true, rssMb: 999 }, { at: at(-5), ok: true, rssMb: 999 }], 0, 5 * MIN, 2);
    expect(cells[0].mem).toBe(210);
    expect(cells[1].mem).toBeNull();
  });
});
