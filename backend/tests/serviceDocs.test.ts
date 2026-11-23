import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { clientLogoFor, pngSize } from "../src/modules/billing/client-logos";
import { renderServiceDocDocx } from "../src/modules/billing/service-docs.docx";
import { renderServiceDocPdf } from "../src/modules/billing/service-docs.pdf";
import { amountInWords, buildServiceDocs, formatAmount, frDate, missingForDoc, numberToFrench, type ServiceDocData } from "../src/modules/billing/service-docs.content";

const base = (over: Partial<ServiceDocData> = {}): ServiceDocData => ({
  appName: "App", description: "", features: [], technologies: "", workNature: "", period: "", deliveryState: "", location: "", amount: 1500, currency: "EUR",
  paymentTerms: "", paymentDue: "", paymentCoordinates: "", clientLegalForm: "", clientRepresentative: "", clientRole: "", place: "", reference: "", emissionDate: "2026-11-21", lines: [],
  terms: { law: "française", jurisdiction: "tribunaux d'Abidjan" },
  provider: { name: "Nom Test", address: "1 rue X, Lyon", email: "", phone: "", brand: "NJMDev" },
  client: { name: "Client SARL", address: "", rccm: "", ncc: "", email: "", phone: "" }, ...over,
});
const text = (s: unknown) => JSON.stringify(s);

describe("montants et dates", () => {
  it("formate", () => {
    expect(formatAmount(1000, "EUR")).toBe("1 000,00 €");
    expect(formatAmount(250000, "XOF")).toBe("250 000 FCFA");
    expect(frDate("2026-11-01")).toBe("1er novembre 2026");
  });
  it("écrit les montants en lettres", () => {
    expect(numberToFrench(80)).toBe("quatre-vingts");
    expect(numberToFrench(81)).toBe("quatre-vingt-un");
    expect(numberToFrench(71)).toBe("soixante et onze");
    expect(numberToFrench(200)).toBe("deux cents");
    expect(numberToFrench(280000)).toBe("deux cent quatre-vingt mille");
    expect(amountInWords(1500, "EUR")).toBe("mille cinq cents euros");
    expect(amountInWords(25.9, "EUR")).toBe("vingt-cinq euros et quatre-vingt-dix centimes");
    expect(amountInWords(250000, "XOF")).toBe("deux cent cinquante mille francs CFA");
    expect(amountInWords(1, "EUR")).toBe("un euro");
    expect(amountInWords(2000000, "XOF")).toBe("deux millions francs CFA");
  });
});

describe("documents finaux", () => {
  it("aucune zone à compléter, même quand presque rien n'est renseigné", () => {
    const s = buildServiceDocs(base());
    expect(text(s)).not.toContain("⟦");
    expect(text(s)).not.toContain("à compléter");
    expect(text(s)).not.toContain("à faire valider");
    expect(text(s)).not.toContain("Validation");
  });
  it("les informations absentes disparaissent (RCCM, NCC, forme juridique, paiement, lieu)", () => {
    const s = buildServiceDocs(base());
    const all = text(s);
    expect(all).not.toContain("RCCM");
    expect(all).not.toContain("NCC");
    expect(all).not.toContain("Mode de paiement");
    expect(all).toContain("Fait le 21 novembre 2026");
  });
  it("les informations renseignées apparaissent", () => {
    const s = buildServiceDocs(base({ client: { name: "Client SARL", address: "Abidjan", rccm: "CI-ABJ-1", ncc: "123", email: "", phone: "" }, paymentTerms: "virement", place: "Lyon", reference: "DR-001" }));
    const all = text(s);
    expect(all).toContain("RCCM : CI-ABJ-1");
    expect(all).toContain("Mode de paiement");
    expect(all).toContain("Fait à Lyon, le 21 novembre 2026");
    expect(text(s.convention.blocks)).toContain("CV-001");
  });
  it("ne parle pas de facture fiscale à tort, ni de TVA chiffrée, ni d'identifiant inventé", () => {
    const all = text(buildServiceDocs(base()));
    expect(all).toContain("n’est pas une facture fiscale");
    expect(all).not.toMatch(/SIRET|SIREN|FR\d{11}/);
  });
  it("la convention montre le montant en lettres et la licence par défaut", () => {
    const c = text(buildServiceDocs(base()).convention.blocks);
    expect(c).toContain("mille cinq cents euros");
    expect(c).toContain("Licence d’exploitation");
    expect(c).not.toContain("Cession de droits.");
    expect(c).toContain("droit français");
    expect(c).toContain("tribunaux d'Abidjan");
  });
  it("la cession n'apparaît que si elle est choisie, avec sa rémunération", () => {
    const c = text(buildServiceDocs(base({ terms: { law: "ivoirienne", jurisdiction: "Abidjan", rights: "cession", cessionFee: "500 €", exclusivity: "exclusive" } })).convention.blocks);
    expect(c).toContain("Cession de droits.");
    expect(c).toContain("fixée à 500 €");
    expect(c).toContain("droit ivoirien");
    expect(c).not.toContain("Licence d’exploitation.");
  });
  it("la clause de pénalités n'existe que si un taux est donné", () => {
    expect(text(buildServiceDocs(base()).convention.blocks)).not.toContain("pénalités");
    expect(text(buildServiceDocs(base({ terms: { law: "française", jurisdiction: "x", penaltyRate: "3 % par mois" } })).convention.blocks)).toContain("pénalités de 3 % par mois");
  });
});

