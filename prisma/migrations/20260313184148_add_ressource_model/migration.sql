-- CreateTable
CREATE TABLE "Ressource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom_complet" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "organisation" TEXT NOT NULL DEFAULT '',
    "tarif_journalier" REAL NOT NULL DEFAULT 0,
    "capacite_jours_mois" INTEGER NOT NULL DEFAULT 20,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "ressourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembreEquipe_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembreEquipe_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MembreEquipe" ("chantierId", "createdAt", "equipe", "id", "is_directeur", "nom_complet", "role", "updatedAt") SELECT "chantierId", "createdAt", "equipe", "id", "is_directeur", "nom_complet", "role", "updatedAt" FROM "MembreEquipe";
DROP TABLE "MembreEquipe";
ALTER TABLE "new_MembreEquipe" RENAME TO "MembreEquipe";
CREATE TABLE "new_Raid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categorie" TEXT NOT NULL DEFAULT '',
    "chantierId" TEXT,
    "domaine" TEXT NOT NULL DEFAULT '',
    "probabilite" INTEGER,
    "impact" INTEGER,
    "strategie" TEXT NOT NULL DEFAULT '',
    "mitigation" TEXT NOT NULL DEFAULT '',
    "responsable" TEXT NOT NULL DEFAULT '',
    "responsableRessourceId" TEXT,
    "statut" TEXT NOT NULL DEFAULT '',
    "date_identification" DATETIME,
    "date_revision" DATETIME,
    "date_echeance" DATETIME,
    "commentaires" TEXT NOT NULL DEFAULT '',
    "comiteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Raid_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Raid_responsableRessourceId_fkey" FOREIGN KEY ("responsableRessourceId") REFERENCES "Ressource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Raid_comiteId_fkey" FOREIGN KEY ("comiteId") REFERENCES "Comite" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Raid" ("categorie", "chantierId", "comiteId", "commentaires", "createdAt", "date_echeance", "date_identification", "date_revision", "description", "domaine", "id", "impact", "intitule", "mitigation", "probabilite", "responsable", "statut", "strategie", "type", "updatedAt") SELECT "categorie", "chantierId", "comiteId", "commentaires", "createdAt", "date_echeance", "date_identification", "date_revision", "description", "domaine", "id", "impact", "intitule", "mitigation", "probabilite", "responsable", "statut", "strategie", "type", "updatedAt" FROM "Raid";
DROP TABLE "Raid";
ALTER TABLE "new_Raid" RENAME TO "Raid";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
