-- CreateTable
CREATE TABLE "ResourceSample" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ResourceSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceSample_key_at_idx" ON "ResourceSample"("key", "at");
