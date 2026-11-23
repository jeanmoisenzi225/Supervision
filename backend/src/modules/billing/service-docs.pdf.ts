import PDFDocument from "pdfkit";
import path from "node:path";
import type { Block } from "./service-docs.content";

const ASSETS = path.resolve(__dirname, "../../../assets");
const FONT = { r: path.join(ASSETS, "fonts/Inter-Regular.otf"), b: path.join(ASSETS, "fonts/Inter-Bold.otf") };
const LOGO = path.join(ASSETS, "logo-njmdev.png");
const INK = "#0d0e10", MUTED = "#6d6e74", LINE = "#d9d6cc", MINT = "#1f8f5f", WARN = "#c76a00", MARK = "#fff1b8";
const W = 595.28, H = 841.89, ML = 48, MR = 48, TOP = 92, BOT = 62, CW = W - ML - MR;

type Run = { text: string; bold: boolean; mark: boolean };
const TOK = /(\*\*.+?\*\*|⟦.+?⟧)/;
function runs(t: string, bold = false): Run[] {
  const out: Run[] = [];
  for (const part of t.split(TOK)) {
    if (!part) continue;
    if (part.startsWith("**")) out.push(...runs(part.slice(2, -2), true));
    else if (part.startsWith("⟦")) out.push({ text: part.slice(1, -1), bold, mark: true });
    else out.push({ text: part, bold, mark: false });
  }
  return out;
}
type Seg = { text: string; x: number; bold: boolean; mark: boolean; w: number };

/** Emplacement d'un cadre de signature (origine en haut à gauche, en points) : sert à y poser la signature électronique. */
export type SignBox = { role: "prestataire" | "client"; page: number; x: number; y: number; w: number; h: number };
export const SIGN_BOX_HEIGHT = 150;

export async function renderServiceDocPdf(blocks: Block[], header: string, brand: string): Promise<Buffer> {
  return (await renderServiceDocPdfWithBoxes(blocks, header, brand)).pdf;
}

