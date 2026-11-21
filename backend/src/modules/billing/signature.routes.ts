import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { appendCertificate, codeMatches, hashToken, MAX_ATTEMPTS, parseSignaturePng, renderCertificate, sha256 } from "./signature.service";

/** Page de signature : ouverte sans connexion, protégée par le lien personnel ET le code transmis à part. */
export const signRouter = asyncRouter();
signRouter.use(rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Trop de tentatives, réessaie dans quelques minutes." } }));

const bodySchema = z.object({ code: z.string().regex(/^\d{6}$/, "Le code comporte 6 chiffres") });
const signSchema = bodySchema.extend({
  typedName: z.string().trim().min(3, "Écris ton nom complet").max(120),
  signature: z.string().max(250_000),
  consent: z.literal(true, { errorMap: () => ({ message: "Coche la case pour confirmer" }) }),
});

async function authenticate(token: string, code: string) {
  const signer = await prisma.billingSigner.findUnique({ where: { tokenHash: hashToken(token) }, include: { request: { include: { signers: { orderBy: { role: "desc" } } } } } });
  if (!signer) throw new HttpError(404, "Lien de signature invalide ou expiré");
  if (signer.attempts >= MAX_ATTEMPTS) throw new HttpError(423, "Trop d'essais : demande un nouveau lien et un nouveau code à l'émetteur.");
  if (!codeMatches(code, signer.codeHash)) {
    await prisma.billingSigner.update({ where: { id: signer.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(403, "Code incorrect");
  }
  if (signer.request.status === "cancelled") throw new HttpError(410, "Cette demande de signature a été annulée.");
  if (signer.request.status === "pending" && signer.request.expiresAt < new Date()) throw new HttpError(410, "Ce lien de signature a expiré : demande-en un nouveau à l'émetteur.");
  if (signer.attempts) await prisma.billingSigner.update({ where: { id: signer.id }, data: { attempts: 0 } });
  return signer;
}

function view(signer: Awaited<ReturnType<typeof authenticate>>) {
  const r = signer.request;
  return {
    title: r.title, role: signer.role, name: signer.name, signerStatus: signer.status, requestStatus: r.status, sha256: r.pdfSha256,
    signers: r.signers.map((s) => ({ role: s.role, name: s.name, status: s.status })),
  };
}

signRouter.post("/:token/open", async (req, res) => {
  const { code } = bodySchema.parse(req.body);
  const signer = await authenticate(req.params.token, code);
  if (!signer.viewedAt) await prisma.billingSigner.update({ where: { id: signer.id }, data: { viewedAt: new Date() } });
  const pdf = signer.request.status === "completed" && signer.request.signedPdf ? signer.request.signedPdf : signer.request.pdf;
  res.json({ ...view(signer), pdfBase64: Buffer.from(pdf).toString("base64") });
});

signRouter.post("/:token/sign", async (req, res) => {
  const input = signSchema.parse(req.body);
  const signer = await authenticate(req.params.token, input.code);
  if (signer.request.status !== "pending") throw new HttpError(409, "Cette demande n'est plus ouverte à la signature.");
  if (signer.status === "signed") throw new HttpError(409, "Tu as déjà signé ce document.");
  const png = parseSignaturePng(input.signature);
  if (!png) throw new HttpError(400, "Dessine ta signature dans le cadre.");
  const now = new Date();
  await prisma.billingSigner.update({
    where: { id: signer.id },
    data: { status: "signed", signedAt: now, ip: req.ip ?? null, userAgent: (req.get("user-agent") ?? "").slice(0, 300), typedName: input.typedName, signature: png },
  });
  // Dernier signataire : on assemble le PDF signé avec sa page de certificat.
  const fresh = await prisma.billingSignRequest.findUniqueOrThrow({ where: { id: signer.requestId }, include: { signers: { orderBy: { role: "desc" } } } });
  if (fresh.signers.every((s) => s.status === "signed") && fresh.status === "pending") {
    const cert = await renderCertificate({ title: fresh.title, requestId: fresh.id, pdfSha256: fresh.pdfSha256, brand: "NJMDev", signers: fresh.signers.map((s) => ({ role: s.role, name: s.name, typedName: s.typedName, signedAt: s.signedAt, ip: s.ip, userAgent: s.userAgent, signature: s.signature ? Buffer.from(s.signature) : null })) });
    const signedPdf = await appendCertificate(Buffer.from(fresh.pdf), cert);
    await prisma.billingSignRequest.update({ where: { id: fresh.id }, data: { status: "completed", completedAt: now, signedPdf, signedSha256: sha256(signedPdf) } });
  }
  res.json({ ok: true, completed: fresh.signers.every((s) => s.status === "signed") });
});
