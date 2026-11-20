import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAdmin } from "../../middleware/auth";
import { asyncRouter } from "../../utils/asyncRouter";
import { HttpError } from "../../utils/httpError";
import { getHostingCosts } from "../hosting/hosting.service";
import { forecastLines } from "./forecast";
import { isAbsurdRate, usdRate, type FxMode } from "./fx";
import { generateDraftInvoicePdf } from "./invoice-pdf";
import { buildServiceDocs, DOC_FILENAMES, type DocKind, type ServiceDocData } from "./service-docs.content";
import { renderServiceDocDocx } from "./service-docs.docx";
import { renderServiceDocPdf } from "./service-docs.pdf";

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
  appKeys: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(20).default([]),
});

const lineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(1000000),
  unitPrice: z.coerce.number().min(0).max(100000000),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(0),
  source: z.enum(["hosting", "claude", "free"]).nullish(),
  usd: z.coerce.number().min(0).max(100000000).nullish(),
});

const invoiceSchema = z.object({
  clientId: z.string().min(1),
  currency: z.enum(["XOF", "EUR", "USD"]).default("XOF"),
  kind: z.enum(["forecast", "draft"]).default("forecast"),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullish(),
  usdRate: z.coerce.number().positive().max(1000000).nullish(),
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
  legalForm: z.enum(["entreprise_individuelle", "personne_physique"]).optional(),
  businessAddress: z.string().max(500).optional(),
  rccm: z.string().max(60).optional(),
  ncc: z.string().max(40).optional(),
  taxRegime: z.string().max(100).optional(),
  vatRegime: z.string().max(100).optional(),
  defaultCurrency: z.enum(["XOF", "EUR", "USD"]).default("XOF"),
  /** Conversion des coûts (dollars) : taux de marché de la BCE (défaut) ou parité commerciale 1 $ = 1 €. */
  fxMode: z.enum(["parity", "market"]).default("market"),
});

/** Règle de conversion des coûts : taux de marché par défaut (décision du propriétaire du 2026-11-12, après un essai de parité commerciale 1 $ = 1 €). */
async function fxMode(): Promise<FxMode> {
  const row = await prisma.setting.findUnique({ where: { key: "billing.profile" } });
  const mode = row ? (JSON.parse(row.value) as { fxMode?: string }).fxMode : undefined;
  return mode === "parity" ? "parity" : "market";
}

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
      vatRate: new Prisma.Decimal(line.vatRate), source: line.source ?? null, usdAmount: line.usd == null ? null : new Prisma.Decimal(line.usd), subtotal, vatAmount,
      total: subtotal.plus(vatAmount).toDecimalPlaces(precision),
    };
  });
  const subtotal = calculated.reduce((sum, line) => sum.plus(line.subtotal), new Prisma.Decimal(0)).toDecimalPlaces(precision);
  const vatTotal = calculated.reduce((sum, line) => sum.plus(line.vatAmount), new Prisma.Decimal(0)).toDecimalPlaces(precision);
  return { lines: calculated, subtotal, vatTotal, total: subtotal.plus(vatTotal).toDecimalPlaces(precision) };
}

