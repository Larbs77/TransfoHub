-- Q&A: échéance actualisée (mutable) + date de fin réelle (clôture)
ALTER TABLE "ConsultationQuestion"
  ADD COLUMN IF NOT EXISTS "echeance_actualisee" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "date_fin_reelle" TIMESTAMP(3);

-- Backfill: actualisée = initiale ; fin réelle si déjà clôturée
UPDATE "ConsultationQuestion"
SET "echeance_actualisee" = "echeance"
WHERE "echeance_actualisee" IS NULL AND "echeance" IS NOT NULL;

UPDATE "ConsultationQuestion"
SET "date_fin_reelle" = COALESCE("date_fin_reelle", "updatedAt")
WHERE "date_fin_reelle" IS NULL
  AND "statut" IN ('Résolue', 'Abandonnée');

CREATE INDEX IF NOT EXISTS "ConsultationQuestion_echeance_actualisee_idx"
  ON "ConsultationQuestion"("echeance_actualisee");
