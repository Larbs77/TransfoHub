-- AlterTable
ALTER TABLE "Raid" ADD COLUMN IF NOT EXISTS "risqueLieId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Raid_risqueLieId_idx" ON "Raid"("risqueLieId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Raid_risqueLieId_fkey'
  ) THEN
    ALTER TABLE "Raid"
      ADD CONSTRAINT "Raid_risqueLieId_fkey"
      FOREIGN KEY ("risqueLieId") REFERENCES "Raid"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
