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

describe("reconnaissance des services Render", async () => {
  const { matchServices } = await import("../src/modules/actions/render");
  const services = [
    { id: "srv-1", name: "garage-backend", url: "https://garage-backend-r7i3.onrender.com" },
    { id: "srv-2", name: "garage-frontend", url: "https://garage-frontend-a7uv.onrender.com" },
    { id: "srv-3", name: "agent-brvm", url: "https://agent-brvm.onrender.com" },
    { id: "srv-4", name: "procedia-backend", url: "https://procedia-backend.onrender.com" },
    { id: "srv-5", name: "supervision", url: "https://supervision-20zi.onrender.com" },
    { id: "srv-6", name: "nom-libre", url: "https://autonova-group.ci" },
  ];
  const ids = (key: string) => matchServices(buildApps(() => "").find((a) => a.key === key)!.renderMatch, services).map((s) => s.id);

  it("rattache chaque service à la bonne appli", () => {
    expect(ids("mga")).toEqual(["srv-1", "srv-2"]);
    expect(ids("yiri")).toEqual(["srv-3"]);
    expect(ids("procedia")).toEqual(["srv-4"]);
    expect(ids("site-autonova")).toEqual(["srv-6"]);
    expect(ids("my-family")).toEqual([]);
  });

  it("ne rattache jamais la supervision elle-même", () => {
    for (const key of ["mga", "yiri", "procedia", "site-autonova", "my-family"]) expect(ids(key)).not.toContain("srv-5");
  });
});

describe("code à 6 chiffres", async () => {
  const { authenticator } = await import("otplib");
  const { verifyTotp, generateTotpSecret } = await import("../src/modules/auth/totp");
  const secret = generateTotpSecret();

  it("accepte le code du moment, une seule fois", () => {
    const code = authenticator.generate(secret);
    const step = verifyTotp(secret, code, null);
    expect(step).not.toBeNull();
    expect(verifyTotp(secret, code, step)).toBeNull();
  });

  it("refuse un code faux ou mal formé, tolère les espaces", () => {
    expect(verifyTotp(secret, "000000", null) === null || authenticator.generate(secret) === "000000").toBe(true);
    expect(verifyTotp(secret, "12345", null)).toBeNull();
    const code = authenticator.generate(secret);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, null)).not.toBeNull();
  });
});