billingRouter.get("/profile", async (_req, res) => {
  const row = await prisma.setting.findUnique({ where: { key: "billing.profile" } });
  res.json(row ? { fxMode: "market", ...JSON.parse(row.value) } : { brandName: "NJMDev", contactEmail: "", phone: "", website: "", paymentDetails: "", country: "Côte d’Ivoire", defaultCurrency: "XOF", fxMode: "market", legalProfileComplete: false });
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
      dueDate: dateOrNull(input.dueDate), currency: input.currency, kind: input.kind, period: input.period ?? null, usdRate: input.usdRate ?? null, notes: input.notes,
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
  const filename = `NJMDev-${invoice.kind === "forecast" ? "previsionnelle" : "brouillon"}-${invoice.id.slice(-8).toUpperCase()}.pdf`;
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
        clientId: client.id, currency: input.currency, kind: input.kind, period: input.period ?? null, usdRate: input.usdRate ?? null, issueDate: dateOrNull(input.issueDate), serviceDate: dateOrNull(input.serviceDate),
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

const forecastSchema = z.object({
  clientId: z.string().min(1).optional(),
  appKeys: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(20).optional(),
  currency: z.enum(["XOF", "EUR", "USD"]).default("XOF"),
  usdRate: z.coerce.number().positive().max(1000000).optional(),
  /** Date du document (AAAA-MM-JJ) : taux de ce jour quand le taux n'est pas saisi. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  includeClaude: z.boolean().default(true),
});

/** Lignes d'une facture prévisionnelle : coûts d'hébergement et Claude des applis du client, tels que la page « Coûts » les calcule. */
billingRouter.post("/forecast-lines", async (req, res) => {
  const input = forecastSchema.parse(req.body);
  let appKeys = input.appKeys;
  if (!appKeys && input.clientId) {
    const client = await prisma.billingClient.findFirst({ where: { id: input.clientId, archivedAt: null } });
    if (!client) throw new HttpError(400, "Sélectionne un client actif");
    appKeys = client.appKeys;
  }
  if (!appKeys?.length) throw new HttpError(400, "Aucune appli n'est rattachée à ce client : coche-les dans sa fiche (onglet Clients).");
  // Taux : saisi, sinon repris automatiquement (BCE) ; un taux saisi très éloigné du marché est refusé (erreur d'unité).
  let rate = input.usdRate ?? 1;
  let rateInfo = input.currency === "USD" ? "dollars, sans conversion" : "saisi";
  if (input.currency !== "USD") {
    const ref = await usdRate(input.currency, input.date, await fxMode()).catch(() => null);
    if (!input.usdRate) {
      if (!ref) throw new HttpError(502, "Taux de change indisponible : saisis le taux (1 dollar = combien dans la devise du document).");
      rate = ref.rate;
      rateInfo = ref.date ? `${ref.source}, ${ref.date}` : ref.source;
    } else if (ref && isAbsurdRate(input.usdRate, ref.rate)) {
      throw new HttpError(400, `Le taux saisi (${input.usdRate}) est très éloigné du taux du marché (${ref.rate}) : vérifie l'unité (1 dollar = combien de ${input.currency === "XOF" ? "FCFA" : "euros"}).`);
    }
  }
  const costs = await getHostingCosts();
  if (!costs.renderConfigured) throw new HttpError(400, "Clé API Render non configurée : les coûts d'hébergement ne sont pas disponibles.");
  const apps = costs.apps.filter((a) => appKeys!.includes(a.key));
  const result = forecastLines(apps, input.currency, rate, input.includeClaude);
  res.json({ ...result, rate, rateInfo, apps: apps.map((a) => a.name), missingApps: appKeys.filter((k) => !apps.some((a) => a.key === k)), pricesAsOf: costs.pricesAsOf });
});

/** Taux de change du jour (ou de la date du document) : dollars → devise, repris de la BCE. */
billingRouter.get("/fx", async (req, res) => {
  const currency = z.enum(["XOF", "EUR", "USD"]).parse(req.query.currency);
  const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : null;
  try {
    res.json({ ...(await usdRate(currency, date, await fxMode())), mode: await fxMode() });
  } catch (err) {
    throw new HttpError(502, (err as Error).message);
  }
});

// ---------- Dossiers de prestation (v0.42.0) : demande de règlement + convention de constatation des travaux ----------

const text = (max: number) => z.string().trim().max(max).default("");
const serviceDocSchema = z.object({
  clientId: z.string().min(1),
  reference: text(60), appName: z.string().trim().min(1).max(180), description: text(4000),
  features: z.array(z.string().trim().max(300)).max(60).default([]),
  technologies: text(500), workNature: text(2000), period: text(200), deliveryState: text(300), location: text(300),
  amount: z.coerce.number().min(0).max(1e12).nullish(), currency: z.enum(["EUR", "XOF"]).default("EUR"),
  paymentTerms: text(300), paymentDue: text(300), paymentCoordinates: text(1000),
  clientLegalForm: text(120), clientRepresentative: text(180), clientRole: text(120), place: text(120),
  emissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal("")),
});

billingRouter.get("/service-docs", async (_req, res) => {
  res.json(await prisma.billingServiceDoc.findMany({ include: { client: true }, orderBy: { updatedAt: "desc" }, take: 200 }));
});

function serviceDocData(row: Awaited<ReturnType<typeof prisma.billingServiceDoc.findFirstOrThrow>> & { client: { name: string; billingAddress: string | null; postalCode: string | null; city: string | null; country: string; rccm: string | null; ncc: string | null; email: string | null; phone: string | null } }, profile: Record<string, string | undefined>): ServiceDocData {
  const c = row.client;
  return {
    appName: row.appName, description: row.description, features: row.features, technologies: row.technologies, workNature: row.workNature,
    period: row.period, deliveryState: row.deliveryState, location: row.location,
    amount: row.amount == null ? null : Number(row.amount), currency: row.currency === "XOF" ? "XOF" : "EUR",
    paymentTerms: row.paymentTerms, paymentDue: row.paymentDue, paymentCoordinates: row.paymentCoordinates || profile.paymentDetails || "",
    clientLegalForm: row.clientLegalForm, clientRepresentative: row.clientRepresentative, clientRole: row.clientRole, place: row.place,
    reference: row.reference, emissionDate: row.emissionDate,
    provider: { name: profile.legalName ?? "", address: profile.businessAddress ?? "", email: profile.contactEmail ?? "", phone: profile.phone ?? "", brand: profile.brandName || "NJMDev" },
    client: { name: c.name, address: [c.billingAddress, [c.postalCode, c.city].filter(Boolean).join(" "), c.country].filter(Boolean).join(", "), rccm: c.rccm ?? "", ncc: c.ncc ?? "", email: c.email ?? "", phone: c.phone ?? "" },
  };
}

function serviceDocPayload(input: z.infer<typeof serviceDocSchema>) {
  const { emissionDate, amount, ...rest } = input;
  return { ...rest, amount: amount == null ? null : new Prisma.Decimal(amount), emissionDate: emissionDate || null };
}

billingRouter.post("/service-docs", async (req, res) => {
  const input = serviceDocSchema.parse(req.body);
  if (!(await prisma.billingClient.findFirst({ where: { id: input.clientId, archivedAt: null } }))) throw new HttpError(400, "Sélectionne un client actif");
  res.status(201).json(await prisma.billingServiceDoc.create({ data: serviceDocPayload(input), include: { client: true } }));
});

billingRouter.put("/service-docs/:id", async (req, res) => {
  const input = serviceDocSchema.parse(req.body);
  if (!(await prisma.billingServiceDoc.findUnique({ where: { id: req.params.id } }))) throw new HttpError(404, "Dossier introuvable");
  if (!(await prisma.billingClient.findFirst({ where: { id: input.clientId, archivedAt: null } }))) throw new HttpError(400, "Sélectionne un client actif");
  res.json(await prisma.billingServiceDoc.update({ where: { id: req.params.id }, data: serviceDocPayload(input), include: { client: true } }));
});

billingRouter.delete("/service-docs/:id", async (req, res) => {
  if (!(await prisma.billingServiceDoc.findUnique({ where: { id: req.params.id } }))) throw new HttpError(404, "Dossier introuvable");
  await prisma.billingServiceDoc.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/** Télécharge un des deux documents du dossier, en PDF ou en Word modifiable ; généré à la demande, jamais conservé. */
billingRouter.get("/service-docs/:id/:kind.:format", async (req, res) => {
  const kind = z.enum(["demande", "convention"]).parse(req.params.kind) as DocKind;
  const format = z.enum(["pdf", "docx"]).parse(req.params.format);
  const row = await prisma.billingServiceDoc.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!row) throw new HttpError(404, "Dossier introuvable");
  const setting = await prisma.setting.findUnique({ where: { key: "billing.profile" } });
  const profile = setting ? (JSON.parse(setting.value) as Record<string, string | undefined>) : {};
  const docs = buildServiceDocs(serviceDocData(row, profile));
  const { blocks, header } = docs[kind];
  const body = format === "pdf" ? await renderServiceDocPdf(blocks, header, docs.brand) : await renderServiceDocDocx(blocks, header, docs.brand);
  res.status(200)
    .set("Content-Type", format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    .set("Content-Disposition", `attachment; filename="${DOC_FILENAMES[kind]}.${format}"`)
    .set("Cache-Control", "private, no-store")
    .send(body);
});
