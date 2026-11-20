-- Dossiers de prestation (demande de règlement + convention), v0.42.0
CREATE TABLE "BillingServiceDoc" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "appName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "technologies" TEXT NOT NULL DEFAULT '',
    "workNature" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT '',
    "deliveryState" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentTerms" TEXT NOT NULL DEFAULT '',
    "paymentDue" TEXT NOT NULL DEFAULT '',
    "paymentCoordinates" TEXT NOT NULL DEFAULT '',
    "clientLegalForm" TEXT NOT NULL DEFAULT '',
    "clientRepresentative" TEXT NOT NULL DEFAULT '',
    "clientRole" TEXT NOT NULL DEFAULT '',
    "place" TEXT NOT NULL DEFAULT '',
    "emissionDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingServiceDoc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BillingServiceDoc_clientId_idx" ON "BillingServiceDoc"("clientId");
ALTER TABLE "BillingServiceDoc" ADD CONSTRAINT "BillingServiceDoc_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "BillingClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
