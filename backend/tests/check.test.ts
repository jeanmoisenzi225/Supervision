import { describe, expect, it } from "vitest";
import type { CheckTarget } from "../src/config/apps";
import { interpretResponse, nextTransition, runCheck } from "../src/modules/monitor/check";
import { computeStatus } from "../src/modules/monitor/monitor.routes";

const health: CheckTarget = { id: "api", label: "API", url: "https://x/health", expect: "health", timeoutMs: 50 };

describe("interpretResponse", () => {
  it("accepte un 2xx avec status ok", () => {
    expect(interpretResponse(health, 200, '{"status":"ok"}')).toBeNull();
  });
  it("refuse un état signalé en erreur", () => {
    expect(interpretResponse(health, 200, '{"status":"degraded"}')).toMatch(/degraded/);
  });
  it("refuse un code HTTP hors 2xx", () => {
    expect(interpretResponse({ ...health, expect: "2xx" }, 503, "")).toBe("Réponse HTTP 503");
  });
  it("accepte un 2xx non JSON", () => {
    expect(interpretResponse(health, 200, "<html>")).toBeNull();
  });
});

describe("runCheck", () => {
  it("signale un délai dépassé", async () => {
    const slow = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as unknown as typeof fetch;
    const outcome = await runCheck(health, slow);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toMatch(/Pas de réponse/);
  });
  it("mesure une réponse correcte", async () => {
    const ok = (async () => new Response('{"status":"ok"}', { status: 200 })) as unknown as typeof fetch;
    const outcome = await runCheck(health, ok);
    expect(outcome).toMatchObject({ ok: true, statusCode: 200, error: null });
  });
});

describe("nextTransition", () => {
  it("n'ouvre l'alerte qu'au seuil, une seule fois", () => {
    expect(nextTransition(0, false, 2)).toEqual({ failures: 1, transition: "none" });
    expect(nextTransition(1, false, 2)).toEqual({ failures: 2, transition: "open" });
    expect(nextTransition(2, false, 2)).toEqual({ failures: 3, transition: "none" });
  });
  it("referme après une panne, pas après un raté isolé", () => {
    expect(nextTransition(3, true, 2).transition).toBe("resolve");
    expect(nextTransition(1, true, 2).transition).toBe("none");
  });
  it("referme une alerte restée ouverte au premier passage après démarrage", () => {
    expect(nextTransition(undefined, true, 2).transition).toBe("resolve");
  });
});

describe("computeStatus", () => {
  it("distingue les états", () => {
    expect(computeStatus([])).toBe("not_deployed");
    expect(computeStatus([null])).toBe("unknown");
    expect(computeStatus([{ ok: true }, { ok: true }])).toBe("ok");
    // Le statut dépend uniquement des contrôles encore déclarés dans le catalogue.\n    expect(computeStatus([{ ok: true }, { ok: true }])).toBe("ok");\n    expect(computeStatus([{ ok: true }, { ok: false }])).toBe("degraded");
    expect(computeStatus([{ ok: false }, { ok: false }])).toBe("down");
  });
});
