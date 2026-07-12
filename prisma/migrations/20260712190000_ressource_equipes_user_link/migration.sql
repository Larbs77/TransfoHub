-- AlterTable: hierarchical team on Ressource
ALTER TABLE "Ressource" ADD COLUMN "equipeHierarchieId" TEXT;

-- CreateTable: functional multi-team membership
CREATE TABLE "RessourceEquipeFonctionnelle" (
    "id" TEXT NOT NULL,
    "ressourceId" TEXT NOT NULL,
    "equipeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RessourceEquipeFonctionnelle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ressource_equipeHierarchieId_idx" ON "Ressource"("equipeHierarchieId");

-- CreateIndex
CREATE INDEX "RessourceEquipeFonctionnelle_equipeId_idx" ON "RessourceEquipeFonctionnelle"("equipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RessourceEquipeFonctionnelle_ressourceId_equipeId_key" ON "RessourceEquipeFonctionnelle"("ressourceId", "equipeId");

-- Backfill hierarchical team: first active Equipe by position (or any equipe)
UPDATE "Ressource" r
SET "equipeHierarchieId" = e.id
FROM (
  SELECT id FROM "Equipe" ORDER BY "position" ASC, "name" ASC LIMIT 1
) e
WHERE r."equipeHierarchieId" IS NULL
  AND EXISTS (SELECT 1 FROM "Equipe");

-- AddForeignKey
ALTER TABLE "Ressource" ADD CONSTRAINT "Ressource_equipeHierarchieId_fkey" FOREIGN KEY ("equipeHierarchieId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RessourceEquipeFonctionnelle" ADD CONSTRAINT "RessourceEquipeFonctionnelle_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RessourceEquipeFonctionnelle" ADD CONSTRAINT "RessourceEquipeFonctionnelle_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
