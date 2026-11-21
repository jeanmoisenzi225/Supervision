-- Emplacement des cadres de signature, pour y poser la signature électronique (v0.49.1)
ALTER TABLE "BillingSignRequest" ADD COLUMN "boxes" JSONB NOT NULL DEFAULT '[]';
