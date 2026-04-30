-- CreateTable
CREATE TABLE "ProfilRessource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "type_ressource" TEXT NOT NULL,
    "tjm_defaut" REAL NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ressource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom_complet" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "organisation" TEXT NOT NULL DEFAULT '',
    "tarif_journalier" REAL NOT NULL DEFAULT 0,
    "capacite_jours_mois" INTEGER NOT NULL DEFAULT 20,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "profilId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ressource_profilId_fkey" FOREIGN KEY ("profilId") REFERENCES "ProfilRessource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ressource" ("actif", "capacite_jours_mois", "createdAt", "email", "id", "nom_complet", "organisation", "tarif_journalier", "telephone", "type", "updatedAt") SELECT "actif", "capacite_jours_mois", "createdAt", "email", "id", "nom_complet", "organisation", "tarif_journalier", "telephone", "type", "updatedAt" FROM "Ressource";
DROP TABLE "Ressource";
ALTER TABLE "new_Ressource" RENAME TO "Ressource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProfilRessource_type_ressource_idx" ON "ProfilRessource"("type_ressource");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilRessource_nom_type_ressource_key" ON "ProfilRessource"("nom", "type_ressource");
