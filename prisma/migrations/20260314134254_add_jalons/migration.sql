-- CreateTable
CREATE TABLE "Jalon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "date_cible" DATETIME NOT NULL,
    "date_reelle" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "livrables" TEXT NOT NULL DEFAULT '',
    "commentaire" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Jalon_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Jalon_chantierId_idx" ON "Jalon"("chantierId");

-- CreateIndex
CREATE INDEX "Jalon_phase_idx" ON "Jalon"("phase");

-- CreateIndex
CREATE INDEX "Jalon_statut_idx" ON "Jalon"("statut");