describe("informations indispensables", () => {
  it("bloque si identité, montant, loi ou juridiction manquent", () => {
    expect(missingForDoc(base({ provider: { name: "", address: "", email: "", phone: "", brand: "NJMDev" } }), "demande").join()).toContain("nom");
    expect(missingForDoc(base({ amount: null }), "demande").join()).toContain("montant");
    expect(missingForDoc(base({ terms: {} }), "convention").join()).toContain("loi applicable");
    expect(missingForDoc(base({ terms: { law: "française", jurisdiction: "x", rights: "cession" } }), "convention").join()).toContain("cession");
    expect(missingForDoc(base(), "convention")).toEqual([]);
  });
});

describe("détail des composants", () => {
  const lines = [{ description: "App — hébergement : service api", quantity: 1, unitPrice: 7 }, { description: "App — base de données", quantity: 2, unitPrice: 10 }];
  it("affiche les lignes et signale un écart avec le montant convenu", () => {
    const all = text(buildServiceDocs(base({ amount: 30, lines })));
    expect(all).toContain("service api");
    expect(all).toContain("(× 2)");
    expect(all).toContain("27,00 €");
    expect(all).toContain("diffère du total");
  });
  it("regroupe l'hébergement en une seule ligne avec son total et le détail des postes dans la ligne", () => {
    const hosting = [
      { description: "Procedia — hébergement : service procedia-backend (offre 0.5c-512mb)", quantity: 1, unitPrice: 6.37 },
      { description: "Procedia — hébergement : base de données procedia-db (offre 0.1c-256mb)", quantity: 1, unitPrice: 5.46 },
      { description: "Procedia — hébergement : Stockage de procedia-db (5 Go)", quantity: 1, unitPrice: 1.36 },
      { description: "Procedia — Intelligence artificielle : « Procedia », dépenses du mois en cours", quantity: 1, unitPrice: 84.26 },
      { description: "Support", quantity: 1, unitPrice: 10 },
    ];
    const rows = (buildServiceDocs(base({ amount: null, lines: hosting })).demande.blocks.find((b) => b.t === "amount") as { rows: { label: string; value: string; details?: [string, string][] }[]; total: string }).rows;
    expect(rows).toHaveLength(3); // Hébergement, Intelligence artificielle, Support
    expect(rows[0]).toMatchObject({ label: "Hébergement Procedia", value: "13,19 €" });
    expect(rows[0].details).toEqual([["service procedia-backend (offre 0.5c-512mb)", "6,37 €"], ["base de données procedia-db (offre 0.1c-256mb)", "5,46 €"], ["Stockage de procedia-db (5 Go)", "1,36 €"]]);
    expect(rows[1].details).toBeUndefined();
    expect(rows[2].label).toBe("Support");
    // la source explicite prime sur l'intitulé
    const bySource = (buildServiceDocs(base({ amount: null, lines: [{ description: "Poste A", quantity: 1, unitPrice: 2, source: "hosting" }, { description: "Poste B", quantity: 1, unitPrice: 3, source: "hosting" }] })).demande.blocks.find((b) => b.t === "amount") as { rows: { label: string; value: string }[] }).rows;
    expect(bySource).toHaveLength(1);
    expect(bySource[0]).toMatchObject({ label: "Hébergement App", value: "5,00 €" });
    // la convention reprend le détail dans une seule entrée d'hébergement
    expect(text(buildServiceDocs(base({ amount: null, lines: hosting })).convention.blocks)).toContain("Hébergement Procedia : 13,19 €, dont service procedia-backend (offre 0.5c-512mb) 6,37 €");
  });
  it("regroupe aussi des intitulés réécrits à la main, sans origine enregistrée", () => {
    const renamed = [
      { description: "Serveur de l'application (fonctionnement et traitements)", quantity: 1, unitPrice: 6.37 },
      { description: "Base de données (conservation des procédures et des données)", quantity: 1, unitPrice: 5.46 },
      { description: "Espace de stockage de la base de données (5 Go)", quantity: 1, unitPrice: 1.36 },
      { description: "Analyse automatique des procédures par intelligence artificielle (consommation de novembre)", quantity: 1, unitPrice: 84.26 },
      { description: "Conception et développement de l'application", quantity: 1, unitPrice: 500 },
    ];
    const rows = (buildServiceDocs(base({ amount: null, appName: "Procedia", lines: renamed })).demande.blocks.find((b) => b.t === "amount") as { rows: { label: string; value: string; details?: [string, string][] }[] }).rows;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ label: "Hébergement Procedia", value: "13,19 €" });
    expect(rows[0].details).toHaveLength(3);
    expect(rows[1].label).toContain("intelligence artificielle");
    // « Autre ligne » choisi dans le formulaire : jamais regroupé, même si l'intitulé évoque l'hébergement
    const forced = (buildServiceDocs(base({ amount: null, lines: [{ description: "Hébergement du site vitrine", quantity: 1, unitPrice: 4, source: "free" }] })).demande.blocks.find((b) => b.t === "amount") as { rows: { label: string; details?: unknown }[] }).rows;
    expect(forced[0].details).toBeUndefined();
  });
  it("alimente le total quand aucun montant n'est saisi", () => {
    const all = text(buildServiceDocs(base({ amount: null, lines: [{ description: "A", quantity: 1, unitPrice: 7 }, { description: "B", quantity: 1, unitPrice: 6.5 }] })));
    expect(all).toContain("13,50 €");
    expect(all).not.toContain("diffère");
  });
  it("en FCFA, le total est la somme des lignes arrondies", () => {
    const all = text(buildServiceDocs(base({ currency: "XOF", amount: null, lines: [{ description: "A", quantity: 1, unitPrice: 4591.7 }, { description: "B", quantity: 1, unitPrice: 4263.72 }] })));
    expect(all).toContain("8 856 FCFA");
    expect(all).not.toContain("8 855 FCFA");
  });
});

