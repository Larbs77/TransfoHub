-- CreateTable
CREATE TABLE "Equipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipe_name_key" ON "Equipe"("name");

-- CreateIndex
CREATE INDEX "Equipe_position_idx" ON "Equipe"("position");

-- CreateIndex
CREATE INDEX "Equipe_is_active_idx" ON "Equipe"("is_active");

-- Seed teams from existing ComiteParametre.owner values
INSERT INTO "Equipe" ("id", "name", "description", "position", "is_active", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  t.owner_name,
  '',
  (ROW_NUMBER() OVER (ORDER BY t.min_pos, t.owner_name) - 1)::int,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT TRIM(owner) AS owner_name, MIN("position") AS min_pos
  FROM "ComiteParametre"
  WHERE TRIM(owner) <> ''
  GROUP BY TRIM(owner)
) t;

-- Fallback seed if ComiteParametre was empty (canonical catalog)
INSERT INTO "Equipe" ("id", "name", "description", "position", "is_active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.name, v.description, v.position, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('Bureau Programme', 'Bureau du programme de transformation', 0),
  ('Direction Technologie', 'Direction des technologies et SI', 1),
  ('Assurance Qualité', 'Équipe assurance qualité', 2),
  ('Direction Générale', 'Direction générale', 3),
  ('Architecture Entreprise', 'Architecture d''entreprise', 4)
) AS v(name, description, position)
WHERE NOT EXISTS (SELECT 1 FROM "Equipe" e WHERE e.name = v.name);

-- AlterTable
ALTER TABLE "ComiteParametre" ADD COLUMN "equipeId" TEXT;

-- Link existing committee types to teams by owner name
UPDATE "ComiteParametre" cp
SET "equipeId" = e.id
FROM "Equipe" e
WHERE TRIM(cp.owner) = e.name
  AND TRIM(cp.owner) <> '';

-- CreateIndex
CREATE INDEX "ComiteParametre_equipeId_idx" ON "ComiteParametre"("equipeId");

-- AddForeignKey
ALTER TABLE "ComiteParametre" ADD CONSTRAINT "ComiteParametre_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
