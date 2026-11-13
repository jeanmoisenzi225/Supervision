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

import { deployNear } from "../src/modules/runtime/runtime.service";
describe("Redémarrage dû à une mise en ligne (v0.32.1)", () => {
  const ev = (type: string, ts: string) => ({ event: { id: "x", type, timestamp: ts } });
  it("reconnaît un déploiement lancé juste avant le démarrage", () => {
    expect(deployNear([ev("deploy_started", "2026-11-13T12:47:14Z")], new Date("2026-11-13T12:47:58Z"))).toBe(true);
  });
  it("ignore un déploiement ancien ou postérieur", () => {
    expect(deployNear([ev("deploy_started", "2026-11-13T11:00:00Z")], new Date("2026-11-13T12:47:58Z"))).toBe(false);
    expect(deployNear([ev("deploy_started", "2026-11-13T13:30:00Z")], new Date("2026-11-13T12:47:58Z"))).toBe(false);
    expect(deployNear([ev("server_failed", "2026-11-13T12:47:30Z")], new Date("2026-11-13T12:47:58Z"))).toBe(false);
  });
});

import { isMemoryRestart, pushRecent } from "../src/modules/runtime/runtime.service";
describe("Redémarrage : saturation ou mise en ligne (v0.33.3)", () => {
  it("un redémarrage après une mise en ligne n'est jamais une saturation, même avec un pic ancien à 405 Mo", () => {
    // 405 Mo vu tôt dans la vie du processus, puis 290 Mo juste avant la mise en ligne.
    let r: number[] = [];
    for (const v of [405, 330, 290, 290, 290]) r = pushRecent(r, v);
    expect(isMemoryRestart(r, true)).toBe(false);
    expect(isMemoryRestart(r, false)).toBe(true); // sans déploiement, le pic récent compte
  });
  it("le pic ne porte que sur les derniers relevés", () => {
    let r: number[] = [405];
    for (let i = 0; i < 8; i++) r = pushRecent(r, 280);
    expect(r).toHaveLength(8);
    expect(isMemoryRestart(r, false)).toBe(false);
  });
  it("une mémoire élevée juste avant l'arrêt, sans déploiement, reste une saturation", () => {
    expect(isMemoryRestart([300, 470, 480], false)).toBe(true);
  });
});

import { stamp } from "../src/utils/time";
describe("Dates des textes du serveur (v0.34.0)", () => {
  it("sont écrites sous forme de repère que l'interface passe à l'heure de l'appareil", () => {
    expect(stamp(new Date("2026-11-13T17:55:58Z"))).toBe("⟦2026-11-13T17:55:58.000Z⟧");
  });
});
