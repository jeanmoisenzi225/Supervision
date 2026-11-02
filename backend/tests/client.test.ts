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

describe("tâche planifiée surveillée (module Node)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("signale une exécution réussie avec son résumé, et rend le résultat", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 202 }));
    const s = createSupervision({ url: "https://sup.test", token: "t", echo: false });
    const run = s.job("rappels-veille", { label: "Rappels de la veille", cron: "0 20 * * *" }, async () => 3);
    expect(await run()).toBe(3);
    await new Promise((r) => setTimeout(r, 0));
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sup.test/api/ingest/jobs");
    expect(JSON.parse(String(init.body))).toMatchObject({ key: "rappels-veille", status: "ok", message: "3 élément(s) traité(s)", cron: "0 20 * * *" });
  });

  it("signale l'échec et laisse passer l'erreur", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 202 }));
    const s = createSupervision({ url: "https://sup.test", token: "t", echo: false });
    const run = s.job("purge", { label: "Purge", cron: "30 3 * * *" }, async () => {
      throw new Error("base injoignable");
    });
    await expect(run()).rejects.toThrow("base injoignable");
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(String((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body))).toMatchObject({ status: "error", message: "Error: base injoignable" });
  });
});

describe("protocole d'administration signé", async () => {
  const sup = await import("../src/utils/adminSignature");
  const cli = await import("../../clients/node/supervision");
  const key = sup.deriveAdminKey("jeton-envoi");
  const body = JSON.stringify({ params: { email: "a@b.ci" }, by: "admin@x" });

  it("même clé dérivée et même signature côté supervision et côté appli", () => {
    expect(cli.deriveAdminKey("jeton-envoi")).toBe(key);
    const ts = 1_800_000_000_000;
    const sig = sup.signAdminRequest(key, ts, "POST", "/actions/deconnecter", body);
    expect(cli.verifyAdminRequest(key, { timestamp: String(ts), signature: sig }, "post", "/actions/deconnecter", body, ts + 1000)).toBe(true);
  });

  it("refuse corps modifié, autre action, vieille signature ou clé absente", () => {
    const ts = 1_800_000_000_000;
    const sig = sup.signAdminRequest(key, ts, "POST", "/actions/deconnecter", body);
    expect(cli.verifyAdminRequest(key, { timestamp: String(ts), signature: sig }, "POST", "/actions/deconnecter", body.replace("a@b", "z@b"), ts)).toBe(false);
    expect(cli.verifyAdminRequest(key, { timestamp: String(ts), signature: sig }, "POST", "/actions/desactiver", body, ts)).toBe(false);
    expect(cli.verifyAdminRequest(key, { timestamp: String(ts), signature: sig }, "POST", "/actions/deconnecter", body, ts + 6 * 60_000)).toBe(false);
    expect(cli.verifyAdminRequest("", { timestamp: String(ts), signature: sig }, "POST", "/actions/deconnecter", body, ts)).toBe(false);
  });

  it("le routeur refuse un appel non signé et accepte un appel signé", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    const app = express();
    app.use(express.json());
    app.use(
      "/api/supervision",
      cli.supervisionAdminRouter(express.Router, {
        ingestToken: "jeton-envoi",
        actions: [{ id: "echo", label: "Écho", run: async (p) => ({ message: `bonjour ${String(p.nom)}` }) }],
      })
    );
    expect((await request(app).get("/api/supervision/actions")).status).toBe(401);
    const payload = JSON.stringify({ params: { nom: "Jean" }, by: "admin" });
    const ts = Date.now();
    const res = await request(app)
      .post("/api/supervision/actions/echo")
      .set("content-type", "application/json")
      .set("x-supervision-timestamp", String(ts))
      .set("x-supervision-signature", sup.signAdminRequest(key, ts, "POST", "/actions/echo", payload))
      .send(payload);
    expect(res.body).toMatchObject({ ok: true, message: "bonjour Jean" });
  });
});
