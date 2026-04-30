-- CreateTable
CREATE TABLE "SaisieTemps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ressourceId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "date_lundi" DATETIME NOT NULL,
    "jours_travailles" REAL NOT NULL DEFAULT 0,
    "commentaire" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SaisieTemps_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaisieTemps_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MembreEquipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT NOT NULL,
    "equipe" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "nom_complet" TEXT NOT NULL,
    "is_directeur" BOOLEAN NOT NULL DEFAULT false,
    "charge_pourcentage" INTEGER NOT NULL DEFAULT 100,
    "ressourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembreEquipe_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembreEquipe_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MembreEquipe" ("chantierId", "createdAt", "equipe", "id", "is_directeur", "nom_complet", "ressourceId", "role", "updatedAt") SELECT "chantierId", "createdAt", "equipe", "id", "is_directeur", "nom_complet", "ressourceId", "role", "updatedAt" FROM "MembreEquipe";
DROP TABLE "MembreEquipe";
ALTER TABLE "new_MembreEquipe" RENAME TO "MembreEquipe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SaisieTemps_ressourceId_date_lundi_idx" ON "SaisieTemps"("ressourceId", "date_lundi");

-- CreateIndex
CREATE INDEX "SaisieTemps_chantierId_date_lundi_idx" ON "SaisieTemps"("chantierId", "date_lundi");

-- CreateIndex
CREATE UNIQUE INDEX "SaisieTemps_ressourceId_chantierId_date_lundi_key" ON "SaisieTemps"("ressourceId", "chantierId", "date_lundi");
