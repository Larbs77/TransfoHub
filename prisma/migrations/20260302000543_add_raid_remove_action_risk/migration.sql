/*
  Warnings:

  - You are about to drop the `Action` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Risk` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Action";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Risk";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Raid" (
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
    "statut" TEXT NOT NULL DEFAULT '',
    "date_identification" DATETIME,
    "date_revision" DATETIME,
    "commentaires" TEXT NOT NULL DEFAULT '',
    "comiteId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Raid_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Raid_comiteId_fkey" FOREIGN KEY ("comiteId") REFERENCES "Comite" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
