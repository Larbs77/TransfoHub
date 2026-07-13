-- MembreEquipe: require linked Ressource; replace free-text nom_complet with optional commentaires.

-- 1) Remove orphan team members not linked to a Ressource
DELETE FROM "MembreEquipe" WHERE "ressourceId" IS NULL;

-- 2) Optional comments field (identity lives on Ressource)
ALTER TABLE "MembreEquipe" ADD COLUMN "commentaires" TEXT NOT NULL DEFAULT '';

-- 3) Drop free-text name (source of truth is Ressource.nom_complet)
ALTER TABLE "MembreEquipe" DROP COLUMN "nom_complet";

-- 4) Make ressourceId mandatory
ALTER TABLE "MembreEquipe" ALTER COLUMN "ressourceId" SET NOT NULL;

-- 5) Indexes for lookups / capacity
CREATE INDEX "MembreEquipe_ressourceId_idx" ON "MembreEquipe"("ressourceId");
CREATE INDEX "MembreEquipe_chantierId_ressourceId_idx" ON "MembreEquipe"("chantierId", "ressourceId");
