-- Signature électronique simple des documents de prestation (v0.48.0)
CREATE TABLE "BillingSignRequest" (
    "id" TEXT NOT NULL,
    "serviceDocId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pdf" BYTEA NOT NULL,
    "pdfSha256" TEXT NOT NULL,
    "signedPdf" BYTEA,
    "signedSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "BillingSignRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BillingSigner" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "typedName" TEXT,
    "signature" BYTEA,
    CONSTRAINT "BillingSigner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BillingSignRequest_serviceDocId_idx" ON "BillingSignRequest"("serviceDocId");
CREATE UNIQUE INDEX "BillingSigner_tokenHash_key" ON "BillingSigner"("tokenHash");
CREATE INDEX "BillingSigner_requestId_idx" ON "BillingSigner"("requestId");
ALTER TABLE "BillingSignRequest" ADD CONSTRAINT "BillingSignRequest_serviceDocId_fkey" FOREIGN KEY ("serviceDocId") REFERENCES "BillingServiceDoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingSigner" ADD CONSTRAINT "BillingSigner_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BillingSignRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
