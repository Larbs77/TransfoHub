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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembreEquipe_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MembreEquipe" ("chantierId", "createdAt", "equipe", "id", "nom_complet", "role", "updatedAt") SELECT "chantierId", "createdAt", "equipe", "id", "nom_complet", "role", "updatedAt" FROM "MembreEquipe";
DROP TABLE "MembreEquipe";
ALTER TABLE "new_MembreEquipe" RENAME TO "MembreEquipe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
