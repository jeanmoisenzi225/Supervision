import { describe, expect, it } from "vitest";
import { minIntervalMinutes, nextFire, parseCron, previousFire } from "../src/modules/jobs/cron";

const d = (s: string) => new Date(s);

describe("expressions cron (UTC)", () => {
  it("retrouve l'échéance précédente et suivante d'une tâche quotidienne", () => {
    expect(previousFire("0 20 * * *", d("2026-11-01T19:59:00Z"))).toEqual(d("2026-10-31T20:00:00Z"));
    expect(previousFire("0 20 * * *", d("2026-11-01T20:00:30Z"))).toEqual(d("2026-11-01T20:00:00Z"));
    expect(nextFire("0 20 * * *", d("2026-11-01T20:00:00Z"))).toEqual(d("2026-11-02T20:00:00Z"));
  });
  it("gère listes, pas et intervalles", () => {
    expect(previousFire("0 7,12,18 * * *", d("2026-11-01T15:00:00Z"))).toEqual(d("2026-11-01T12:00:00Z"));
    expect(previousFire("*/10 * * * *", d("2026-11-01T15:27:00Z"))).toEqual(d("2026-11-01T15:20:00Z"));
    expect(nextFire("30 3 * * 1-5", d("2026-10-31T04:00:00Z"))).toEqual(d("2026-11-02T03:30:00Z")); // samedi → lundi
  });
  it("lit le jour de semaine (0 et 7 = dimanche)", () => {
    expect(nextFire("0 9 * * 7", d("2026-11-02T00:00:00Z"))).toEqual(d("2026-11-08T09:00:00Z"));
  });
  it("calcule l'écart minimal entre deux échéances", () => {
    expect(minIntervalMinutes("0 20 * * *")).toBe(1440);
    expect(minIntervalMinutes("0 7,12,18 * * *")).toBe(300);
    expect(minIntervalMinutes("*/10 * * * *")).toBe(10);
  });
  it("refuse une expression invalide", () => {
    expect(() => parseCron("0 25 * * *")).toThrow();
    expect(() => parseCron("0 20 * *")).toThrow();
  });
});
