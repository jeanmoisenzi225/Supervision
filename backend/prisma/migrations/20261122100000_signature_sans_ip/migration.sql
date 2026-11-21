-- L'adresse IP du signataire n'est plus collectée (v0.48.1)
ALTER TABLE "BillingSigner" DROP COLUMN "ip";
