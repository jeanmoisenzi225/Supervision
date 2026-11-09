import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";\nimport { generateDraftInvoicePdf } from "./invoice-pdf";

export const billingRouter = asyncRouter();
billingRouter.use(requireAdmin);

const clientSchema = z.object({
  kind: z.enum(["company", "individual"]).default("company"),
  name: z.string().trim().min(1).max(180),
  email: z.string().trim().email().max(180).or(z.literal("")).optional(),
  phone: z.string().trim().max(60).optional(),
  billingAddress: z.string().trim().max(500).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(100).default("Côte d’Ivoire"),
  rccm: z.string().trim().max(60).optional(),
  ncc: z.string().trim().max(40).optional(),
  vatNumber: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const lineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(1000000),
  unitPrice: z.coerce.number().min(0).max(100000000),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(0),
});

const invoiceSchema = z.object({
  clientId: z.string().min(1),
  currency: z.enum(["XOF", "EUR", "USD"]).default("XOF"),
  issueDate: z.string().optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().max(4000).optional(),
  lines: z.array(lineSchema).min(1).max(100),
});

const profileSchema = z.object({
  brandName: z.string().max(120).default("NJMDev"),
  contactEmail: z.string().email().or(z.literal("")).optional(),
  phone: z.string().max(60).optional(),
  website: z.string().url().or(z.literal("")).optional(),
  paymentDetails: z.string().max(1000).optional(),
  country: z.string().max(100).default("Côte d’Ivoire"),
  legalName: z.string().max(180).optional(),
  legalForm: z.enum(["entreprise_individuelle"]).optional(),
  businessAddress: z.string().max(500).optional(),
  rccm: z.string().max(60).optional(),
  ncc: z.string().max(40).optional(),
  taxRegime: z.string().max(100).optional(),
  vatRegime: z.string().max(100).optional(),
  defaultCurrency: z.enum(["XOF", "EUR", "USD"]).default("XOF"),
});

function dateOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Date invalide");
  return date;
}

function calculate(lines: z.infer<typeof lineSchema>[], currency: "XOF" | "EUR" | "USD") {
  const precision = currency === "XOF" ? 0 : 2;
  const calculated = lines.map((line, position) => {
    const quantity = new Prisma.Decimal(line.quantity);
    const unitPrice = new Prisma.Decimal(line.unitPrice);
    const discount = new Prisma.Decimal(1).minus(new Prisma.Decimal(line.discountPercent).div(100));
    const subtotal = quantity.mul(unitPrice).mul(discount).toDecimalPlaces(precision);
    const vatAmount = subtotal.mul(new Prisma.Decimal(line.vatRate).div(100)).toDecimalPlaces(precision);
    return {
      position, description: line.description, quantity, unitPrice,
      discountPercent: new Prisma.Decimal(line.discountPercent),
      vatRate: new Prisma.Decimal(line.vatRate), subtotal, vatAmount,
      total: subtotal.plus(vatAmount).toDecimalPlaces(precision),
    };
  });
  const subtotal = calculated.reduce((sum, line) => sum.plus(line.subtotal), new Prisma.Decimal(0)).toDecimalPlaces(precision);
  const vatTotal = calculated.reduce((sum, line) => sum.plus(line.vatAmount), new Prisma.Decimal(0)).toDecimalPlaces(precision);
  return { lines: calculated, subtotal, vatTotal, total: subtotal.plus(vatTotal).toDecimalPlaces(precision) };
}

billingRouter.get("/profile", async (_req, res) => {
  const row = await prisma.setting.findUnique({ where: { key: "billing.profile" } });
  res.json(row ? JSON.parse(row.value) : { brandName: "NJMDev", contactEmail: "", phone: "", website: "", paymentDetails: "", country: "Côte d’Ivoire", defaultCurrency: "XOF", legalProfileComplete: false });
});

billingRouter.put("/profile", async (req, res) => {
  const profile = profileSchema.parse(req.body);
  const saved = await prisma.setting.upsert({
    where: { key: "billing.profile" },
    create: { key: "billing.profile", value: JSON.stringify({ ...profile, legalProfileComplete: false }) },
    update: { value: JSON.stringify({ ...profile, legalProfileComplete: false }) },
  });
  res.json(JSON.parse(saved.value));
});

billingRouter.get("/clients", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const clients = await prisma.billingClient.findMany({
    where: { archivedAt: null, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
    take: 200,
  });
  res.json(clients);
});

