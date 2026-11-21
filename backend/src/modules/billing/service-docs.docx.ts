import { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import fs from "node:fs";
import path from "node:path";
import type { Block } from "./service-docs.content";

const LOGO = fs.readFileSync(path.resolve(__dirname, "../../../assets/logo-njmdev.png"));
const MUTED = "6D6E74", LINE = "D9D6CC";
const TOK = /(\*\*.+?\*\*|⟦.+?⟧)/;
function runs(t: string, size = 20, bold = false, color?: string): TextRun[] {
  const out: TextRun[] = [];
  for (const part of t.split(TOK)) {
    if (!part) continue;
    if (part.startsWith("**")) out.push(...runs(part.slice(2, -2), size, true, color));
    else if (part.startsWith("⟦")) out.push(new TextRun({ text: part.slice(1, -1), size, bold, font: "Inter", shading: { type: ShadingType.CLEAR, fill: "FFF1B8", color: "auto" } }));
    else out.push(new TextRun({ text: part, size, bold, color, font: "Inter" }));
  }
  return out;
}
const p = (t: string, o: { size?: number; bold?: boolean; color?: string; after?: number; indent?: number } = {}) =>
  new Paragraph({ children: runs(t, o.size ?? 20, o.bold, o.color), spacing: { after: o.after ?? 100 }, indent: o.indent ? { left: o.indent } : undefined });
const border = (color = LINE) => ({ style: BorderStyle.SINGLE, size: 4, color });
const borders = (color = LINE) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const cell = (children: Paragraph[], w: number, color = LINE) => new TableCell({ children, width: { size: w, type: WidthType.PERCENTAGE }, borders: borders(color), margins: { top: 80, bottom: 80, left: 120, right: 120 } });
const gap = () => new Paragraph({ children: [], spacing: { after: 80 } });

function toDocx(b: Block): (Paragraph | Table)[] {
  switch (b.t) {
    case "title": return [p(b.title, { size: 40, bold: true, after: 20 }), p(b.sub, { size: 22, color: MUTED, after: 200 })];
    case "meta": return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: b.items.map(([l, v]) => cell([p(l.toUpperCase(), { size: 14, color: MUTED, after: 20 }), p(v, { size: 19, after: 0 })], 100 / b.items.length)) })] }), gap()];
    case "warn": return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [cell([p(b.text, { size: 18, after: 0 })], 100, "C76A00")] })] }), gap()];
    case "h2": return [new Paragraph({ children: [new TextRun({ text: b.text, bold: true, size: 23, font: "Inter" })], spacing: { before: 220, after: 100 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 2 } } })];
    case "p": return [p(b.text, b.small ? { size: 17, color: MUTED } : {})];
    case "list": return b.items.map((it) => p("•  " + it, { after: 40, indent: 360 }));
    case "cols": return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ cantSplit: true, children: [b.left, b.right].map(([title, items]) => cell([p(title.toUpperCase(), { size: 14, bold: true, color: MUTED, after: 40 }), ...items.map((x) => p(x, { size: 18, after: 50 }))], 50)) })] }), gap()];
    case "kv": return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: b.rows.map(([k, v]) => new TableRow({ cantSplit: true, children: [cell([p(k, { size: 19, color: MUTED, after: 0 })], 34), cell([p(v, { size: 19, after: 0 })], 66)] })) }), gap()];
    case "amount": return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [...b.rows.map(([l, v]) => new TableRow({ children: [cell([p(l, { after: 0 })], 75, "0D0E10"), cell([p(v, { after: 0 })], 25, "0D0E10")] })), new TableRow({ children: [cell([p("Montant total demandé", { size: 24, bold: true, after: 0 })], 75, "0D0E10"), cell([p(b.total, { size: 24, bold: true, after: 0 })], 25, "0D0E10")] })] }), gap(), p(b.note, { size: 17, color: MUTED })];
    case "art": return [new Paragraph({ children: [new TextRun({ text: `Article ${b.n} — ${b.title}`, bold: true, size: 22, font: "Inter" })], spacing: { before: 200, after: 100 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 2 } } }), ...b.items.flatMap((it) => (typeof it === "string" ? [p(it)] : toDocx(it)))];
    case "sig2": return [p(b.intro, { after: 160 }), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ cantSplit: true, children: [["Le prestataire", b.left], [b.rightLabel ?? "Le client", b.right]].map(([l, w]) => cell([p(l, { bold: true, after: 20 }), p(w, { size: 18, after: 60 }), p("Fait à ________________, le ____ / ____ / ________", { size: 16, color: MUTED }), p("Signature précédée de « Lu et approuvé »", { size: 16, color: MUTED }), ...Array.from({ length: 5 }, () => p("", {}))], 50)) })] })];
    case "foot": return [p(b.text, { size: 16, color: MUTED })];
  }
}

export async function renderServiceDocDocx(blocks: Block[], header: string, brand: string): Promise<Buffer> {
  const doc = new Document({
    title: header, creator: brand,
    styles: { default: { document: { run: { font: "Inter", size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1500, bottom: 1100, left: 1100, right: 1100 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new ImageRun({ type: "png", data: LOGO, transformation: { width: 55, height: 34 } }), new TextRun({ text: "\t" + header, size: 15, color: MUTED, font: "Inter" })], tabStops: [{ type: "right", position: 9700 }] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${brand} : identité visuelle, ne constitue pas une société immatriculée · Page `, size: 15, color: MUTED, font: "Inter" }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED, font: "Inter" })] })] }) },
      children: blocks.flatMap(toDocx),
    }],
  });
  return Packer.toBuffer(doc);
}
