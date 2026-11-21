import crypto from "node:crypto";
import zlib from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { codeMatches, hashCode, parseSignaturePng } from "../src/modules/billing/signature.service";

/** PNG valide d'environ 1,6 ko (pixels aléatoires), comme un tracé envoyé par le navigateur. */
function fakePng(): string {
  const w = 20, h = 20, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; crypto.randomFillSync(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1))); }
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0); return Buffer.concat([len, body, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 0 })), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

describe("outils de signature", () => {
  it("vérifie le code sans le stocker en clair", () => {
    const h = hashCode("123456");
    expect(h).not.toContain("123456");
    expect(codeMatches("123456", h)).toBe(true);
    expect(codeMatches("654321", h)).toBe(false);
  });
  it("n'accepte qu'un vrai PNG de taille raisonnable", () => {
    expect(parseSignaturePng(fakePng())).not.toBeNull();
    expect(parseSignaturePng("data:image/png;base64,AAAA")).toBeNull();
    expect(parseSignaturePng("data:text/html;base64,PGI+")).toBeNull();
    expect(parseSignaturePng("n'importe quoi")).toBeNull();
  });
});

// Nécessite une vraie base : TEST_DATABASE_URL=postgresql://... npx vitest run --no-file-parallelism (les fichiers de test partagent la base)
describe.skipIf(!process.env.TEST_DATABASE_URL)("parcours de signature", () => {
  let app: ReturnType<typeof import("../src/app").createApp>;
  let prisma: typeof import("../src/db/prisma").prisma;
  let auth: { Authorization: string };
  let clientId = "", docId = "";
  const bin = (r: any, cb: any) => { const c: Buffer[] = []; r.on("data", (x: Buffer) => c.push(x)); r.on("end", () => cb(null, Buffer.concat(c))); };
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ prisma } = await import("../src/db/prisma"));
    const { signToken } = await import("../src/middleware/auth");
    app = (await import("../src/app")).createApp();
    auth = { Authorization: `Bearer ${signToken({ sub: "t", email: "t@example.test" })}` };
    await prisma.billingSigner.deleteMany(); await prisma.billingSignRequest.deleteMany(); await prisma.billingServiceDoc.deleteMany();
    const prof = JSON.stringify({ legalName: "Nom Test", businessAddress: "1 rue X, Lyon" });
    await prisma.setting.upsert({ where: { key: "billing.profile" }, create: { key: "billing.profile", value: prof }, update: { value: prof } });
    clientId = (await prisma.billingClient.create({ data: { name: "Client test" } })).id;
    docId = (await request(app).post("/api/billing/service-docs").set(auth).send({ clientId, appName: "App", amount: 1000, clientRepresentative: "Rep Test", terms: { law: "française", jurisdiction: "Lyon" } })).body.id;
  });
  afterAll(async () => { await prisma.billingSigner.deleteMany(); await prisma.billingSignRequest.deleteMany(); await prisma.billingServiceDoc.deleteMany(); await prisma.billingClient.delete({ where: { id: clientId } }); await prisma.$disconnect(); });

  it("deux signataires : refus d'un mauvais code, blocage, signatures, PDF signé avec certificat", async () => {
    const created = await request(app).post(`/api/billing/service-docs/${docId}/signature-requests`).set(auth).send({ kind: "convention" });
    expect(created.status).toBe(201);
    expect(created.body.links).toHaveLength(2);
    const [a, b] = created.body.links as { token: string; code: string; role: string }[];
    // jamais de secret dans le résumé
    expect(JSON.stringify(created.body.signers)).not.toContain(a.code);
    // une demande en cours bloque une seconde demande
    expect((await request(app).post(`/api/billing/service-docs/${docId}/signature-requests`).set(auth).send({ kind: "convention" })).status).toBe(409);
    // mauvais code, puis blocage au 5e essai
    const wrong = a.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await request(app).post(`/api/sign/${a.token}/open`).send({ code: wrong })).status).toBe(403);
    expect((await request(app).post(`/api/sign/${a.token}/open`).send({ code: a.code })).status).toBe(423);
    // nouveau lien après blocage
    const sid = created.body.signers.find((x: any) => x.role === a.role).id;
    const reset = await request(app).post(`/api/billing/signature-requests/${created.body.id}/signers/${sid}/reset`).set(auth);
    expect(reset.status).toBe(200);
    expect((await request(app).post(`/api/sign/${a.token}/open`).send({ code: a.code })).status).toBe(404);
    const opened = await request(app).post(`/api/sign/${reset.body.token}/open`).send({ code: reset.body.code });
    expect(opened.status).toBe(200);
    expect(Buffer.from(opened.body.pdfBase64, "base64").subarray(0, 5).toString()).toBe("%PDF-");
    // signature sans case cochée ou sans tracé : refusée
    expect((await request(app).post(`/api/sign/${reset.body.token}/sign`).send({ code: reset.body.code, typedName: "Nom Test", signature: fakePng(), consent: false })).status).toBe(400);
    expect((await request(app).post(`/api/sign/${reset.body.token}/sign`).send({ code: reset.body.code, typedName: "Nom Test", signature: "data:image/png;base64,AAAA", consent: true })).status).toBe(400);
    const s1 = await request(app).post(`/api/sign/${reset.body.token}/sign`).send({ code: reset.body.code, typedName: "Nom Test", signature: fakePng(), consent: true });
    expect(s1.body).toEqual({ ok: true, completed: false });
    expect((await request(app).post(`/api/sign/${reset.body.token}/sign`).send({ code: reset.body.code, typedName: "Nom Test", signature: fakePng(), consent: true })).status).toBe(409);
    expect((await request(app).get(`/api/billing/signature-requests/${created.body.id}/signed.pdf`).set(auth)).status).toBe(409);
    const s2 = await request(app).post(`/api/sign/${b.token}/sign`).set("User-Agent", "TestAgent/1.0").send({ code: b.code, typedName: "Rep Test", signature: fakePng(), consent: true });
    expect(s2.body).toEqual({ ok: true, completed: true });
    // liste globale pour l'onglet « Signatures »
    const list = await request(app).get("/api/billing/signature-requests").set(auth);
    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({ appName: "App", clientName: "Client test" });
    expect((await request(app).get("/api/billing/signature-requests")).status).toBe(401);
    // traces conservées en base, exposées seulement par le journal de preuve (administration)
    const rows = await prisma.billingSigner.findMany({ where: { requestId: created.body.id, status: "signed" } });
    expect(rows.every((x) => x.ip)).toBe(true);
    expect(rows.some((x) => x.userAgent === "TestAgent/1.0")).toBe(true);
    expect((await request(app).get(`/api/billing/signature-requests/${created.body.id}/proof`)).status).toBe(401);
    const proof = await request(app).get(`/api/billing/signature-requests/${created.body.id}/proof`).set(auth);
    expect(proof.status).toBe(200);
    expect(proof.text).toContain("TestAgent/1.0");
    expect(JSON.parse(proof.text).signers).toHaveLength(2);
    const original = await request(app).get(`/api/billing/signature-requests/${created.body.id}/original.pdf`).set(auth).buffer().parse(bin);
    const signed = await request(app).get(`/api/billing/signature-requests/${created.body.id}/signed.pdf`).set(auth).buffer().parse(bin);
    expect(signed.status).toBe(200);
    const { PDFDocument } = await import("pdf-lib");
    const pagesOriginal = (await PDFDocument.load(original.body as Buffer)).getPageCount();
    const pagesSigned = (await PDFDocument.load(signed.body as Buffer)).getPageCount();
    expect(pagesSigned).toBe(pagesOriginal + 1);
    // le signé est ouvert tel quel par un signataire
    const again = await request(app).post(`/api/sign/${b.token}/open`).send({ code: b.code });
    expect(again.body.requestStatus).toBe("completed");
  });

  it("la signature d'un document annulé est refusée, et un dossier avec preuves ne se supprime pas", async () => {
    const created = await request(app).post(`/api/billing/service-docs/${docId}/signature-requests`).set(auth).send({ kind: "demande" });
    expect(created.status).toBe(201);
    expect(created.body.links).toHaveLength(2);
    const l = created.body.links[0];
    expect((await request(app).post(`/api/billing/signature-requests/${created.body.id}/cancel`).set(auth)).status).toBe(200);
    expect((await request(app).post(`/api/sign/${l.token}/open`).send({ code: l.code })).status).toBe(410);
    expect((await request(app).delete(`/api/billing/service-docs/${docId}`).set(auth)).status).toBe(409);
  });
  it("les routes d'administration exigent la connexion", async () => {
    expect((await request(app).post(`/api/billing/service-docs/${docId}/signature-requests`).send({ kind: "demande" })).status).toBe(401);
  });
});
