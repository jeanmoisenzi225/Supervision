import { Prisma } from "@prisma/client";

type PdfLine = {
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  total: Prisma.Decimal;
};
type PdfInvoice = {
  id: string; number: string | null; currency: string; issueDate: Date | null;
  serviceDate: Date | null; dueDate: Date | null; notes: string | null;
  subtotal: Prisma.Decimal; vatTotal: Prisma.Decimal; total: Prisma.Decimal;
  client: { name: string; email: string | null; phone: string | null; billingAddress: string | null; postalCode: string | null; city: string | null; country: string; rccm: string | null; ncc: string | null };
  lines: PdfLine[];
};
type Profile = {
  brandName?: string; contactEmail?: string; phone?: string; website?: string; paymentDetails?: string;
  legalName?: string; businessAddress?: string; rccm?: string; ncc?: string;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const enc = (value: string) => {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 63;
    if (code <= 255) bytes.push(code);
    else {
      const mapped: Record<number, number> = { 0x20ac: 128, 0x201a: 130, 0x0192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02c6: 136, 0x2030: 137, 0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017d: 142, 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x02dc: 152, 0x2122: 153, 0x0161: 154, 0x203a: 155, 0x0153: 156, 0x017e: 158, 0x0178: 159 };
      bytes.push(mapped[code] ?? 63);
    }
  }
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
};
const safe = (value: unknown) => String(value ?? "").replace(/[\\r\\n\\t]+/g, " ").trim();
const money = (value: Prisma.Decimal | number, currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: currency === "XOF" ? 0 : 2 }).format(Number(value));
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("fr-FR").format(value) : "—";
const wrap = (value: string, max = 82) => {
  const words = safe(value).split(/\\s+/);
  const result: string[] = [];
  let current = "";
  for (const word of words) {
    if (!word) continue;
    if ((current + " " + word).trim().length > max && current) { result.push(current); current = word; }
    else current = (current + " " + word).trim();
  }
  if (current) result.push(current);
  return result.length ? result : [""];
};

