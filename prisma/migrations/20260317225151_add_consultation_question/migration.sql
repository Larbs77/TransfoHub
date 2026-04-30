-- CreateTable
CREATE TABLE "ConsultationQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chantierId" TEXT NOT NULL,
    "dossier_ref" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL,
    "categorie" TEXT NOT NULL DEFAULT 'Générale',
    "priorite" TEXT NOT NULL DEFAULT 'Moyenne',
    "statut" TEXT NOT NULL DEFAULT 'Ouverte',
    "remontee_par" TEXT NOT NULL DEFAULT '',
    "affectee_a" TEXT NOT NULL DEFAULT '',
    "echeance" DATETIME,
    "resolution" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConsultationQuestion_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "seuil_relance_jours" INTEGER NOT NULL DEFAULT 3,
    "seuil_qa_critique_heures" INTEGER NOT NULL DEFAULT 48
);
INSERT INTO "new_Settings" ("id", "seuil_relance_jours") SELECT "id", "seuil_relance_jours" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ConsultationQuestion_chantierId_idx" ON "ConsultationQuestion"("chantierId");

-- CreateIndex
CREATE INDEX "ConsultationQuestion_statut_idx" ON "ConsultationQuestion"("statut");

-- CreateIndex
CREATE INDEX "ConsultationQuestion_priorite_idx" ON "ConsultationQuestion"("priorite");
