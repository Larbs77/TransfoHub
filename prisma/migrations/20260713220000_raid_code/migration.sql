-- CreateTable
CREATE TABLE "RaidCodeSequence" (
    "type" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RaidCodeSequence_pkey" PRIMARY KEY ("type")
);

-- AlterTable: add nullable first for backfill
ALTER TABLE "Raid" ADD COLUMN "code" TEXT;

-- Backfill codes by type, ordered by creation (A/R/I/D + 5 digits)
WITH numbered AS (
  SELECT
    id,
    type,
    ROW_NUMBER() OVER (PARTITION BY type ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Raid"
)
UPDATE "Raid" r
SET "code" = CASE r.type
  WHEN 'Action' THEN 'A_' || LPAD(n.rn::text, 5, '0')
  WHEN 'Risque' THEN 'R_' || LPAD(n.rn::text, 5, '0')
  WHEN 'Information' THEN 'I_' || LPAD(n.rn::text, 5, '0')
  WHEN 'Décision' THEN 'D_' || LPAD(n.rn::text, 5, '0')
  ELSE 'X_' || LPAD(n.rn::text, 5, '0')
END
FROM numbered n
WHERE r.id = n.id;

-- Sequence counters = max number allocated per type
INSERT INTO "RaidCodeSequence" ("type", "last")
SELECT type, COUNT(*)::int
FROM "Raid"
WHERE "code" IS NOT NULL
GROUP BY type
ON CONFLICT ("type") DO UPDATE SET "last" = EXCLUDED."last";

-- Enforce NOT NULL + unique
ALTER TABLE "Raid" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "Raid_code_key" ON "Raid"("code");
CREATE INDEX "Raid_code_idx" ON "Raid"("code");