describe("logo du client", () => {
  it("retrouve le logo d'après le nom du client, y compris l'orthographe « Antonova »", () => {
    for (const name of ["Catalys Consulting", "CATALYS", "Autonova Group", "Antonova Group", "My Autonova"]) {
      const logo = clientLogoFor(name);
      expect(logo, name).not.toBeNull();
      expect(pngSize(logo!)?.width).toBeGreaterThan(100);
    }
    expect(clientLogoFor("Client inconnu")).toBeNull();
  });
  it("imprime le logo en PDF et en Word sans casser le document, et rien sans logo", async () => {
    const logo = clientLogoFor("Catalys Consulting")!;
    const withLogo = buildServiceDocs(base({ clientLogo: logo }));
    expect((withLogo.demande.blocks[0] as { logo?: Buffer | null }).logo).toBe(logo);
    expect((withLogo.convention.blocks[0] as { logo?: Buffer | null }).logo).toBe(logo);
    const a = await renderServiceDocPdf(withLogo.demande.blocks, withLogo.demande.header, withLogo.brand);
    const b = await renderServiceDocPdf(buildServiceDocs(base()).demande.blocks, "x", "NJMDev");
    expect(a.subarray(0, 5).toString()).toBe("%PDF-");
    expect(a.length).toBeGreaterThan(b.length + 10_000); // le logo est bien embarqué
    const docx = await renderServiceDocDocx(withLogo.convention.blocks, withLogo.convention.header, withLogo.brand);
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect((buildServiceDocs(base()).demande.blocks[0] as { logo?: unknown }).logo ?? null).toBeNull();
  });
});

