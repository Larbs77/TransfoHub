-- CreateTable
CREATE TABLE "Adherence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "chantierSourceId" TEXT NOT NULL,
    "chantierDependantId" TEXT,
    "chantierDependantLabel" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "domaine" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "criticite" TEXT NOT NULL DEFAULT 'MODÉRÉE',
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "date_identification" DATETIME,
    "date_resolution_prevue" DATETIME,
    "responsable" TEXT NOT NULL DEFAULT '',
    "contrat_interface" TEXT NOT NULL DEFAULT '',
    "commentaires" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Adherence_chantierSourceId_fkey" FOREIGN KEY ("chantierSourceId") REFERENCES "Chantier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Adherence_chantierDependantId_fkey" FOREIGN KEY ("chantierDependantId") REFERENCES "Chantier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Adherence_code_key" ON "Adherence"("code");

-- CreateIndex
CREATE INDEX "Adherence_chantierSourceId_idx" ON "Adherence"("chantierSourceId");

-- CreateIndex
CREATE INDEX "Adherence_chantierDependantId_idx" ON "Adherence"("chantierDependantId");

-- CreateIndex
CREATE INDEX "Adherence_criticite_idx" ON "Adherence"("criticite");

-- CreateIndex
CREATE INDEX "Adherence_statut_idx" ON "Adherence"("statut");
