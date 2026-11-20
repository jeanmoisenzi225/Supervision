-- Détail des composants et coûts d'un dossier de prestation (v0.45.0)
ALTER TABLE "BillingServiceDoc" ADD COLUMN "lines" JSONB NOT NULL DEFAULT '[]';
