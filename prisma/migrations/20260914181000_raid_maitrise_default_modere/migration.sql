-- Les risques déjà évalués (P et I) sans maîtrise n'apparaîtraient pas
-- dans la matrice. On pose « Modéré » (dispositif défini, partiel) par défaut.
UPDATE "Raid"
SET "niveau_maitrise" = 'Modéré'
WHERE "type" = 'Risque'
  AND "niveau_maitrise" = ''
  AND "probabilite" IS NOT NULL
  AND "impact" IS NOT NULL;
