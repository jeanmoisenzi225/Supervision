-- CreateTable
CREATE TABLE "BacklogItem" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "number" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "versions" TEXT[],
    "grp" TEXT,
    "priority" TEXT,
    "subtasks" JSONB NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "BacklogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacklogEvent" (
    "id" BIGSERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacklogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BacklogItem_source_key_key" ON "BacklogItem"("source", "key");

-- CreateIndex
CREATE INDEX "BacklogEvent_source_at_idx" ON "BacklogEvent"("source", "at");

