import { describe, expect, it } from "vitest";
import { jobRunSchema, jobState } from "../src/modules/jobs/jobs.service";

const created = new Date("2026-10-01T00:00:00Z");
const job = (lastRunAt: string | null, lastStatus: string | null = "ok") => ({
  cron: "0 20 * * *",
  graceMinutes: 15,
  lastRunAt: lastRunAt ? new Date(lastRunAt) : null,
  lastStatus,
  createdAt: created,
});

describe("état d'une tâche planifiée", () => {
  it("à l'heure quand l'échéance a été honorée", () => {
    expect(jobState(job("2026-11-01T20:00:04Z"), new Date("2026-11-01T21:00:00Z")).state).toBe("ok");
  });
  it("pas encore en retard pendant la marge", () => {
    expect(jobState(job("2026-10-31T20:00:04Z"), new Date("2026-11-01T20:10:00Z")).state).toBe("ok");
  });
  it("en retard après la marge sans exécution", () => {
    const s = jobState(job("2026-10-31T20:00:04Z"), new Date("2026-11-01T20:16:00Z"));
    expect(s.state).toBe("late");
    expect(s.expectedAt).toEqual(new Date("2026-11-01T20:00:00Z"));
  });
  it("en échec si la dernière exécution a échoué", () => {
    expect(jobState(job("2026-11-01T20:00:04Z", "error"), new Date("2026-11-01T21:00:00Z")).state).toBe("failed");
  });
  it("jamais en retard pour une échéance antérieure à sa déclaration", () => {
    const fresh = { ...job(null, null), createdAt: new Date("2026-11-01T20:30:00Z") };
    expect(jobState(fresh, new Date("2026-11-01T21:00:00Z")).state).toBe("waiting");
  });
});

describe("exécution envoyée par une appli", () => {
  it("refuse une expression cron invalide", () => {
    expect(() => jobRunSchema.parse({ key: "rappels", label: "Rappels", cron: "0 25 * * *", status: "ok" })).toThrow();
    expect(jobRunSchema.parse({ key: "rappels-veille", label: "Rappels", cron: "0 20 * * *", status: "ok" }).graceMinutes).toBe(15);
  });
});
