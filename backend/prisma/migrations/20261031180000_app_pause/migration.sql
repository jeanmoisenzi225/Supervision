-- CreateTable
CREATE TABLE "AppPause" (
    "appKey" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "reason" TEXT,
    "by" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppPause_pkey" PRIMARY KEY ("appKey")
);
