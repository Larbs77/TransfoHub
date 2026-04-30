-- CreateTable
CREATE TABLE "Comite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instance" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "heure_casablanca" TEXT NOT NULL DEFAULT '',
    "heure_belgique" TEXT NOT NULL DEFAULT '',
    "statut" TEXT NOT NULL DEFAULT 'A planifier',
    "ordre_du_jour" TEXT NOT NULL DEFAULT '',
    "invitation_envoyee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
