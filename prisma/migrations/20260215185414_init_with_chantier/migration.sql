-- CreateTable
CREATE TABLE "Chantier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domaine" TEXT NOT NULL,
    "directeur" TEXT NOT NULL,
    "pmo" TEXT NOT NULL,
    "date_debut" DATETIME NOT NULL,
    "date_fin" DATETIME NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "libelle" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "pmo" TEXT NOT NULL,
    "date_debut" DATETIME NOT NULL,
    "echeance" DATETIME NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'TODO',
    "priorite" TEXT NOT NULL DEFAULT 'MEDIUM',
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Action_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "impact" INTEGER NOT NULL,
    "probabilite" INTEGER NOT NULL,
    "plan_mitigation" TEXT NOT NULL,
    "pilote" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "pmo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Risk_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "seuil_relance_jours" INTEGER NOT NULL DEFAULT 3
);

-- CreateIndex
CREATE UNIQUE INDEX "Chantier_code_key" ON "Chantier"("code");
