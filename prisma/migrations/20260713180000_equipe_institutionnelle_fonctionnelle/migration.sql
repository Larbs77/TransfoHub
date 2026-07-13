-- Equipe types: institutionnelle (bank) vs fonctionnelle (chantier programme team)

-- 1) Columns
ALTER TABLE "Equipe" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'institutionnelle';
ALTER TABLE "Equipe" ADD COLUMN "chantierId" TEXT;

-- 2) Existing rows stay institutional
UPDATE "Equipe" SET "type" = 'institutionnelle' WHERE "type" IS NULL OR "type" = '';

-- 3) Unique + indexes
CREATE UNIQUE INDEX "Equipe_chantierId_key" ON "Equipe"("chantierId");
CREATE INDEX "Equipe_type_idx" ON "Equipe"("type");

-- 4) FK to Chantier (cascade delete functional team with chantier)
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_chantierId_fkey"
  FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Create functional team for every existing chantier
INSERT INTO "Equipe" ("id", "name", "description", "position", "is_active", "type", "chantierId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  LEFT(
    CASE
      WHEN LENGTH(TRIM(c."nom")) > 0 THEN 'Équipe ' || c."code" || ' — ' || c."nom"
      ELSE 'Équipe ' || c."code"
    END,
    120
  ),
  'Équipe fonctionnelle (programme) du chantier ' || c."code" || ' — ' || COALESCE(NULLIF(TRIM(c."nom"), ''), 'sans nom') || '.',
  0,
  true,
  'fonctionnelle',
  c."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Chantier" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Equipe" e WHERE e."chantierId" = c."id"
);

-- Disambiguate rare name collisions on functional teams
UPDATE "Equipe" e
SET "name" = LEFT(e."name" || ' · ' || LEFT(e."id", 8), 120)
WHERE e."type" = 'fonctionnelle'
  AND EXISTS (
    SELECT 1 FROM "Equipe" o
    WHERE o."name" = e."name" AND o."id" <> e."id"
  );

-- 6) Sync functional membership from MembreEquipe
INSERT INTO "RessourceEquipeFonctionnelle" ("id", "ressourceId", "equipeId", "createdAt")
SELECT
  gen_random_uuid()::text,
  m."ressourceId",
  e."id",
  CURRENT_TIMESTAMP
FROM "MembreEquipe" m
JOIN "Equipe" e ON e."chantierId" = m."chantierId" AND e."type" = 'fonctionnelle'
WHERE m."ressourceId" IS NOT NULL
ON CONFLICT ("ressourceId", "equipeId") DO NOTHING;

-- 7) Recompute Raid.equipeId:
--    a) Assignee on RAID chantier → functional team
UPDATE "Raid" r
SET "equipeId" = e."id"
FROM "Equipe" e
WHERE r."chantierId" IS NOT NULL
  AND r."responsableRessourceId" IS NOT NULL
  AND e."chantierId" = r."chantierId"
  AND e."type" = 'fonctionnelle'
  AND EXISTS (
    SELECT 1 FROM "MembreEquipe" m
    WHERE m."chantierId" = r."chantierId"
      AND m."ressourceId" = r."responsableRessourceId"
  );

--    b) Otherwise hierarchy (institutionnelle) of assignee
UPDATE "Raid" r
SET "equipeId" = res."equipeHierarchieId"
FROM "Ressource" res
WHERE r."responsableRessourceId" = res."id"
  AND res."equipeHierarchieId" IS NOT NULL
  AND (
    r."chantierId" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "MembreEquipe" m
      WHERE m."chantierId" = r."chantierId"
        AND m."ressourceId" = r."responsableRessourceId"
    )
  );
