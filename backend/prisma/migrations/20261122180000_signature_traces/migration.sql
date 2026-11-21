-- Traces techniques de la signature, conservées en base et jamais affichées (v0.48.2)
ALTER TABLE "BillingSigner" ADD COLUMN "ip" TEXT, ADD COLUMN "userAgent" TEXT;
