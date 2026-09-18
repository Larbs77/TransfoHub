-- CreateTable
CREATE TABLE IF NOT EXISTS "AdherenceDependant" (
    "id" TEXT NOT NULL,
    "adherenceId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,

    CONSTRAINT "AdherenceDependant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdherenceDependant_adherenceId_chantierId_key"
  ON "AdherenceDependant"("adherenceId", "chantierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdherenceDependant_chantierId_idx"
  ON "AdherenceDependant"("chantierId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdherenceDependant_adherenceId_fkey'
  ) THEN
    ALTER TABLE "AdherenceDependant"
      ADD CONSTRAINT "AdherenceDependant_adherenceId_fkey"
      FOREIGN KEY ("adherenceId") REFERENCES "Adherence"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdherenceDependant_chantierId_fkey'
  ) THEN
    ALTER TABLE "AdherenceDependant"
      ADD CONSTRAINT "AdherenceDependant_chantierId_fkey"
      FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Reprise des liens 1–1 existants
INSERT INTO "AdherenceDependant" ("id", "adherenceId", "chantierId")
SELECT gen_random_uuid()::text, "id", "chantierDependantId"
FROM "Adherence"
WHERE "chantierDependantId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AdherenceDependant" d
    WHERE d."adherenceId" = "Adherence"."id"
      AND d."chantierId" = "Adherence"."chantierDependantId"
  );

-- Drop legacy FK / index / column
ALTER TABLE "Adherence" DROP CONSTRAINT IF EXISTS "Adherence_chantierDependantId_fkey";
DROP INDEX IF EXISTS "Adherence_chantierDependantId_idx";
ALTER TABLE "Adherence" DROP COLUMN IF EXISTS "chantierDependantId";
