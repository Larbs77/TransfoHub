-- RAID: échéance actualisée (mutable) + date de fin réelle (clôture)
ALTER TABLE "Raid"
  ADD COLUMN IF NOT EXISTS "date_echeance_actualisee" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "date_fin_reelle" TIMESTAMP(3);

-- Backfill: actualisée = initiale
UPDATE "Raid"
SET "date_echeance_actualisee" = "date_echeance"
WHERE "date_echeance_actualisee" IS NULL AND "date_echeance" IS NOT NULL;

-- Fin réelle si déjà clôturé / terminal
UPDATE "Raid"
SET "date_fin_reelle" = COALESCE("date_fin_reelle", "updatedAt")
WHERE "date_fin_reelle" IS NULL
  AND "statut" IN (
    'Clôturé',
    'Clos',
    'Abandonné',
    'NA',
    'Doublon',
    'Validée',
    'Refusée',
    'Matérialisé'
  );

CREATE INDEX IF NOT EXISTS "Raid_date_echeance_actualisee_idx"
  ON "Raid"("date_echeance_actualisee");
