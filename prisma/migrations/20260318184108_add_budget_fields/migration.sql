-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chantier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "domaine" TEXT NOT NULL,
    "type_chantier" TEXT NOT NULL DEFAULT '',
    "priorite" TEXT NOT NULL DEFAULT '',
    "duree_mois" INTEGER NOT NULL DEFAULT 0,
    "budget" REAL NOT NULL DEFAULT 0,
    "budgetJH" REAL NOT NULL DEFAULT 0,
    "budgetProjetMAD" REAL NOT NULL DEFAULT 0,
    "conseilEditeursMAD" REAL NOT NULL DEFAULT 0,
    "licencesAchatsMAD" REAL NOT NULL DEFAULT 0,
    "licencesAbonnementsMAD" REAL NOT NULL DEFAULT 0,
    "coutsInfrasMAD" REAL NOT NULL DEFAULT 0,
    "budgetTotalMAD" REAL NOT NULL DEFAULT 0,
    "directeur" TEXT NOT NULL DEFAULT '',
    "pmo" TEXT NOT NULL DEFAULT '',
    "date_debut" DATETIME NOT NULL,
    "date_fin" DATETIME NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Non démarré',
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Chantier" ("avancement", "budget", "code", "createdAt", "date_debut", "date_fin", "description", "directeur", "domaine", "duree_mois", "id", "nom", "pmo", "priorite", "statut", "type_chantier", "updatedAt") SELECT "avancement", "budget", "code", "createdAt", "date_debut", "date_fin", "description", "directeur", "domaine", "duree_mois", "id", "nom", "pmo", "priorite", "statut", "type_chantier", "updatedAt" FROM "Chantier";
DROP TABLE "Chantier";
ALTER TABLE "new_Chantier" RENAME TO "Chantier";
CREATE UNIQUE INDEX "Chantier_code_key" ON "Chantier"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
