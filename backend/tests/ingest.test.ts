import { describe, expect, it } from "vitest";
import { buildApps, parseUrlsEnv } from "../src/config/apps";
import { cleanEntry, errorFingerprint, ingestLogsSchema } from "../src/modules/logs/ingest";
import { safeEqual } from "../src/utils/safeEqual";

describe("ingestLogsSchema", () => {
  it("normalise les niveaux courants", () => {
    const parsed = ingestLogsSchema.parse({ entries: [{ level: "WARNING", message: "a" }, { level: "critical", message: "b" }] });
    expect(parsed.entries.map((e) => e.level)).toEqual(["warn", "fatal"]);
  });
  it("refuse un lot vide ou trop gros", () => {
    expect(() => ingestLogsSchema.parse({ entries: [] })).toThrow();
    expect(() => ingestLogsSchema.parse({ entries: Array.from({ length: 501 }, () => ({ message: "x" })) })).toThrow();
  });
});

describe("cleanEntry", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("ramène une date future à maintenant et tronque le message", () => {
    const e = cleanEntry({ level: "info", message: "x".repeat(5000), at: new Date("2030-01-01") }, now);
    expect(e.at).toEqual(now);
    expect(e.message).toHaveLength(4000);
  });
  it("résume un contexte trop volumineux", () => {
    const e = cleanEntry({ level: "info", message: "x", context: { big: "y".repeat(10_000) } }, now);
    expect(e.context).toMatchObject({ _tronque: true });
  });
});

describe("errorFingerprint", () => {
  it("regroupe la même erreur avec des identifiants différents", () => {
    expect(errorFingerprint("Facture 123 introuvable")).toBe(errorFingerprint("Facture 4567 introuvable"));
    expect(errorFingerprint("Garage clx9a8b7c6d5e4f3g2h1i0 absent")).toBe(errorFingerprint("Garage cly1b2c3d4e5f6g7h8i9j0 absent"));
    expect(errorFingerprint("Erreur A")).not.toBe(errorFingerprint("Erreur B"));
  });
});

describe("configuration des applis", () => {
  it("lit les adresses depuis la variable <APPLI>_URLS", () => {
    expect(parseUrlsEnv("api|API|https://a.onrender.com/api/health, https://b.com/")).toEqual([
      { id: "api", label: "API", url: "https://a.onrender.com/api/health", expect: "health" },
      { id: "url2", label: "url2", url: "https://b.com/", expect: "2xx" },
    ]);
  });
  it("donne un délai long aux services mis en veille", () => {
    const env: Record<string, string> = { PROCEDIA_URLS: "api|API|https://p.onrender.com/api/health", PROCEDIA_INGEST_TOKEN: "t" };
    const procedia = buildApps((n) => env[n] ?? "").find((a) => a.key === "procedia")!;
    expect(procedia.checks[0].timeoutMs).toBe(90_000);
    expect(procedia.ingestToken).toBe("t");
  });
});

describe("safeEqual", () => {
  it("ne valide jamais un jeton vide", () => {
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});

describe("sujet des notifications", async () => {
  const { vapidSubject } = await import("../src/modules/push/push.service");
  it("n'utilise jamais une adresse http (refusée par web-push)", () => {
    expect(vapidSubject()).toMatch(/^(https:|mailto:)/);
  });
});

describe("adresses par défaut", () => {
  it("surveille Procedia sans variable, avec le délai d'un service en veille", () => {
    const procedia = buildApps(() => "").find((a) => a.key === "procedia")!;
    expect(procedia.checks.map((c) => c.url)).toEqual([
      "https://procedia-backend.onrender.com/api/health",
      "https://procedia-frontend.onrender.com/",
    ]);
    expect(procedia.checks.every((c) => c.timeoutMs === 90_000)).toBe(true);
    expect(procedia.intervalSec).toBe(1800);
  });
});
