import crypto from "node:crypto";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PDFDocument as PdfLib, StandardFonts, rgb } from "pdf-lib";
import type { SignBox } from "./service-docs.pdf";
import { env } from "../../config/env";

/**
 * Signature électronique « simple » (v0.48.0) : le signataire est identifié par un lien personnel et un code
 * transmis séparément par l'émetteur ; chaque signature est journalisée (date, nom saisi,
 * tracé) et rattachée à l'empreinte SHA-256 du document figé. Une page de certificat est ajoutée au PDF signé.
 */
export const sha256 = (data: Buffer | string) => crypto.createHash("sha256").update(data).digest("hex");
export const newToken = () => crypto.randomBytes(24).toString("base64url");
export const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
export const hashToken = (token: string) => sha256(token);
export const hashCode = (code: string) => crypto.createHmac("sha256", env.jwtSecret).update(code).digest("hex");
export function codeMatches(code: string, hash: string): boolean {
  const a = Buffer.from(hashCode(code)), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const MAX_ATTEMPTS = 5;
export const VALIDITY_DAYS = 30;

/** Tracé de signature : PNG envoyé par le navigateur (data URL), contrôlé avant stockage. */
export function parseSignaturePng(dataUrl: string): Buffer | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[1], "base64");
  if (buf.length < 100 || buf.length > 180_000) return null;
  return buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? buf : null;
}

export type CertSigner = { role: string; name: string; typedName: string | null; signedAt: Date | null; signature: Buffer | null };
const ROLE: Record<string, string> = { prestataire: "Prestataire", client: "Client" };
const parisTime = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Paris" }).format(d);

/** Page de certificat (PDF A4) : qui a signé quoi, quand, d'où, et l'empreinte du document signé. */
export function renderCertificate(input: { title: string; requestId: string; pdfSha256: string; signers: CertSigner[]; brand: string; complete?: boolean }): Promise<Buffer> {
  const ASSETS = path.resolve(__dirname, "../../../assets");
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Certificat de signature électronique", Author: input.brand } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  doc.registerFont("r", path.join(ASSETS, "fonts/Inter-Regular.otf")); doc.registerFont("b", path.join(ASSETS, "fonts/Inter-Bold.otf"));
  const ML = 48, W = 595.28, CW = W - 96;
  const INK = "#0d0e10", MUTED = "#6d6e74", LINE = "#d9d6cc";
  doc.image(path.join(ASSETS, "logo-njmdev.png"), ML, 28, { height: 34 });
  doc.moveTo(ML, 72).lineTo(W - ML, 72).lineWidth(0.6).stroke(LINE);
  let y = 100;
  doc.font("b").fontSize(19).fillColor(INK).text("CERTIFICAT DE SIGNATURE ÉLECTRONIQUE", ML, y, { width: CW }); y += 30;
  doc.rect(ML, y, 54, 3).fill("#1f8f5f"); y += 18;
  const signedCount = input.signers.filter((s) => s.signedAt).length;
  doc.font("b").fontSize(9.5).fillColor(input.complete === false ? "#a85a00" : "#1f8f5f").text(input.complete === false ? `Document en cours de signature : ${signedCount} signature(s) sur ${input.signers.length}` : "Toutes les signatures sont recueillies", ML, y, { width: CW }); y += 22;
  const kv = (k: string, v: string) => { doc.font("r").fontSize(8.5).fillColor(MUTED).text(k, ML, y, { width: 120, lineBreak: false }); doc.font("r").fontSize(9.5).fillColor(INK).text(v, ML + 125, y, { width: CW - 125 }); y = doc.y + 6; };
  kv("Document", input.title);
  kv("Référence", input.requestId);
  kv("Empreinte SHA-256 du document soumis", input.pdfSha256);
  y += 6;
  for (const s of input.signers) {
    const pending = !s.signedAt;
    const h = pending ? 56 : s.signature ? 139 : 89;
    doc.save().roundedRect(ML, y, CW, h, 5).lineWidth(0.8).stroke(LINE).restore();
    doc.font("b").fontSize(10).fillColor(INK).text(`${ROLE[s.role] ?? s.role} : ${s.name}`, ML + 12, y + 10, { width: CW - 24 });
    if (pending) { doc.font("r").fontSize(8.8).fillColor(MUTED).text("En attente de signature", ML + 12, y + 30, { lineBreak: false }); y += h + 10; continue; }
    const lines: [string, string][] = [["Signé le", s.signedAt ? `${parisTime(s.signedAt)} (heure de Paris)` : "—"], ["Nom saisi", s.typedName ?? "—"], ["Mention", "« Lu et approuvé » (case cochée par le signataire)"]];
    let yy = y + 28;
    for (const [k, v] of lines) { doc.font("r").fontSize(8).fillColor(MUTED).text(k, ML + 12, yy, { width: 80, lineBreak: false }); doc.font("r").fontSize(8.5).fillColor(INK).text(v, ML + 95, yy, { width: CW - 110, lineBreak: false }); yy += 13; }
    if (s.signature) { try { doc.image(s.signature, ML + 12, yy + 4, { fit: [200, 52] }); } catch { /* tracé illisible : le certificat reste valable sans l'image */ } }
    y += h + 10;
  }
  y += 6;
  const note = "Signature électronique simple. Chaque signataire a accédé au document par un lien personnel protégé par un code, transmis séparément par l'émetteur, puis a déclaré avoir pris connaissance du document et accepter de le signer. Les données ci-dessus (date, nom saisi, tracé) sont conservées comme éléments de preuve. L'empreinte SHA-256 permet de vérifier que le document signé n'a pas été modifié depuis la signature : toute modification, même d'une virgule, change l'empreinte.";
  doc.font("r").fontSize(8.2).fillColor(MUTED).text(note, ML, y, { width: CW, lineGap: 2 });
  doc.moveTo(ML, 842 - 46).lineTo(W - ML, 842 - 46).lineWidth(0.6).stroke(LINE);
  doc.font("r").fontSize(7.6).fillColor(MUTED).text(`${input.brand} : identité visuelle, ne constitue pas une société immatriculée`, ML, 842 - 36, { lineBreak: false });
  return new Promise((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); doc.end(); });
}

