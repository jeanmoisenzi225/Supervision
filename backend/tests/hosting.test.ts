import { describe, expect, it } from "vitest";
import { buildApps } from "../src/config/apps";
import { buildHostingCosts, renderLines } from "../src/modules/hosting/hosting.service";
import { computeUsd, postgresUsd } from "../src/modules/hosting/prices";
import type { PostgresSummary, ServiceSummary } from "../src/modules/actions/render";

const svc = (name: string, type: string, plan: string | null, extra: Partial<ServiceSummary> = {}): ServiceSummary => ({ id: `srv-${name}`, name, url: null, type, plan, suspended: false, diskGB: null, ...extra });
const db = (name: string, plan: string, diskSizeGB: number, extra: Partial<PostgresSummary> = {}): PostgresSummary => ({
  id: `dpg-${name}`, name, databaseName: null, plan, status: "available", suspended: false, diskSizeGB, expiresAt: null, dashboardUrl: null, ...extra,
});

describe("tarifs Render", () => {
  it("lit les offres sous leur nom actuel et leur ancien nom", () => {
    expect(computeUsd("web_service", "0.5c-512mb")).toBe(7);
    expect(computeUsd("web_service", "starter")).toBe(7);
    expect(computeUsd("web_service", "pro-plus")).toBe(175);
    expect(computeUsd("web_service", "free")).toBe(0);
    expect(computeUsd("static_site", null)).toBe(0);
    expect(computeUsd("web_service", "offre-inconnue")).toBeNull();
    expect(postgresUsd("0.1c-256mb")).toBe(6);
    expect(postgresUsd("basic_256mb")).toBe(6);
    expect(postgresUsd("basic-256mb")).toBe(6);
    expect(postgresUsd("free")).toBe(0);
  });
});

describe("coûts par appli", () => {
  // Inventaire constaté sur Render le 2026-11-12.
  const services = [
    svc("procedia-backend", "web_service", "0.5c-512mb"),
    svc("procedia-frontend", "static_site", null),
    svc("procedia-recette", "static_site", null),
    svc("garage-backend", "web_service", "0.5c-512mb"),
    svc("garage-frontend", "static_site", null),
    svc("Agent-brvm", "web_service", "starter", { suspended: true, diskGB: 1 }),
    svc("supervision", "web_service", "starter"),
    svc("supervision-staging", "web_service", "free"),
  ];
  const dbs = [db("procedia-db", "0.1c-256mb", 5), db("garage-db", "0.1c-256mb", 1), db("supervision-db", "basic_256mb", 15), db("supervision-staging-db", "free", 1)];
  const costs = { byWorkspace: [{ workspace: "Procedia", usd: 12.5 }, { workspace: "MGA", usd: 3.25 }, { workspace: "Autre espace", usd: 1 }] };
  const bill = buildHostingCosts(buildApps(() => ""), services, dbs, costs);
  const app = (key: string) => bill.apps.find((a) => a.key === key)!;

  it("estime Procedia : API Starter + base payante + stockage (1,5 $)", () => {
    expect(app("procedia").render.usd).toBe(7 + 6 + 1.5);
    expect(app("procedia").render.lines.map((l) => l.name)).toContain("Stockage de procedia-db");
  });
  it("rattache les dépenses Claude par espace de travail, le reste reste non rattaché", () => {
    expect(app("procedia").claude.usd).toBe(12.5);
    expect(app("mga").claude.usd).toBe(3.25);
    expect(app("other").claude.workspaces).toEqual([{ workspace: "Autre espace", usd: 1 }]);
    expect(bill.totals.claudeUsd).toBe(12.5 + 3.25 + 1);
    expect(app("procedia").totalUsd).toBe(7 + 6 + 1.5 + 12.5);
  });
  it("ne facture pas l'instance d'un service suspendu mais garde son disque", () => {
    const yiri = app("yiri");
    expect(yiri.render.lines.find((l) => l.name === "Agent-brvm")!.usd).toBe(0);
    expect(yiri.render.usd).toBe(0.25);
  });
  it("compte NJMDev (la Supervision et ses bases) à part et additionne tout", () => {
    expect(app("njmdev").render.lines.map((l) => l.name)).toEqual(["supervision", "supervision-staging", "supervision-db", "Stockage de supervision-db", "supervision-staging-db"]);
    expect(app("njmdev").render.usd).toBe(7 + 6 + 4.5);
    expect(bill.totals.renderUsd).toBe(14.5 + (7 + 6 + 0.3) + 0.25 + (7 + 6 + 4.5));
    expect(bill.totals.unknown).toBe(0);
    // Tout est rattaché : pas de ligne « non rattaché » côté Render.
    expect(bill.apps.find((a) => a.key === "other")!.render.lines).toEqual([]);
  });
  it("rattache à « non rattaché » un service qu'aucune appli ne revendique", () => {
    const b = buildHostingCosts(buildApps(() => ""), [svc("inconnu", "web_service", "starter")], [], { byWorkspace: [] });
    expect(b.apps.find((a) => a.key === "other")!.render.usd).toBe(7);
  });
  it("signale une offre inconnue sans l'inventer", () => {
    const lines = renderLines([svc("x", "web_service", "2c-99g")], []);
    expect(lines[0].usd).toBeNull();
    expect(buildHostingCosts([{ key: "a", name: "A", renderMatch: { names: [/^x$/], hosts: [] }, claudeWorkspaces: [] }], [svc("x", "web_service", "2c-99g")], [], { byWorkspace: [] }).totals.unknown).toBe(1);
  });
});

describe("dépenses Claude cumulées par appli", () => {
  it("additionne les espaces de travail d'une même appli et isole le reste", async () => {
    const { claudeByApp } = await import("../src/modules/hosting/hosting.service");
    const apps = buildApps(() => "");
    const r = claudeByApp(apps, [{ workspace: "Procedia", usd: 8.5 }, { workspace: "Espace par défaut", usd: 74.95 }, { workspace: "Autre", usd: 1 }]);
    // Sans réglage : « Procedia » est reconnu par son nom, l'espace par défaut reste non rattaché.
    expect(r.map((x) => [x.key, x.usd])).toEqual([["procedia", 8.5], ["other", 75.95]]);
    process.env.PROCEDIA_CLAUDE_WORKSPACE = "Procedia,Espace par défaut";
    const apps2 = buildApps((n) => process.env[n] ?? "");
    const r2 = claudeByApp(apps2, [{ workspace: "Procedia", usd: 8.5 }, { workspace: "Espace par défaut", usd: 74.95 }, { workspace: "Autre", usd: 1 }]);
    expect(r2.find((x) => x.key === "procedia")).toMatchObject({ usd: 83.45, workspaces: [{ workspace: "Procedia", usd: 8.5 }, { workspace: "Espace par défaut", usd: 74.95 }] });
    expect(r2.find((x) => x.key === "other")?.usd).toBe(1);
    delete process.env.PROCEDIA_CLAUDE_WORKSPACE;
  });
});
