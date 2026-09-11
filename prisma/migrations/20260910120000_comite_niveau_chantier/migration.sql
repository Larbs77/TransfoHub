-- AlterTable ComiteParametre: gouvernance | operationnel
ALTER TABLE "ComiteParametre" ADD COLUMN "niveau" TEXT NOT NULL DEFAULT 'gouvernance';

CREATE INDEX "ComiteParametre_niveau_idx" ON "ComiteParametre"("niveau");

-- Existing Weekly (and similar) types become operational
UPDATE "ComiteParametre"
SET "niveau" = 'operationnel',
    "owner" = 'Équipe chantier',
    "equipeId" = NULL
WHERE lower("name") LIKE '%weekly%'
   OR lower("name") LIKE '%cosuivi%'
   OR lower("name") LIKE '%copil chantier%';

-- AlterTable Comite: optional chantier for operational séances
ALTER TABLE "Comite" ADD COLUMN "chantierId" TEXT;

ALTER TABLE "Comite" ADD CONSTRAINT "Comite_chantierId_fkey"
  FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Comite_chantierId_idx" ON "Comite"("chantierId");
CREATE INDEX "Comite_instance_chantierId_idx" ON "Comite"("instance", "chantierId");

-- Gouvernance: unique numero per instance (no chantier)
CREATE UNIQUE INDEX "Comite_instance_numero_gouvernance_key"
  ON "Comite"("instance", "numero")
  WHERE "chantierId" IS NULL;

-- Opérationnel: unique numero per instance + chantier
CREATE UNIQUE INDEX "Comite_instance_chantier_numero_key"
  ON "Comite"("instance", "chantierId", "numero")
  WHERE "chantierId" IS NOT NULL;
