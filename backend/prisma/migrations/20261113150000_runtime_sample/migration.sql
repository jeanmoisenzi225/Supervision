-- CreateTable
CREATE TABLE "RuntimeSample" (
    "id" BIGSERIAL NOT NULL,
    "appKey" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3),
    "uptimeSec" INTEGER,
    "rssMb" INTEGER,
    "heapMb" INTEGER,
    "externalMb" INTEGER,
    "loopLagMaxMs" DOUBLE PRECISION,
    "imports" INTEGER,
    "jobs" INTEGER,
    "error" TEXT,

    CONSTRAINT "RuntimeSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RuntimeSample_appKey_at_idx" ON "RuntimeSample"("appKey", "at");

-- CreateIndex
CREATE INDEX "RuntimeSample_at_idx" ON "RuntimeSample"("at");
