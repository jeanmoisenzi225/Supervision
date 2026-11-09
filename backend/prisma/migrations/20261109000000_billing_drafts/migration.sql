CREATE TABLE "BillingClient" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'company',
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "billingAddress" TEXT,
  "postalCode" TEXT,
  "city" TEXT,
  "country" TEXT NOT NULL DEFAULT 'France',
  "siren" TEXT,
  "vatNumber" TEXT,
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingClient_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BillingInvoice" (
  "id" TEXT NOT NULL,
  "number" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "clientId" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3),
  "serviceDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "notes" TEXT,
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "vatTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "issuedAt" TIMESTAMP(3),
  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BillingInvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitPrice" DECIMAL(14,2) NOT NULL,
  "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "vatAmount" DECIMAL(14,2) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "BillingInvoiceLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingInvoice_number_key" ON "BillingInvoice"("number");
CREATE INDEX "BillingClient_name_idx" ON "BillingClient"("name");
CREATE INDEX "BillingClient_archivedAt_idx" ON "BillingClient"("archivedAt");
CREATE INDEX "BillingInvoice_status_createdAt_idx" ON "BillingInvoice"("status", "createdAt");
CREATE INDEX "BillingInvoice_clientId_createdAt_idx" ON "BillingInvoice"("clientId", "createdAt");
CREATE INDEX "BillingInvoiceLine_invoiceId_position_idx" ON "BillingInvoiceLine"("invoiceId", "position");
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "BillingClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
