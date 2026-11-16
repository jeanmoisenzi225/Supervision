import { describe, expect, it } from "vitest";
import { addWeeks, parseWeek, weekKey, weekStartOf, weekView, type ObjectiveRow } from "../src/modules/objectives/weeks";

const d = (s: string) => new Date(s);
const row = (id: string, created: string, done: string | null = null, title = id): ObjectiveRow => ({
  id,
  title,
  weekStart: weekStartOf(d(created)),
  doneAt: done ? d(done) : null,
  createdAt: d(created),
});

describe("semaines (lundi à dimanche)", () => {
  it("ramène n'importe quel jour au lundi 00:00 UTC", () => {
    expect(weekKey(weekStartOf(d("2026-11-16T09:30:00Z")))).toBe("2026-11-16"); // lundi
    expect(weekKey(weekStartOf(d("2026-11-22T23:59:59Z")))).toBe("2026-11-16"); // dimanche
    expect(weekKey(weekStartOf(d("2026-11-23T00:00:00Z")))).toBe("2026-11-23");
  });
  it("lit une date de semaine", () => {
    expect(weekKey(parseWeek("2026-11-18")!)).toBe("2026-11-16");
    expect(parseWeek("demain")).toBeNull();
    expect(parseWeek("2026-13-45")).toBeNull();
    expect(parseWeek(undefined)).toBeNull();
  });
  it("avance de semaine en semaine", () => {
    expect(weekKey(addWeeks(d("2026-11-16T00:00:00Z"), 1))).toBe("2026-11-23");
    expect(weekKey(addWeeks(d("2026-11-16T00:00:00Z"), -2))).toBe("2026-11-02");
  });
});

describe("objectifs de la semaine", () => {
  const now = d("2026-11-25T10:00:00Z"); // semaine du 23 novembre
  const rows = [
    row("a", "2026-11-16T09:00:00Z", "2026-11-17T12:00:00Z"), // créé et validé la semaine du 16
    row("b", "2026-11-17T09:00:00Z", "2026-11-24T08:00:00Z"), // reporté, validé la semaine du 23
    row("c", "2026-11-18T09:00:00Z"), // jamais validé : reporté
    row("d", "2026-11-24T09:00:00Z"), // créé cette semaine
  ];

  it("la semaine passée montre ce qui y était à faire, avec sa progression", () => {
    const v = weekView(rows, parseWeek("2026-11-16")!, now);
    expect(v.items.map((i) => [i.id, i.done, i.carried])).toEqual([["a", true, 0], ["b", false, 0], ["c", false, 0]]);
    expect(v.progress).toEqual({ done: 1, total: 3 });
    expect(v.current).toBe(false);
    expect(v.next).toBe("2026-11-23");
    expect(v.previous).toBe("2026-11-09");
  });

  it("les objectifs non validés sont reportés sur la semaine suivante", () => {
    const v = weekView(rows, parseWeek("2026-11-23")!, now);
    expect(v.items.map((i) => [i.id, i.done, i.carried])).toEqual([["b", true, 1], ["c", false, 1], ["d", false, 0]]);
    expect(v.progress).toEqual({ done: 1, total: 3 });
    expect(v.current).toBe(true);
    expect(v.next).toBeNull();
    expect(v.week).toBe("2026-11-23");
    expect(v.weekEnd).toBe("2026-11-29");
  });

  it("un objectif validé n'est plus reporté après sa semaine de validation", () => {
    const v = weekView(rows, parseWeek("2026-11-23")!, now);
    expect(v.items.find((i) => i.id === "a")).toBeUndefined();
  });

  it("une semaine future est vide ; une semaine sans objectif aussi", () => {
    expect(weekView(rows, parseWeek("2026-11-30")!, now).items).toEqual([]);
    expect(weekView(rows, parseWeek("2026-11-02")!, now).progress).toEqual({ done: 0, total: 0 });
  });
});
