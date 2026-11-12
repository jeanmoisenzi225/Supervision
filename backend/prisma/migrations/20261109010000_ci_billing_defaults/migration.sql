ALTER TABLE "BillingClient" ALTER COLUMN "country" SET DEFAULT 'Côte d’Ivoire';
ALTER TABLE "BillingClient" ADD COLUMN "rccm" TEXT;
ALTER TABLE "BillingClient" ADD COLUMN "ncc" TEXT;
ALTER TABLE "BillingInvoice" ALTER COLUMN "currency" SET DEFAULT 'XOF';
ALTER TABLE "BillingInvoiceLine" ALTER COLUMN "vatRate" SET DEFAULT 0;
