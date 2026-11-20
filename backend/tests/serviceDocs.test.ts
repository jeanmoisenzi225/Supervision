import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { buildServiceDocs, formatAmount, frDate } from "../src/modules/billing/service-docs.content";

describe("contenu des documents de prestation", () => {
  it("formate montants et dates sans rien inventer", () => {
    expect(formatAmount(1000, "EUR")).toBe("1 000,00 €");
    expect(formatAmount(250000, "XOF")).toBe("250 000 FCFA");
    expect(formatAmount(null, "EUR")).toContain("⟦montant à compléter⟧");
    expect(frDate("2026-11-01")).toBe("1er novembre 2026");
  });
  it("ne parle jamais de facture fiscale, de TVA chiffrée ni d'identifiant inventé", () => {
    const d: any = { appName: "", description: "", features: [], technologies: "", workNature: "", period: "", deliveryState: "", location: "", amount: null, currency: "EUR", paymentTerms: "", paymentDue: "", paymentCoordinates: "", clientLegalForm: "", clientRepresentative: "", clientRole: "", place: "", reference: "", emissionDate: null, provider: { name: "", address: "", email: "", phone: "", brand: "NJMDev" }, client: { name: "", address: "", rccm: "", ncc: "", email: "", phone: "" } };
    const s = buildServiceDocs(d, "2026-11-20");
    const all = JSON.stringify(s);
    expect(all).toContain("n’est pas une facture fiscale");
    expect(all).toContain("⟦RCCM, à fournir par le client⟧");
    expect(all).not.toMatch(/SIRET|SIREN|TVA \d|FR\d{11}/);
    expect(JSON.stringify(s.convention)).toContain("sans rétroactivité");
  });
});

// Nécessite une vraie base : TEST_DATABASE_URL=postgresql://... npx vitest run tests/serviceDocs.test.ts
describe.skipIf(!process.env.TEST_DATABASE_URL)("API dossiers de prestation", () => {
  let app: ReturnType<typeof import("../src/app").createApp>;
  let prisma: typeof import("../src/db/prisma").prisma;
  let auth: { Authorization: string };
  let clientId = "";
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ prisma } = await import("../src/db/prisma"));
    const { signToken } = await import("../src/middleware/auth");
    app = (await import("../src/app")).createApp();
    auth = { Authorization: `Bearer ${signToken({ sub: "t", email: "t@example.test" })}` };
    await prisma.billingServiceDoc.deleteMany();
    clientId = (await prisma.billingClient.create({ data: { name: "Client test" } })).id;
  });
  afterAll(async () => { await prisma.billingServiceDoc.deleteMany(); await prisma.billingClient.delete({ where: { id: clientId } }); await prisma.$disconnect(); });
  it("crée un dossier puis télécharge les deux documents en PDF et en Word", async () => {
    const created = await request(app).post("/api/billing/service-docs").set(auth).send({ clientId, appName: "App test", amount: 1500, currency: "EUR", features: ["A", "B"] });
    expect(created.status).toBe(201);
    const id = created.body.id;
    for (const kind of ["demande", "convention"]) {
      const pdf = await request(app).get(`/api/billing/service-docs/${id}/${kind}.pdf`).set(auth).buffer().parse((r, cb) => { const c: Buffer[] = []; r.on("data", (x) => c.push(x)); r.on("end", () => cb(null, Buffer.concat(c))); });
      expect(pdf.status).toBe(200);
      expect(pdf.headers["content-disposition"]).toContain(kind === "demande" ? "demande_reglement.pdf" : "convention_prestation.pdf");
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      const docx = await request(app).get(`/api/billing/service-docs/${id}/${kind}.docx`).set(auth).buffer().parse((r, cb) => { const c: Buffer[] = []; r.on("data", (x) => c.push(x)); r.on("end", () => cb(null, Buffer.concat(c))); });
      expect(docx.status).toBe(200);
      expect((docx.body as Buffer).subarray(0, 2).toString()).toBe("PK");
    }
  });
  it("exige l'authentification et refuse un client inconnu", async () => {
    expect((await request(app).get("/api/billing/service-docs")).status).toBe(401);
    expect((await request(app).post("/api/billing/service-docs").set(auth).send({ clientId: "nope", appName: "x" })).status).toBe(400);
  });
});
