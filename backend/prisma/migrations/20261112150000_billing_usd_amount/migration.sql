-- Montant en dollars des lignes importées des coûts (v0.23.0) : recalcul automatique quand le taux change.
ALTER TABLE "BillingInvoiceLine" ADD COLUMN "usdAmount" DECIMAL(14,4);
