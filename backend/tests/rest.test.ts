import { describe, expect, it } from "vitest";
import { importEpisodes, notSettled, restLimit, type RestSample } from "../src/modules/runtime/rest";

const MIN = 60_000;
const s = (min: number, rssMb: number, imports: number): RestSample => ({ at: min * MIN, ok: true, rssMb, imports });

describe("retour de la mémoire au repos", () => {
  it("tolérance : 15 % ou 30 Mo au minimum", () => {
    expect(restLimit(200)).toBe(230);
    expect(restLimit(300)).toBe(345);
  });

  it("mesure le pic et le temps de retour au niveau de base", () => {
    const e = importEpisodes([s(0, 200, 0), s(1, 205, 0), s(2, 300, 1), s(3, 420, 1), s(4, 380, 0), s(5, 300, 0), s(6, 225, 0), s(7, 210, 0)]);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ startAt: 2 * MIN, endAt: 4 * MIN, baselineMb: 200, peakMb: 420, restAt: 6 * MIN, restAfterSec: 120, interrupted: false });
  });

  it("mémoire qui ne redescend pas : pas de retour au repos, signalé après 15 minutes", () => {
    const samples = [s(0, 200, 0), s(1, 400, 1), s(2, 380, 0)];
    for (let m = 3; m <= 20; m++) samples.push(s(m, 340, 0));
    const e = importEpisodes(samples);
    expect(e[0]).toMatchObject({ restAt: null, restAfterSec: null, lastMb: 340 });
    expect(notSettled(e, 20 * MIN)).not.toBeNull();
    expect(notSettled(e, 10 * MIN)).toBeNull(); // trop tôt
  });

  it("un nouvel import avant le retour au repos interrompt l'attente", () => {
    const e = importEpisodes([s(0, 200, 0), s(1, 400, 1), s(2, 380, 0), s(3, 410, 1), s(4, 390, 0), s(5, 210, 0)]);
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ interrupted: true, restAt: null });
    expect(e[1]).toMatchObject({ restAt: 5 * MIN, interrupted: false });
    expect(notSettled(importEpisodes([s(0, 200, 0), s(1, 400, 1), s(2, 380, 0), s(3, 410, 1)]), 99 * MIN)).toBeNull(); // import en cours
  });

  it("épisode en cours, relevés manquants et sans niveau de base", () => {
    const ongoing = importEpisodes([s(0, 200, 0), s(1, 300, 1), s(2, 320, 1)]);
    expect(ongoing[0]).toMatchObject({ endAt: null, peakMb: 320 });
    expect(importEpisodes([{ at: 0, ok: false, rssMb: null, imports: null }, { at: MIN, ok: true, rssMb: 100, imports: 0 }])).toEqual([]);
    const noBase = importEpisodes([s(0, 300, 1), s(1, 250, 0)]);
    expect(noBase[0]).toMatchObject({ baselineMb: null, restAt: null });
    expect(notSettled(noBase, 99 * MIN)).toBeNull();
  });
});