billingRouter.post("/clients", async (req, res) => {
  const input = clientSchema.parse(req.body);
  const client = await prisma.billingClient.create({ data: input });
  res.status(201).json(client);
});

billingRouter.put("/clients/:id", async (req, res) => {
  const input = clientSchema.parse(req.body);
  const exists = await prisma.billingClient.findUnique({ where: { id: req.params.id } });
  if (!exists || exists.archivedAt) throw new HttpError(404, "Client introuvable");
  res.json(await prisma.billingClient.update({ where: { id: req.params.id }, data: input }));
});

billingRouter.post("/clients/:id/archive", async (req, res) => {
  const exists = await prisma.billingClient.findUnique({ where: { id: req.params.id } });
  if (!exists) throw new HttpError(404, "Client introuvable");
  await prisma.billingClient.update({ where: { id: req.params.id }, data: { archivedAt: new Date() } });
  res.json({ ok: true });
});

billingRouter.get("/invoices", async (_req, res) => {
  const invoices = await prisma.billingInvoice.findMany({
    include: { client: true, lines: { orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  res.json(invoices);
});

billingRouter.post("/invoices", async (req, res) => {
  const input = invoiceSchema.parse(req.body);
  const client = await prisma.billingClient.findFirst({ where: { id: input.clientId, archivedAt: null } });
  if (!client) throw new HttpError(400, "Sélectionne un client actif");
  const totals = calculate(input.lines, input.currency);
  const invoice = await prisma.billingInvoice.create({
    data: {
      clientId: client.id, status: "draft",
      issueDate: dateOrNull(input.issueDate), serviceDate: dateOrNull(input.serviceDate),
      dueDate: dateOrNull(input.dueDate), currency: input.currency, notes: input.notes,
      subtotal: totals.subtotal, vatTotal: totals.vatTotal, total: totals.total,
      lines: { create: totals.lines },
    },
    include: { client: true, lines: { orderBy: { position: "asc" } } },
  });
  res.status(201).json(invoice);
});

billingRouter.get("/invoices/:id", async (req, res) => {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: req.params.id }, include: { client: true, lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) throw new HttpError(404, "Brouillon introuvable");
  res.json(invoice);
});

billingRouter.get("/invoices/:id/pdf", async (req, res) => {
  const invoice = await prisma.billingInvoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) throw new HttpError(404, "Brouillon introuvable");
  if (invoice.status !== "draft") throw new HttpError(409, "Le téléchargement PDF est réservé aux brouillons");
  const setting = await prisma.setting.findUnique({ where: { key: "billing.profile" } });
  const profile = setting ? JSON.parse(setting.value) : {};
  const pdf = generateDraftInvoicePdf(invoice, profile);
  const filename = `NJMDev-brouillon-${invoice.id.slice(-8).toUpperCase()}.pdf`;
  res.status(200)
    .set("Content-Type", "application/pdf")
    .set("Content-Disposition", `attachment; filename="${filename}"`)
    .set("Cache-Control", "private, no-store")
    .send(pdf);
});

billingRouter.put("/invoices/:id", async (req, res) => {
  const input = invoiceSchema.parse(req.body);
  const existing = await prisma.billingInvoice.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.status !== "draft") throw new HttpError(409, "Seuls les brouillons peuvent être modifiés");
  const client = await prisma.billingClient.findFirst({ where: { id: input.clientId, archivedAt: null } });
  if (!client) throw new HttpError(400, "Sélectionne un client actif");
  const totals = calculate(input.lines, input.currency);
  const invoice = await prisma.$transaction(async (tx) => {
    await tx.billingInvoiceLine.deleteMany({ where: { invoiceId: existing.id } });
    return tx.billingInvoice.update({
      where: { id: existing.id },
      data: {
        clientId: client.id, currency: input.currency, issueDate: dateOrNull(input.issueDate), serviceDate: dateOrNull(input.serviceDate),
        dueDate: dateOrNull(input.dueDate), notes: input.notes,
        subtotal: totals.subtotal, vatTotal: totals.vatTotal, total: totals.total,
        lines: { create: totals.lines },
      },
      include: { client: true, lines: { orderBy: { position: "asc" } } },
    });
  });
  res.json(invoice);
});

billingRouter.delete("/invoices/:id", async (req, res) => {
  const existing = await prisma.billingInvoice.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.status !== "draft") throw new HttpError(409, "Seuls les brouillons peuvent être supprimés");
  await prisma.billingInvoice.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
