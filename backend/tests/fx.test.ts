import { afterEach, describe, expect, it, vi } from "vitest";
import { XOF_PER_EUR, clearFxCache, isAbsurdRate, parseEcbXml, parseFrankfurter, usdRate } from "../src/modules/billing/fx";

afterEach(() => {
  vi.restoreAllMocks();
  clearFxCache();
});

describe("taux de change automatiques", () => {
  it("lit la réponse de Frankfurter et le fichier XML de la BCE", () => {
    expect(parseFrankfurter({ amount: 1, base: "USD", date: "2026-11-11", rates: { EUR: 0.89871 } })).toEqual({ eurPerUsd: 0.89871, date: "2026-11-11" });
    expect(() => parseFrankfurter({ rates: {} })).toThrow();
    const xml = "<Cube><Cube time='2026-11-11'><Cube currency='USD' rate='1.1127'/><Cube currency='JPY' rate='177.18'/></Cube></Cube>";
    const e = parseEcbXml(xml);
    expect(e.date).toBe("2026-11-11");
    expect(e.eurPerUsd).toBeCloseTo(0.89871, 4);
  });

  it("déduit le franc CFA de l'euro par la parité fixe, et ne convertit pas le dollar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ date: "2026-11-11", rates: { EUR: 0.9 } }), { status: 200 })));
    const eur = await usdRate("EUR");
    expect(eur).toMatchObject({ rate: 0.9, date: "2026-11-11" });
    const xof = await usdRate("XOF");
    expect(xof.rate).toBeCloseTo(0.9 * XOF_PER_EUR, 3);
    expect((await usdRate("USD")).rate).toBe(1);
    vi.unstubAllGlobals();
  });

  it("prend le fichier de la BCE en secours quand Frankfurter ne répond pas", async () => {
    const xml = "<Cube><Cube time='2026-11-11'><Cube currency='USD' rate='1.25'/></Cube></Cube>";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("frankfurter") ? new Response("", { status: 503 }) : new Response(xml, { status: 200 }))));
    const eur = await usdRate("EUR");
    expect(eur.rate).toBe(0.8);
    expect(eur.source).toBe("BCE");
    vi.unstubAllGlobals();
  });

  it("repère un taux saisi dans la mauvaise unité (655,957 au lieu de 0,9 euro)", () => {
    expect(isAbsurdRate(655.957, 0.9)).toBe(true);
    expect(isAbsurdRate(0.92, 0.9)).toBe(false);
    expect(isAbsurdRate(590, 590.3)).toBe(false);
    expect(isAbsurdRate(0.9, 590)).toBe(true);
  });
});
