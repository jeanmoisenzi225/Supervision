-- Facture prévisionnelle (v0.19.0) : applis facturées à un client, nature et mois du document, origine des lignes.
ALTER TABLE "BillingClient" ADD COLUMN "appKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BillingInvoice" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'forecast',
ADD COLUMN "period" TEXT,
ADD COLUMN "usdRate" DECIMAL(14,6);
ALTER TABLE "BillingInvoiceLine" ADD COLUMN "source" TEXT;
