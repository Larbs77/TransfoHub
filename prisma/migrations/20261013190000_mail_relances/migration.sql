-- AlterTable
ALTER TABLE "MailServerConfig" ADD COLUMN "relance_mail_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RelanceRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "chantierCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "RelanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelanceRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL DEFAULT '',
    "chantierCode" TEXT NOT NULL DEFAULT '',
    "chantierNom" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "recipients" TEXT NOT NULL DEFAULT '',
    "missingNames" TEXT NOT NULL DEFAULT '',
    "overdueCount" INTEGER NOT NULL DEFAULT 0,
    "weekCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelanceRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelanceDispatch" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelanceDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelanceRun_startedAt_idx" ON "RelanceRun"("startedAt");

-- CreateIndex
CREATE INDEX "RelanceRun_trigger_slotKey_reason_idx" ON "RelanceRun"("trigger", "slotKey", "reason");

-- One bookkeeping note per scheduled slot (disabled / empty / no SMTP).
CREATE UNIQUE INDEX "RelanceRun_planifie_note_key"
ON "RelanceRun" ("slotKey", "reason")
WHERE "trigger" = 'planifie' AND "reason" IN ('disabled', 'empty', 'no_config');

-- CreateIndex
CREATE INDEX "RelanceRunItem_runId_idx" ON "RelanceRunItem"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RelanceDispatch_chantierId_slotKey_key" ON "RelanceDispatch"("chantierId", "slotKey");

-- CreateIndex
CREATE INDEX "RelanceDispatch_slotKey_idx" ON "RelanceDispatch"("slotKey");

-- AddForeignKey
ALTER TABLE "RelanceRunItem" ADD CONSTRAINT "RelanceRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RelanceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
