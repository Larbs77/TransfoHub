-- CreateTable
CREATE TABLE "ComiteParametre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "short_label" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComiteParametre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComiteParametre_name_key" ON "ComiteParametre"("name");

-- CreateIndex
CREATE INDEX "ComiteParametre_position_idx" ON "ComiteParametre"("position");

-- CreateIndex
CREATE INDEX "ComiteParametre_is_active_idx" ON "ComiteParametre"("is_active");

-- Seed existing hardcoded committee instances (catalog used by /comites)
INSERT INTO "ComiteParametre" ("id", "name", "description", "frequency", "owner", "short_label", "color", "position", "is_active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Comité Programme', 'Instance de pilotage du programme de transformation bancaire', 'Bi-mensuel', 'Bureau Programme', 'Comité Programme', '#2563eb', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Comité Technologique restreint (CTR)', 'Comité technologique en formation restreinte pour arbitrages techniques', 'Hebdomadaire', 'Direction Technologie', 'CTR', '#059669', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Comité Technologique Plénier (CTP)', 'Comité technologique plénier pour décisions d''architecture et de capacité', 'Mensuel', 'Direction Technologie', 'CTP', '#0d9488', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Comité Assurance Qualité', 'Suivi de la qualité, des tests et des critères d''acceptation', 'Mensuel', 'Assurance Qualité', 'Comité Assurance Qualité', '#7c3aed', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Conseil', 'Instance de gouvernance stratégique et de validation exécutive', 'Trimestriel', 'Direction Générale', 'Conseil', '#dc2626', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Design Authority Board', 'Autorité de design pour les choix d''architecture applicative et data', 'Bi-mensuel', 'Architecture Entreprise', 'Design Authority Board', '#ea580c', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Kick-off', 'Séance de lancement d''un chantier ou d''un lot de transformation', 'Ad hoc', 'Bureau Programme', 'Kick-off', '#ca8a04', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
