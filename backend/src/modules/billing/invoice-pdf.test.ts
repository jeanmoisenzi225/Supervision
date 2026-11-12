import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { generateDraftInvoicePdf } from "./invoice-pdf";

const decimal = (value: number) => new Prisma.Decimal(value);

describe("generateDraftInvoicePdf", () => {
  it("produces a downloadable PDF containing an explicit draft watermark", () => {
    const pdf = generateDraftInvoicePdf({
      id: "draft_12345678",
      number: null,
      currency: "XOF",
      issueDate: new Date("2026-11-09T12:00:00.000Z"),
      serviceDate: null,
      dueDate: null,
      notes: "Prestation de développement",
      subtotal: decimal(125000),
      vatTotal: decimal(0),
      total: decimal(125000),
      client: {
        name: "Client Démo",
        email: "client@example.test",
        phone: null,
        billingAddress: "Plateau",
        postalCode: null,
        city: "Abidjan",
        country: "Côte d’Ivoire",
        rccm: null,
        ncc: null,
      },
      lines: [{
        description: "Développement d’application",
        quantity: decimal(1),
        unitPrice: decimal(125000),
        discountPercent: decimal(0),
        vatRate: decimal(0),
        subtotal: decimal(125000),
        vatAmount: decimal(0),
        total: decimal(125000),
      }],
    }, { brandName: "NJMDev" });

    const source = pdf.toString("binary");
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect(source).toContain("startxref");
    expect(source).toContain("42524F55494C4C4F4E");
  });

  it("titre une facture prévisionnelle et précise qu'elle n'est pas définitive", () => {
    const base = {
      id: "forecast_12345678", number: null, kind: "forecast", period: "2026-11", currency: "EUR",
      issueDate: null, serviceDate: null, dueDate: null, notes: null,
      subtotal: decimal(13), vatTotal: decimal(0), total: decimal(13),
      client: { name: "Client Démo", email: null, phone: null, billingAddress: null, postalCode: null, city: null, country: "Côte d’Ivoire", rccm: null, ncc: null },
      lines: [{ description: "Procedia — hébergement", quantity: decimal(1), unitPrice: decimal(13), discountPercent: decimal(0), vatRate: decimal(0), subtotal: decimal(13), vatAmount: decimal(0), total: decimal(13) }],
    };
    const hex = (text: string) => Buffer.from(text, "latin1").toString("hex").toUpperCase();
    const forecast = generateDraftInvoicePdf(base, { brandName: "NJMDev" }).toString("binary");
    expect(forecast).toContain(hex("PR\xC9VISIONNELLE"));
    expect(forecast).toContain(hex("PREVISION-"));
    expect(forecast).not.toContain("42524F55494C4C4F4E2D"); // pas de « BROUILLON- »
    const draft = generateDraftInvoicePdf({ ...base, kind: "draft" }, { brandName: "NJMDev" }).toString("binary");
    expect(draft).toContain(hex("BROUILLON-"));
  });
});
