-- RAID collaboration: team assignment, comments, audit trail

-- AlterTable Raid
ALTER TABLE "Raid" ADD COLUMN "equipeId" TEXT;
ALTER TABLE "Raid" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Raid" ADD COLUMN "createdByName" TEXT NOT NULL DEFAULT '';

-- CreateTable RaidComment
CREATE TABLE "RaidComment" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL DEFAULT '',
    "authorRessourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable RaidAuditLog
CREATE TABLE "RaidAuditLog" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT '',
    "oldValue" TEXT NOT NULL DEFAULT '',
    "newValue" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL DEFAULT '',
    "actorRessourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Raid_responsableRessourceId_idx" ON "Raid"("responsableRessourceId");
CREATE INDEX "Raid_equipeId_idx" ON "Raid"("equipeId");
CREATE INDEX "Raid_chantierId_idx" ON "Raid"("chantierId");
CREATE INDEX "RaidComment_raidId_createdAt_idx" ON "RaidComment"("raidId", "createdAt");
CREATE INDEX "RaidAuditLog_raidId_createdAt_idx" ON "RaidAuditLog"("raidId", "createdAt");

-- ForeignKeys
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RaidComment" ADD CONSTRAINT "RaidComment_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidAuditLog" ADD CONSTRAINT "RaidAuditLog_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill equipeId from assignee hierarchical team where possible
UPDATE "Raid" r
SET "equipeId" = res."equipeHierarchieId"
FROM "Ressource" res
WHERE r."responsableRessourceId" = res."id"
  AND r."equipeId" IS NULL
  AND res."equipeHierarchieId" IS NOT NULL;

-- Seed audit "created" from existing rows (circulation baseline)
INSERT INTO "RaidAuditLog" ("id", "raidId", "action", "field", "oldValue", "newValue", "summary", "actorUserId", "actorName", "actorRessourceId", "createdAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  'created',
  '',
  '',
  r."statut",
  'Entrée créée — statut « ' || COALESCE(NULLIF(r."statut", ''), '—') || ' »',
  NULL,
  COALESCE(NULLIF(r."createdByName", ''), 'Système'),
  r."responsableRessourceId",
  r."createdAt"
FROM "Raid" r;