/** PDF signé = le document figé tel que vu par les signataires + la page de certificat. */
export async function appendCertificate(original: Buffer, certificate: Buffer): Promise<Buffer> {
  const out = await PdfLib.load(original);
  const cert = await PdfLib.load(certificate);
  for (const page of await out.copyPages(cert, cert.getPageIndices())) out.addPage(page);
  return Buffer.from(await out.save());
}

// Caractères acceptés par la police standard du PDF (WinAnsi) ; tout le reste devient « ? ».
const winSafe = (t: string) => t.normalize("NFC").replace(/[^\u0020-\u007E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014\u20AC\u2026]/g, "?");

export type StampSigner = { role: string; typedName: string | null; name: string; signedAt: Date | null; signature: Buffer | null };

/**
 * Pose chaque signature dans son cadre du document : mention « Signé électroniquement le … », nom, tracé.
 * Le document soumis aux signataires (et son empreinte) reste l'original ; ce tampon n'en modifie pas le texte.
 */
export async function stampSignatures(original: Buffer, boxes: SignBox[], signers: StampSigner[]): Promise<Buffer> {
  if (!boxes.length) return original;
  const pdf = await PdfLib.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const s of signers) {
    const box = boxes.find((b) => b.role === s.role);
    if (!box || !s.signedAt) continue;
    const page = pdf.getPage(box.page);
    const H = page.getHeight();
    const bottom = H - (box.y + box.h);
    // Recouvre les lignes « Fait à … le … » du cadre, devenues inutiles.
    page.drawRectangle({ x: box.x + 2, y: bottom + 2, width: box.w - 4, height: box.h - 58 - 2, color: rgb(1, 1, 1) });
    const when = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(s.signedAt);
    // « Lu et approuvé » : la case de la page de signature est cochée pour signer ; la mention est donc portée sur le document.
    page.drawText("Lu et approuvé", { x: box.x + 10, y: H - (box.y + 67), size: 9.4, font: bold, color: rgb(0.05, 0.06, 0.07) });
    page.drawText(winSafe(`Signé électroniquement le ${when}`), { x: box.x + 10, y: H - (box.y + 80), size: 8.2, font, color: rgb(0.05, 0.06, 0.07) });
    page.drawText(winSafe(`par ${s.typedName || s.name}`), { x: box.x + 10, y: H - (box.y + 91), size: 8.2, font, color: rgb(0.25, 0.26, 0.28) });
    if (s.signature) {
      try {
        const img = await pdf.embedPng(s.signature);
        const dims = img.scaleToFit(box.w - 24, 44);
        page.drawImage(img, { x: box.x + 12, y: bottom + 8, width: dims.width, height: dims.height });
      } catch { /* tracé illisible : la mention reste, le certificat garde le tracé */ }
    }
  }
  return Buffer.from(await pdf.save());
}

type BuildReq = { id: string; title: string; pdf: Uint8Array | Buffer; pdfSha256: string; boxes: unknown };
type BuildSigner = { role: string; name: string; status: string; typedName: string | null; signedAt: Date | null; signature: Uint8Array | Buffer | null };

/**
 * Assemble la version signée du document à ce jour : chaque signature reçue est posée dans son cadre, puis une page de
 * certificat liste les signataires (ceux qui ont signé, et ceux qui sont encore attendus). Utilisée après CHAQUE signature :
 * l'autre partie voit ainsi les signatures déjà apposées, et la version finale est la dernière construite.
 */
export async function buildSignedDocument(req: BuildReq, signers: BuildSigner[]): Promise<{ pdf: Buffer; complete: boolean }> {
  const complete = signers.every((s) => s.status === "signed");
  const list = signers.map((s) => ({ role: s.role, name: s.name, typedName: s.typedName, signedAt: s.signedAt, signature: s.signature ? Buffer.from(s.signature) : null }));
  const boxes = Array.isArray(req.boxes) ? (req.boxes as unknown as SignBox[]) : [];
  const stamped = await stampSignatures(Buffer.from(req.pdf), boxes, list);
  const cert = await renderCertificate({ title: req.title, requestId: req.id, pdfSha256: req.pdfSha256, brand: "NJMDev", signers: list, complete });
  return { pdf: await appendCertificate(stamped, cert), complete };
}
