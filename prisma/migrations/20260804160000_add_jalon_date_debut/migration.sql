ALTER TABLE "Jalon" ADD COLUMN "date_debut" TIMESTAMP(3);

WITH planning_dates AS (
  SELECT ws."jalonId", ws."date_debut" AS value
  FROM "Workstream" ws
  WHERE ws."date_debut" IS NOT NULL
  UNION ALL
  SELECT ws."jalonId", a."date_debut" AS value
  FROM "Activite" a
  JOIN "Workstream" ws ON ws.id = a."workstreamId"
  WHERE a."date_debut" IS NOT NULL
), bounds AS (
  SELECT "jalonId", MIN(value) AS min_date
  FROM planning_dates
  GROUP BY "jalonId"
)
UPDATE "Jalon" AS j
SET "date_debut" = bounds.min_date
FROM bounds
WHERE j.id = bounds."jalonId";
