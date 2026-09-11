-- Keep RAID deletion audit rows after the RAID is removed
ALTER TABLE "RaidAuditLog" ALTER COLUMN "raidId" DROP NOT NULL;

ALTER TABLE "RaidAuditLog" DROP CONSTRAINT IF EXISTS "RaidAuditLog_raidId_fkey";

ALTER TABLE "RaidAuditLog" ADD CONSTRAINT "RaidAuditLog_raidId_fkey"
  FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