export function renderServiceDocPdfWithBoxes(blocks: Block[], header: string, brand: string): Promise<{ pdf: Buffer; boxes: SignBox[] }> {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { Title: header, Author: brand } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  doc.registerFont("r", FONT.r); doc.registerFont("b", FONT.b);
  let y = TOP;
  let pageNo = 0;
  const boxes: SignBox[] = [];
  const width = (s: string, bold: boolean, size: number) => doc.font(bold ? "b" : "r").fontSize(size).widthOfString(s);
  const ensure = (h: number) => { if (y + h > H - BOT) { doc.addPage(); pageNo++; y = TOP; } };

  function layout(text: string, w: number, size: number, bold = false): Seg[][] {
    const lines: Seg[][] = [[]];
    let x = 0;
    for (const run of runs(text, bold)) {
      for (const tok of run.text.split(/(\s+)/)) {
        if (!tok) continue;
        const space = /^\s+$/.test(tok);
        const tw = width(tok, run.bold, size);
        if (!space && x + tw > w && x > 0) { lines.push([]); x = 0; }
        if (space && x === 0) continue;
        lines[lines.length - 1].push({ text: tok, x, bold: run.bold, mark: run.mark, w: tw });
        x += tw;
      }
    }
    return lines;
  }
  function drawLine(segs: Seg[], x0: number, top: number, size: number, color: string) {
    for (const s of segs) {
      if (s.mark) doc.save().roundedRect(x0 + s.x - 1, top - 1.5, s.w + 2, size + 3.5, 2).fill(MARK).restore();
      doc.font(s.bold ? "b" : "r").fontSize(size).fillColor(s.mark ? "#4a3b00" : color).text(s.text, x0 + s.x, top, { lineBreak: false });
    }
  }
  const height = (lines: Seg[][], leading: number) => lines.length * leading;
  /** Paragraphe qui peut se couper entre deux pages. */
  function para(text: string, o: { x?: number; w?: number; size?: number; lead?: number; color?: string; bold?: boolean; after?: number } = {}) {
    const x = o.x ?? ML, w = o.w ?? CW, size = o.size ?? 9.6, lead = o.lead ?? size * 1.5;
    const lines = layout(text, w, size, o.bold);
    lines.forEach((ln, i) => {
      // évite une ligne seule en bas ou en haut de page
      if (i === 0) ensure(Math.min(lines.length, 2) * lead); else ensure(lead);
      drawLine(ln, x, y, size, o.color ?? INK); y += lead;
    });
    y += o.after ?? 5;
  }
  /** Mesure du tableau des montants : lignes de texte, hauteurs de ligne et hauteur totale. */
  function measureAmount(b: Extract<Block, { t: "amount" }>) {
    const labelW = CW - 160, detailW = CW - 190;
    const rows = b.rows.map((r) => ({ ls: layout(r.label, labelW, 9.6), val: r.value, det: (r.details ?? []).map(([dl, dv]) => ({ ls: layout(dl, detailW, 8.4), dv })) }));
    const rh = rows.map((r) => Math.max(r.ls.length * 13, 13) + 12 + r.det.reduce((t, x) => t + Math.max(x.ls.length * 11.5, 11.5) + 1.5, 0) + (r.det.length ? 4 : 0));
    return { rows, rh, h: rh.reduce((t, x) => t + x, 0) + 33 };
  }
  function box(h: number, stroke = LINE, fill?: string) {
    doc.save().roundedRect(ML, y, CW, h, 5);
    if (fill) doc.fillAndStroke(fill, stroke); else doc.lineWidth(0.8).stroke(stroke);
    doc.restore();
  }
  function render(b: Block) {
    switch (b.t) {
      case "title": {
        ensure(90);
        doc.font("b").fontSize(21).fillColor(INK);
        const lines = layout(b.title, CW, 21, true);
        for (const ln of lines) { drawLine(ln, ML, y, 21, INK); y += 26; }
        doc.font("r").fontSize(11).fillColor(MUTED).text(b.sub, ML, y, { lineBreak: false }); y += 20;
        doc.rect(ML, y, 54, 3).fill(MINT); y += 16; break;
      }
      case "meta": {
        const colW = CW / b.items.length;
        const cells = b.items.map(([, val]) => layout(val, colW - 18, 9.6));
        const h = 16 + Math.max(...cells.map((l) => l.length)) * 13 + 8;
        ensure(h + 10); box(h);
        b.items.forEach(([label], i) => {
          doc.font("b").fontSize(6.8).fillColor(MUTED).text(label.toUpperCase(), ML + 10 + i * colW, y + 8, { lineBreak: false, characterSpacing: 0.6 });
          cells[i].forEach((ln, j) => drawLine(ln, ML + 10 + i * colW, y + 20 + j * 13, 9.6, INK));
        });
        y += h + 10; break;
      }
      case "mention": {
        const lines = layout(b.text, CW, 8.6);
        const h = 24 + lines.length * 12.5 + 8; ensure(h + 6);
        doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.6).stroke(LINE);
        doc.font("b").fontSize(6.8).fillColor(MUTED).text(b.label.toUpperCase(), ML, y + 9, { lineBreak: false, characterSpacing: 0.9 });
        lines.forEach((ln, i) => drawLine(ln, ML, y + 22 + i * 12.5, 8.6, "#3d3e44"));
        doc.moveTo(ML, y + h).lineTo(W - MR, y + h).lineWidth(0.6).stroke(LINE);
        y += h + 12; break;
      }
      case "h2": {
        ensure(120); y += 8;
        doc.font("b").fontSize(11).fillColor(INK).text(b.text, ML, y, { lineBreak: false }); y += 17;
        doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.6).stroke(LINE); y += 8; break;
      }
      case "p": para(b.text, b.small ? { size: 8.6, color: MUTED } : {}); break;
      case "list": for (const it of b.items) { ensure(15); doc.font("r").fontSize(9.6).fillColor(INK).text("•", ML + 6, y, { lineBreak: false }); para(it, { x: ML + 20, w: CW - 20, after: 2 }); } y += 3; break;
      case "cols": {
        const cw = (CW - 12) / 2;
        const cols = [b.left, b.right].map(([title, items]) => ({ title, lines: items.map((it) => layout(it, cw - 20, 8.8)) }));
        const hs = cols.map((c) => 26 + c.lines.reduce((s, l) => s + l.length * 12.5 + 3, 0));
        const h = Math.max(...hs); ensure(h + 8);
        cols.forEach((c, i) => {
          const x = ML + i * (cw + 12);
          doc.save().roundedRect(x, y, cw, h, 5).lineWidth(0.8).stroke(LINE).restore();
          doc.font("b").fontSize(7).fillColor(MUTED).text(c.title.toUpperCase(), x + 10, y + 9, { lineBreak: false, characterSpacing: 0.7 });
          let yy = y + 24;
          for (const ls of c.lines) { for (const ln of ls) { drawLine(ln, x + 10, yy, 8.8, INK); yy += 12.5; } yy += 3; }
        });
        y += h + 10; break;
      }
      case "kv": {
        for (const [k, val] of b.rows) {
          const ls = layout(val, CW * 0.66 - 16, 9.4); const h = Math.max(ls.length * 13, 13) + 10; ensure(h);
          doc.font("r").fontSize(9.4).fillColor(MUTED).text(k, ML + 8, y + 5, { lineBreak: false });
          ls.forEach((ln, i) => drawLine(ln, ML + CW * 0.34, y + 5 + i * 13, 9.4, INK));
          y += h; doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.5).stroke(LINE);
        }
        y += 8; break;
      }
      case "amount": {
        const { rows, rh, h } = measureAmount(b);
        ensure(h + 40);
        box(h, INK);
        let yy = y;
        rows.forEach((r, i) => {
          r.ls.forEach((ln, j) => drawLine(ln, ML + 10, yy + 7 + j * 13, 9.6, INK));
          drawLine(layout(r.val, 200, 9.6)[0], W - MR - 10 - width(r.val.replace(/[⟦⟧]/g, ""), false, 9.6), yy + 7, 9.6, INK);
          let dy = yy + 7 + Math.max(r.ls.length * 13, 13) + 1;
          r.det.forEach((x) => {
            x.ls.forEach((ln, j) => drawLine(ln, ML + 24, dy + j * 11.5, 8.4, "#55565c"));
            drawLine(layout(x.dv, 160, 8.4)[0], W - MR - 10 - 6 - width(x.dv, false, 8.4), dy, 8.4, "#55565c");
            dy += Math.max(x.ls.length * 11.5, 11.5) + 1.5;
          });
          yy += rh[i];
          doc.moveTo(ML, yy).lineTo(W - MR, yy).lineWidth(0.4).stroke(LINE);
        });
        doc.save().rect(ML + 0.4, yy, CW - 0.8, 32.6).fill("#f1efe9").restore();
        doc.font("b").fontSize(11.5).fillColor(INK).text("Montant total demandé", ML + 10, yy + 10, { lineBreak: false });
        const tv = b.total.replace(/[⟦⟧]/g, ""); drawLine(layout(b.total, 220, 11.5, true)[0], W - MR - 10 - width(tv, true, 11.5), yy + 10, 11.5, INK);
        y += h + 8; para(b.note, { size: 8.6, color: MUTED }); break;
      }
      case "art": {
        ensure(60); y += 6;
        doc.font("b").fontSize(10.8).fillColor(INK).text(`Article ${b.n} — ${b.title}`, ML, y, { lineBreak: false }); y += 16;
        doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.6).stroke(LINE); y += 7;
        for (const it of b.items) typeof it === "string" ? para(it, { after: 4 }) : render(it);
        break;
      }
      case "sig2": {
        ensure(SIGN_BOX_HEIGHT + 34); y += 4;
        para(b.intro, { after: 8 });
        const cw = (CW - 12) / 2;
        ([["prestataire", "Le prestataire", b.left], ["client", b.rightLabel ?? "Le client", b.right]] as const).forEach(([role, label, who], i) => {
          const x = ML + i * (cw + 12);
          doc.save().roundedRect(x, y, cw, SIGN_BOX_HEIGHT, 5).lineWidth(0.8).stroke(LINE).restore();
          doc.font("b").fontSize(9.4).fillColor(INK).text(label, x + 10, y + 9, { lineBreak: false });
          layout(who, cw - 20, 9).forEach((ln, j) => drawLine(ln, x + 10, y + 23 + j * 12.5, 9, INK));
          doc.font("r").fontSize(7.8).fillColor(MUTED).text("Fait à ________________, le ____ / ____ / ________", x + 10, y + 62, { lineBreak: false });
          doc.text("Signature précédée de « Lu et approuvé »", x + 10, y + 76, { lineBreak: false });
          boxes.push({ role, page: pageNo, x, y, w: cw, h: SIGN_BOX_HEIGHT });
        });
        y += SIGN_BOX_HEIGHT + 12; break;
      }
      case "foot": ensure(40); y += 6; doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.5).stroke(LINE); y += 6; para(b.text, { size: 7.8, color: MUTED }); break;
    }
  }

  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    // Un titre de section suivi du tableau des montants ne doit jamais rester seul en bas de page.
    if (b.t === "h2" && next?.t === "amount") ensure(measureAmount(next).h + 90);
    render(b);
  });

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.image(LOGO, ML, 28, { height: 34 });
    doc.font("r").fontSize(7.8).fillColor(MUTED).text(header, ML, 40, { width: CW, align: "right", lineBreak: false });
    doc.moveTo(ML, 72).lineTo(W - MR, 72).lineWidth(0.6).stroke(LINE);
    doc.moveTo(ML, H - 46).lineTo(W - MR, H - 46).lineWidth(0.6).stroke(LINE);
    doc.font("r").fontSize(7.6).fillColor(MUTED);
    doc.text(`${brand} : identité visuelle, ne constitue pas une société immatriculée`, ML, H - 36, { lineBreak: false });
    const pg = `Page ${i + 1} / ${range.count}`;
    doc.text(pg, W - MR - doc.widthOfString(pg), H - 36, { lineBreak: false });
  }
  return new Promise((resolve, reject) => { doc.on("end", () => resolve({ pdf: Buffer.concat(chunks), boxes })); doc.on("error", reject); doc.end(); });
}