export function generateDraftInvoicePdf(invoice: PdfInvoice, profile: Profile): Buffer {
  const pages: string[][] = [[]];
  let y = 0;
  const page = () => pages[pages.length - 1];
  const text = (value: string, x: number, top: number, size = 9, bold = false) => {
    page().push(`BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(PAGE_H - top).toFixed(2)} Tm <${enc(value)}> Tj ET`);
  };
  const line = (x1: number, top1: number, x2: number, top2: number) =>
    page().push(`0.78 G 0.6 w ${x1} ${(PAGE_H-top1).toFixed(2)} m ${x2} ${(PAGE_H-top2).toFixed(2)} l S 0 G`);
  const ensure = (height: number) => {
    if (y + height > PAGE_H - 55) { pages.push([]); y = 48; text(profile.brandName || "NJMDev", MARGIN, 32, 10, true); text("BROUILLON — SUITE", PAGE_W - 150, 32, 9, true); }
  };
  const paragraph = (value: string, x = MARGIN, max = 82, size = 9, leading = 13) => {
    for (const part of wrap(value, max)) { ensure(leading); text(part, x, y, size); y += leading; }
  };

  y = 48;
  text(profile.brandName || "NJMDev", MARGIN, y, 22, true);
  text("BROUILLON", PAGE_W - 130, y + 3, 12, true);
  y += 20;
  if (profile.legalName) { paragraph(profile.legalName, MARGIN, 80); }
  if (profile.businessAddress) paragraph(profile.businessAddress, MARGIN, 80);
  if (profile.contactEmail) paragraph(profile.contactEmail, MARGIN, 80);
  if (profile.phone) paragraph(profile.phone, MARGIN, 80);
  if (profile.website) paragraph(profile.website, MARGIN, 80);
  if (profile.rccm) paragraph("RCCM : " + profile.rccm, MARGIN, 80);
  if (profile.ncc) paragraph("NCC : " + profile.ncc, MARGIN, 80);
  y += 12;
  line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 22;
  text("FACTURE — DOCUMENT DE TRAVAIL", MARGIN, y, 15, true);
  y += 20;
  text("Référence : BROUILLON-" + invoice.id.slice(-8).toUpperCase(), MARGIN, y, 9, true);
  y += 16;
  text("Date du document : " + date(invoice.issueDate), MARGIN, y);
  text("Date de prestation : " + date(invoice.serviceDate), 300, y);
  y += 14;
  text("Échéance : " + date(invoice.dueDate), MARGIN, y);
  text("Devise : " + invoice.currency, 300, y);
  y += 24;
  text("FACTURÉ À", MARGIN, y, 9, true);
  y += 15;
  paragraph(invoice.client.name, MARGIN, 75, 10, 13);
  if (invoice.client.billingAddress) paragraph(invoice.client.billingAddress);
  const locality = [invoice.client.postalCode, invoice.client.city].filter(Boolean).join(" ");
  if (locality) paragraph(locality);
  paragraph(invoice.client.country);
  if (invoice.client.email) paragraph(invoice.client.email);
  if (invoice.client.phone) paragraph(invoice.client.phone);
  if (invoice.client.rccm) paragraph("RCCM : " + invoice.client.rccm);
  if (invoice.client.ncc) paragraph("NCC : " + invoice.client.ncc);
  y += 18;

  const columns = [MARGIN, 300, 345, 415, 465, PAGE_W - MARGIN];
  const headers = ["Désignation", "Qté", "Prix unit.", "Remise", "TVA", "Total HT"];
  const header = () => {
    ensure(30);
    line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5);
    headers.forEach((label, index) => text(label, columns[index] + 2, y + 8, 7.5, true));
    y += 18;
    line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 13;
  };
  header();
  for (const item of invoice.lines) {
    const descLines = wrap(item.description, 42);
    const height = Math.max(16, descLines.length * 11);
    ensure(height + 8);
    if (y === 61) header();
    descLines.forEach((part, index) => text(part, columns[0] + 2, y + index * 11, 7.5));
    text(safe(item.quantity.toString()), columns[1] + 2, y, 7.5);
    text(money(item.unitPrice, invoice.currency), columns[2] + 2, y, 7.2);
    text(item.discountPercent.toString() + "%", columns[3] + 2, y, 7.5);
    text(item.vatRate.toString() + "%", columns[4] + 2, y, 7.5);
    text(money(item.subtotal, invoice.currency), columns[5] - 2, y, 7.2);
    y += height + 4;
    line(MARGIN, y - 2, PAGE_W - MARGIN, y - 2);
  }
  y += 15;
  ensure(75);
  const totalX = PAGE_W - 205;
  text("Total HT", totalX, y, 9); text(money(invoice.subtotal, invoice.currency), PAGE_W - MARGIN - 2, y, 9, true); y += 17;
  text("Total TVA", totalX, y, 9); text(money(invoice.vatTotal, invoice.currency), PAGE_W - MARGIN - 2, y, 9, true); y += 19;
  text("TOTAL TTC", totalX, y, 11, true); text(money(invoice.total, invoice.currency), PAGE_W - MARGIN - 2, y, 11, true); y += 28;
  if (invoice.notes) { text("NOTES", MARGIN, y, 9, true); y += 14; paragraph(invoice.notes, MARGIN, 90, 8.5, 12); y += 10; }
  if (profile.paymentDetails) { ensure(45); text("INFORMATIONS DE PAIEMENT", MARGIN, y, 9, true); y += 14; paragraph(profile.paymentDetails, MARGIN, 90, 8.5, 12); y += 8; }
  ensure(55);
  line(MARGIN, y, PAGE_W - MARGIN, y); y += 15;
  text("DOCUMENT DE TRAVAIL — BROUILLON NON ÉMIS", MARGIN, y, 8, true); y += 12;
  paragraph("Ce document n'est pas une facture officielle. Aucun numéro fiscal ni aucune certification FNE n'y sont attribués.", MARGIN, 95, 7.5, 10);

  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontRegularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  for (const commands of pages) {
    const stream = commands.join("\\n");
    const streamId = add(`<< /Length ${Buffer.byteLength(stream, "ascii")} >>\\nstream\\n${stream}\\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\\n%âãÏÓ\\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output, "binary"));
    output += `${index + 1} 0 obj\\n${body}\\nendobj\\n`;
  });
  const xref = Buffer.byteLength(output, "binary");
  output += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
  for (const offset of offsets.slice(1)) output += offset.toString().padStart(10, "0") + " 00000 n \\n";
  output += `trailer\\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\\nstartxref\\n${xref}\\n%%EOF`;
  return Buffer.from(output, "binary");
}
