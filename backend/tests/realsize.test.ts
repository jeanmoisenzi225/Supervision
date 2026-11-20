import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppTarget } from "../src/config/apps";
import { lastBuckets } from "../src/modules/resources/units";

// v0.43.0 : taille réelle de la base (courbe en direct, sans compactage).
const rows: { key: string; at: Date; value: number }[] = [];
const callApp = vi.fn();
vi.mock("../src/db/prisma", () => ({
  prisma: {
    resourceSample: {
      createMany: vi.fn(async ({ data }: { data: { key: string; at: Date; value: number }[] }) => { rows.push(...data); }),
      findMany: vi.fn(async ({ where }: { where: { key: { in: string[] }; at: { gte: Date } } }) => rows.filter((r) => where.key.in.includes(r.key) && r.at >= where.at.gte).sort((a, b) => a.at.getTime() - b.at.getTime())),
    },
  },
}));
vi.mock("../src/modules/actions/actions.routes", () => ({ callApp: (...a: unknown[]) => callApp(...a) }));
vi.mock("../src/modules/pause/pause.service", () => ({ isPaused: async () => false }));

const { sampleRealSize, realSizeSeries, fetchDeletions, liveKey, diskKey } = await import("../src/modules/resources/realsize");
const app = { key: "procedia", adminUrl: "https://x.test/api", adminToken: "k" } as unknown as AppTarget;
const report = (live: number, disk: number) => ({ at: "2026-11-20T10:00:00Z", diskBytes: disk, liveBytes: live, reusableBytes: disk - live, documents: { count: 419, storedBytes: live, tableBytes: disk } });

beforeEach(() => { rows.length = 0; callApp.mockReset(); });

describe("regroupement par dernière valeur", () => {
  it("garde la dernière valeur de chaque pas, dans l'ordre", () => {
    expect(lastBuckets([[1000, 5], [2000, 7], [61_000, 3], [60_500, 4]], 60)).toEqual([[2000, 7], [61_000, 3]]);
    expect(lastBuckets([], 60)).toEqual([]);
  });
});

describe("relevé de la taille réelle", () => {
  it("garde deux relevés (données utiles et disque) et en tire la place libérée réutilisable", async () => {
    callApp.mockResolvedValueOnce(report(1240e6, 1500e6));
    const r = await sampleRealSize(app, new Date());
    expect(r?.liveBytes).toBe(1240e6);
    expect(callApp).toHaveBeenCalledWith(app, "/supervision/reports/database");
    expect(rows.map((x) => x.key).sort()).toEqual([diskKey("procedia"), liveKey("procedia")]);
    const s = await realSizeSeries("procedia", new Date(Date.now() - 3600_000), 600);
    expect(s?.latest).toMatchObject({ liveBytes: 1240e6, diskBytes: 1500e6, reusableBytes: 260e6 });
  });

  it("la courbe des données utiles baisse après des suppressions pendant que le disque reste au pic", async () => {
    const t = Date.now();
    callApp.mockResolvedValueOnce(report(1500e6, 1500e6));
    await sampleRealSize(app, new Date(t - 20 * 60_000));
    callApp.mockResolvedValueOnce(report(1240e6, 1500e6));
    await sampleRealSize(app, new Date(t - 5 * 60_000));
    const s = (await realSizeSeries("procedia", new Date(t - 3600_000), 60))!;
    expect(s.live.map((p) => p[1])).toEqual([1500e6, 1240e6]);
    expect(s.disk.map((p) => p[1])).toEqual([1500e6, 1500e6]);
  });

  it("une appli qui ne fournit pas le rapport (404) est laissée tranquille une heure", async () => {
    callApp.mockRejectedValue(new Error("L'appli a répondu 404"));
    const now = new Date();
    expect(await sampleRealSize({ ...app, key: "sans-rapport" } as AppTarget, now)).toBeNull();
    expect(await sampleRealSize({ ...app, key: "sans-rapport" } as AppTarget, new Date(now.getTime() + 10 * 60_000))).toBeNull();
    expect(callApp).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(0);
  });

  it("ignore un rapport incomplet, une appli sans administration, et renvoie null sans relevé", async () => {
    callApp.mockResolvedValueOnce({ diskBytes: "x" });
    expect(await sampleRealSize({ ...app, key: "cassee" } as AppTarget)).toBeNull();
    expect(await sampleRealSize({ ...app, key: "nue", adminUrl: "" } as AppTarget)).toBeNull();
    expect(await realSizeSeries("jamais", new Date(Date.now() - 3600_000), 600)).toBeNull();
    expect(rows).toHaveLength(0);
  });
});

describe("repères de suppression de documents", () => {
  it("lit les suppressions de l'appli sur la période demandée, converties en dates", async () => {
    callApp.mockResolvedValueOnce({ deletions: [
      { at: "2026-11-20T12:10:00.000Z", count: 3, manual: 3, auto: 0 },
      { at: "2026-11-20T12:20:00.000Z", count: 1, manual: 0, auto: 1 },
      { at: "n'importe quoi", count: 2, manual: 2, auto: 0 },
      { at: "2026-11-20T12:30:00.000Z", count: 0, manual: 0, auto: 0 },
    ] });
    const d = await fetchDeletions({ ...app, key: "p-del" } as AppTarget, 7);
    expect(callApp).toHaveBeenCalledWith(expect.anything(), "/supervision/reports/database?days=7");
    expect(d).toEqual([
      { at: Date.parse("2026-11-20T12:10:00.000Z"), count: 3, manual: 3, auto: 0 },
      { at: Date.parse("2026-11-20T12:20:00.000Z"), count: 1, manual: 0, auto: 1 },
    ]);
  });
  it("borne la période à 1-90 jours, renvoie une liste vide en cas d'erreur, et laisse une appli sans rapport tranquille", async () => {
    callApp.mockResolvedValueOnce({});
    await fetchDeletions({ ...app, key: "p-b" } as AppTarget, 500);
    expect(callApp).toHaveBeenLastCalledWith(expect.anything(), "/supervision/reports/database?days=90");
    callApp.mockRejectedValueOnce(new Error("boom"));
    expect(await fetchDeletions({ ...app, key: "p-c" } as AppTarget, 1)).toEqual([]);
    callApp.mockRejectedValue(new Error("L'appli a répondu 404"));
    const now = new Date();
    expect(await fetchDeletions({ ...app, key: "p-404" } as AppTarget, 1, now)).toEqual([]);
    callApp.mockClear();
    expect(await fetchDeletions({ ...app, key: "p-404" } as AppTarget, 1, new Date(now.getTime() + 60_000))).toEqual([]);
    expect(callApp).not.toHaveBeenCalled();
  });
});