// Nécessite une vraie base : TEST_DATABASE_URL=postgresql://... npx vitest run --no-file-parallelism (les fichiers de test partagent la base)
describe.skipIf(!process.env.TEST_DATABASE_URL)("API dossiers de prestation", () => {
  let app: ReturnType<typeof import("../src/app").createApp>;
  let prisma: typeof import("../src/db/prisma").prisma;
  let auth: { Authorization: string };
  let clientId = "";
  const bin = (r: any, cb: any) => { const c: Buffer[] = []; r.on("data", (x: Buffer) => c.push(x)); r.on("end", () => cb(null, Buffer.concat(c))); };
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ prisma } = await import("../src/db/prisma"));
    const { signToken } = await import("../src/middleware/auth");
    app = (await import("../src/app")).createApp();
    auth = { Authorization: `Bearer ${signToken({ sub: "t", email: "t@example.test" })}` };
    await prisma.billingSigner.deleteMany(); await prisma.billingSignRequest.deleteMany(); await prisma.billingServiceDoc.deleteMany();
    await prisma.setting.upsert({ where: { key: "billing.profile" }, create: { key: "billing.profile", value: JSON.stringify({ legalName: "Nom Test", businessAddress: "1 rue X, Lyon" }) }, update: { value: JSON.stringify({ legalName: "Nom Test", businessAddress: "1 rue X, Lyon" }) } });
    clientId = (await prisma.billingClient.create({ data: { name: "Client test" } })).id;
  });
  afterAll(async () => { await prisma.billingSigner.deleteMany(); await prisma.billingSignRequest.deleteMany(); await prisma.billingServiceDoc.deleteMany(); await prisma.billingClient.delete({ where: { id: clientId } }); await prisma.$disconnect(); });

  it("télécharge la demande en PDF et en Word, et refuse la convention sans loi ni juridiction", async () => {
    const created = await request(app).post("/api/billing/service-docs").set(auth).send({ clientId, appName: "App test", amount: 1500, currency: "EUR", features: ["A", "B"], lines: [{ description: "Hébergement test", quantity: 1, unitPrice: 25 }] });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const pdf = await request(app).get(`/api/billing/service-docs/${id}/demande.pdf`).set(auth).buffer().parse(bin);
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    const docx = await request(app).get(`/api/billing/service-docs/${id}/demande.docx`).set(auth).buffer().parse(bin);
    expect((docx.body as Buffer).subarray(0, 2).toString()).toBe("PK");
    const refused = await request(app).get(`/api/billing/service-docs/${id}/convention.pdf`).set(auth);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toContain("loi applicable");
    await request(app).put(`/api/billing/service-docs/${id}`).set(auth).send({ clientId, appName: "App test", amount: 1500, terms: { law: "française", jurisdiction: "Tribunal de Lyon" } });
    const ok = await request(app).get(`/api/billing/service-docs/${id}/convention.pdf`).set(auth).buffer().parse(bin);
    expect(ok.status).toBe(200);
    expect((ok.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });
  it("exige l'authentification et refuse un client inconnu", async () => {
    expect((await request(app).get("/api/billing/service-docs")).status).toBe(401);
    expect((await request(app).post("/api/billing/service-docs").set(auth).send({ clientId: "nope", appName: "x" })).status).toBe(400);
  });
});
