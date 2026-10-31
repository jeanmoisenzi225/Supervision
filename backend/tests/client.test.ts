import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupervision, sourceFromMessage } from "../../clients/node/supervision";

describe("module d'envoi Node", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tire la source du préfixe [module]", () => {
    expect(sourceFromMessage("[news] échec du créneau")).toBe("news");
    expect(sourceFromMessage("API démarrée")).toBeUndefined();
  });

  it("ne fait rien sans adresse ni jeton", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const s = createSupervision({ url: "", token: "", echo: false });
    s.info("rien");
    await s.flush();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("envoie par lots, avec la source tirée du message recopié", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 202 }));
    const s = createSupervision({ url: "https://sup.test/", token: "t", source: "backend", echo: false });
    s.info("premier", { a: 1 });
    s.warn("second");
    await s.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sup.test/api/ingest/logs");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
    const body = JSON.parse(String(init.body));
    expect(body.entries.map((e: { level: string; message: string }) => `${e.level}:${e.message}`)).toEqual(["info:premier", "warn:second"]);
  });

  it("garde les journaux si la supervision est injoignable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("réseau")).mockResolvedValue(new Response("{}", { status: 202 }));
    const s = createSupervision({ url: "https://sup.test", token: "t", echo: false });
    s.info("à garder");
    await s.flush();
    await s.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((fetchSpy.mock.calls[1] as [string, RequestInit])[1].body)).entries[0].message).toBe("à garder");
  });
});
