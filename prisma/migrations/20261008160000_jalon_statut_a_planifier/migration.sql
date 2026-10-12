-- Default + backfill: Planifié without a due date is "A planifier".
ALTER TABLE "Jalon" ALTER COLUMN "statut" SET DEFAULT 'A planifier';
ALTER TABLE "Workstream" ALTER COLUMN "statut" SET DEFAULT 'A planifier';
ALTER TABLE "Activite" ALTER COLUMN "statut" SET DEFAULT 'A planifier';

UPDATE "Jalon"
SET "statut" = 'A planifier'
WHERE "statut" = 'Planifié' AND "date_cible" IS NULL;

UPDATE "Workstream"
SET "statut" = 'A planifier'
WHERE "statut" = 'Planifié' AND "date_fin" IS NULL;

UPDATE "Activite"
SET "statut" = 'A planifier'
WHERE "statut" = 'Planifié' AND "date_fin" IS NULL;
