import { describe, expect, it } from "vitest";
import { logsStatus } from "../src/modules/monitor/diagnostic";

describe("état du lien des journaux", () => {
  const now = new Date("2026-11-16T14:00:00Z");
  it("récent : tout va bien", () => {
    expect(logsStatus(new Date("2026-11-16T09:00:00Z"), now).status).toBe("ok");
  });
  it("silence de plus d'un jour : simple information (l'appli n'écrit un journal que lors d'un événement)", () => {
    const r = logsStatus(new Date("2026-11-13T23:50:00Z"), now);
    expect(r.status).toBe("info");
    expect(r.detail).toMatch(/silence est normal/);
  });
  it("aucun journal reçu : avertissement avec la marche à suivre", () => {
    const r = logsStatus(null, now);
    expect(r.status).toBe("warn");
    expect(r.detail).toMatch(/SUPERVISION_INGEST_TOKEN/);
  });
});
