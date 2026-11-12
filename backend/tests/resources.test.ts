import { describe, expect, it } from "vitest";
import { matchPostgres, type PostgresSummary } from "../src/modules/actions/render";
import { detectKnownIncident } from "../src/modules/logs/ingest";
import { daysUntil, last, percent, sumSeries, toBytes } from "../src/modules/resources/units";
import { buildApps } from "../src/config/apps";

describe("unités et calculs", () => {
  it("convertit selon l'unité annoncée par Render", () => {
    expect(toBytes(512, "MB")).toBe(512 * 1024 ** 2);
    expect(toBytes(1, "GB")).toBe(1024 ** 3);
    expect(toBytes(1234, "bytes")).toBe(1234);
    expect(toBytes(1234, "")).toBe(1234);
  });
  it("additionne des séries point à point et calcule une part", () => {
    expect(sumSeries([[[1, 2], [2, 3]], [[1, 5]]])).toEqual([[1, 7], [2, 3]]);
    expect(last([[1, 2], [2, 9]])).toBe(9);
    expect(last([])).toBeNull();
    expect(percent(430, 512)).toBe(84);
    expect(percent(null, 512)).toBeNull();
    expect(percent(10, 0)).toBeNull();
  });
  it("compte les jours avant expiration", () => {
    const now = Date.parse("2026-11-01T00:00:00Z");
    expect(daysUntil("2026-11-08T12:00:00Z", now)).toBe(7);
    expect(daysUntil("2026-10-30T00:00:00Z", now)).toBe(-2);
    expect(daysUntil(null, now)).toBeNull();
  });
});

describe("bases de données de chaque appli", () => {
  const pg = (name: string): PostgresSummary => ({ id: name, name, plan: "", status: "", suspended: false, diskSizeGB: 1, expiresAt: null, dashboardUrl: null });
  const list = [pg("garage-db"), pg("procedia-db"), pg("supervision-db")];
  const names = (key: string) => buildApps(() => "").find((a) => a.key === key)!.renderMatch.names;
  it("rattache chaque base à son appli, jamais celle de la supervision", () => {
    expect(matchPostgres(names("mga"), list).map((p) => p.name)).toEqual(["garage-db"]);
    expect(matchPostgres(names("procedia"), list).map((p) => p.name)).toEqual(["procedia-db"]);
    for (const k of ["mga", "procedia", "yiri", "site-autonova", "my-family"]) expect(matchPostgres(names(k), list).map((p) => p.name)).not.toContain("supervision-db");
  });
});

describe("incidents connus dans les journaux", () => {
  it("reconnaît le crédit Claude épuisé, tel que l'API le renvoie", () => {
    const msg = `[ia] Requête Claude refusée : 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}`;
    expect(detectKnownIncident(msg)?.key).toBe("claude-credit");
  });
  it("reconnaît une clé refusée (Procedia, Yiri)", () => {
    expect(detectKnownIncident("[http] POST /api/ai/analyse : 502 La clé d'API Claude est refusée par Anthropic : vérifiez…")?.key).toBe("claude-key");
    expect(detectKnownIncident('401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}')?.key).toBe("claude-key");
  });
  it("ignore les journaux ordinaires", () => {
    expect(detectKnownIncident("[news] planificateur démarré")).toBeNull();
    expect(detectKnownIncident("Paiement 1234 refusé par Wave")).toBeNull();
  });
});

describe("repli quand Render limite les mesures (offre Hobby)", async () => {
  const { parseSizes } = await import("../src/modules/actions/render");
  const { readableMetricError, bucketLatency } = await import("../src/modules/resources/resources.service");

  it("lit la taille de la base et classe ses tables", () => {
    const s = parseSizes(
      [
        { Database: "postgres", Bytes: 8_000_000 },
        { Database: "garage_app", Bytes: 52_000_000 },
        { Database: "garage_app", Schema: "public", Table: "Invoice", Bytes: 9_000_000 },
        { Database: "garage_app", Schema: "public", Table: "Vehicle", Bytes: 21_000_000 },
        { Database: "garage_app", Schema: "public", Table: "Vehicle", Index: "Vehicle_pkey", Bytes: 500_000 },
      ],
      "garage_app"
    );
    expect(s.databaseBytes).toBe(52_000_000);
    expect(s.tables).toEqual([
      { name: "Vehicle", bytes: 21_000_000 },
      { name: "Invoice", bytes: 9_000_000 },
    ]);
  });

  it("additionne les tables quand Render ne donne pas la taille de la base entière", () => {
    const s = parseSizes(
      [
        { Database: "procedia", Schema: "public", Table: "SourceDocument", Index: "", Bytes: 1_000_000_000 },
        { Database: "procedia", Schema: "public", Table: "SourceDocument", Index: "SourceDocument_pkey", Bytes: 16_384 },
        { Database: "procedia", Schema: "public", Table: "Node", Index: "", Bytes: 4_000_000 },
      ],
      "procedia"
    );
    expect(s.databaseBytes).toBe(1_004_000_000);
    expect(s.tables[0]).toEqual({ name: "SourceDocument", bytes: 1_000_000_000 });
  });

  it("rend lisible la limite de demandes de Render", () => {
    expect(readableMetricError("mémoire", 'Render a répondu 429 : {"message": "rate limit exceeded"}')).toBe(
      "mémoire (Render limite le nombre de demandes : réessayer dans une minute)"
    );
  });

  it("rend lisible le refus lié à l'offre Render", () => {
    expect(readableMetricError("temps de réponse", 'Render a répondu 400 : {"message":"query is not allowed for plan: Hobby"}')).toBe(
      "temps de réponse (réservé aux offres Render supérieures à Hobby)"
    );
    expect(readableMetricError("disque", "Render a répondu 500 : boom")).toBe("disque : Render a répondu 500 : boom");
  });

  it("moyenne le temps de réponse des vérifications réussies par intervalle", () => {
    const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 10, min));
    expect(
      bucketLatency(
        [
          { at: at(0), latencyMs: 100, ok: true },
          { at: at(5), latencyMs: 300, ok: true },
          { at: at(7), latencyMs: 9000, ok: false },
          { at: at(12), latencyMs: 50, ok: true },
        ],
        600
      )
    ).toEqual([
      [Date.UTC(2026, 10, 1, 10, 0), 200],
      [Date.UTC(2026, 10, 1, 10, 10), 50],
    ]);
  });
});
