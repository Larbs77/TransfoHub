-- AlterTable
ALTER TABLE "Raid" ADD COLUMN IF NOT EXISTS "niveau_maitrise" TEXT NOT NULL DEFAULT '';

-- Recaler l'échelle 1–5 historique vers 1–3 (Faible / Moyen / Élevé).
UPDATE "Raid"
SET "probabilite" = CASE
  WHEN "probabilite" IS NULL THEN NULL
  WHEN "probabilite" <= 2 THEN 1
  WHEN "probabilite" = 3 THEN 2
  ELSE 3
END
WHERE "type" = 'Risque';

UPDATE "Raid"
SET "impact" = CASE
  WHEN "impact" IS NULL THEN NULL
  WHEN "impact" <= 2 THEN 1
  WHEN "impact" = 3 THEN 2
  ELSE 3
END
WHERE "type" = 'Risque';
