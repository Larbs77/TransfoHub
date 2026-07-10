-- CreateTable
CREATE TABLE "Chantier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "domaine" TEXT NOT NULL,
    "type_chantier" TEXT NOT NULL DEFAULT '',
    "priorite" TEXT NOT NULL DEFAULT '',
    "duree_mois" INTEGER NOT NULL DEFAULT 0,
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetJH" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetProjetMAD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conseilEditeursMAD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "licencesAchatsMAD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "licencesAbonnementsMAD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coutsInfrasMAD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetTotalMAD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "directeur" TEXT NOT NULL DEFAULT '',
    "pmo" TEXT NOT NULL DEFAULT '',
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Non démarré',
    "avancement" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chantier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rmd" (
    "id" TEXT NOT NULL,
    "nom_complet" TEXT NOT NULL,
    "domaine" TEXT NOT NULL,
    "suppleant" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rmd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChantierRmd" (
    "chantierId" TEXT NOT NULL,
    "rmdId" TEXT NOT NULL,

    CONSTRAINT "ChantierRmd_pkey" PRIMARY KEY ("chantierId","rmdId")
);

-- CreateTable
CREATE TABLE "ProfilRessource" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type_ressource" TEXT NOT NULL,
    "tjm_defaut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilRessource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ressource" (
    "id" TEXT NOT NULL,
    "nom_complet" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "organisation" TEXT NOT NULL DEFAULT '',
    "tarif_journalier" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "capacite_jours_mois" INTEGER NOT NULL DEFAULT 20,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "profilId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ressource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PMO_Chantier',
    "must_change_pwd" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ressourceId" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "dashboard_type" TEXT NOT NULL DEFAULT 'complete',
    "locked_until" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    "created_by" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembreEquipe" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "equipe" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "nom_complet" TEXT NOT NULL,
    "is_directeur" BOOLEAN NOT NULL DEFAULT false,
    "charge_pourcentage" INTEGER NOT NULL DEFAULT 100,
    "ressourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembreEquipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raid" (
    "id" TEXT NOT NULL,
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
    "date_identification" TIMESTAMP(3),
    "date_revision" TIMESTAMP(3),
    "date_echeance" TIMESTAMP(3),
    "commentaires" TEXT NOT NULL DEFAULT '',
    "comiteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comite" (
    "id" TEXT NOT NULL,
    "instance" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heure_casablanca" TEXT NOT NULL DEFAULT '',
    "heure_belgique" TEXT NOT NULL DEFAULT '',
    "statut" TEXT NOT NULL DEFAULT 'A planifier',
    "ordre_du_jour" TEXT NOT NULL DEFAULT '',
    "invitation_envoyee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "seuil_relance_jours" INTEGER NOT NULL DEFAULT 3,
    "seuil_qa_critique_heures" INTEGER NOT NULL DEFAULT 48,
    "poids_precadrage" INTEGER NOT NULL DEFAULT 10,
    "poids_cadrage" INTEGER NOT NULL DEFAULT 20,
    "poids_execution" INTEGER NOT NULL DEFAULT 50,
    "poids_cloture" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusConfig" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaisieTemps" (
    "id" TEXT NOT NULL,
    "ressourceId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "date_lundi" TIMESTAMP(3) NOT NULL,
    "jours_travailles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commentaire" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaisieTemps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adherence" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "chantierSourceId" TEXT NOT NULL,
    "chantierDependantId" TEXT,
    "chantierDependantLabel" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "domaine" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "criticite" TEXT NOT NULL DEFAULT 'MODÉRÉE',
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "date_identification" TIMESTAMP(3),
    "date_resolution_prevue" TIMESTAMP(3),
    "responsable" TEXT NOT NULL DEFAULT '',
    "contrat_interface" TEXT NOT NULL DEFAULT '',
    "commentaires" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adherence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jalon" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "date_cible" TIMESTAMP(3) NOT NULL,
    "date_reelle" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "livrables" TEXT NOT NULL DEFAULT '',
    "commentaire" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jalon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JalonTemplate" (
    "id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "offsetPct" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JalonTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationQuestion" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "dossier_ref" TEXT NOT NULL DEFAULT '',
    "question" TEXT NOT NULL,
    "categorie" TEXT NOT NULL DEFAULT 'Générale',
    "priorite" TEXT NOT NULL DEFAULT 'Moyenne',
    "statut" TEXT NOT NULL DEFAULT 'Ouverte',
    "remontee_par" TEXT NOT NULL DEFAULT '',
    "affectee_a" TEXT NOT NULL DEFAULT '',
    "echeance" TIMESTAMP(3),
    "resolution" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriChantier" (
    "id" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriChantier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chantier_code_key" ON "Chantier"("code");

-- CreateIndex
CREATE INDEX "ProfilRessource_type_ressource_idx" ON "ProfilRessource"("type_ressource");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilRessource_nom_type_ressource_key" ON "ProfilRessource"("nom", "type_ressource");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_ressourceId_key" ON "User"("ressourceId");

-- CreateIndex
CREATE INDEX "StatusConfig_type_position_idx" ON "StatusConfig"("type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StatusConfig_type_label_key" ON "StatusConfig"("type", "label");

-- CreateIndex
CREATE INDEX "SaisieTemps_ressourceId_date_lundi_idx" ON "SaisieTemps"("ressourceId", "date_lundi");

-- CreateIndex
CREATE INDEX "SaisieTemps_chantierId_date_lundi_idx" ON "SaisieTemps"("chantierId", "date_lundi");

-- CreateIndex
CREATE UNIQUE INDEX "SaisieTemps_ressourceId_chantierId_date_lundi_key" ON "SaisieTemps"("ressourceId", "chantierId", "date_lundi");

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

-- CreateIndex
CREATE INDEX "Jalon_chantierId_idx" ON "Jalon"("chantierId");

-- CreateIndex
CREATE INDEX "Jalon_phase_idx" ON "Jalon"("phase");

-- CreateIndex
CREATE INDEX "Jalon_statut_idx" ON "Jalon"("statut");

-- CreateIndex
CREATE INDEX "JalonTemplate_phase_idx" ON "JalonTemplate"("phase");

-- CreateIndex
CREATE INDEX "ConsultationQuestion_chantierId_idx" ON "ConsultationQuestion"("chantierId");

-- CreateIndex
CREATE INDEX "ConsultationQuestion_statut_idx" ON "ConsultationQuestion"("statut");

-- CreateIndex
CREATE INDEX "ConsultationQuestion_priorite_idx" ON "ConsultationQuestion"("priorite");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriChantier_chantierId_key" ON "FavoriChantier"("chantierId");

-- AddForeignKey
ALTER TABLE "ChantierRmd" ADD CONSTRAINT "ChantierRmd_rmdId_fkey" FOREIGN KEY ("rmdId") REFERENCES "Rmd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantierRmd" ADD CONSTRAINT "ChantierRmd_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ressource" ADD CONSTRAINT "Ressource_profilId_fkey" FOREIGN KEY ("profilId") REFERENCES "ProfilRessource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEquipe" ADD CONSTRAINT "MembreEquipe_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEquipe" ADD CONSTRAINT "MembreEquipe_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_comiteId_fkey" FOREIGN KEY ("comiteId") REFERENCES "Comite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_responsableRessourceId_fkey" FOREIGN KEY ("responsableRessourceId") REFERENCES "Ressource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaisieTemps" ADD CONSTRAINT "SaisieTemps_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaisieTemps" ADD CONSTRAINT "SaisieTemps_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adherence" ADD CONSTRAINT "Adherence_chantierDependantId_fkey" FOREIGN KEY ("chantierDependantId") REFERENCES "Chantier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adherence" ADD CONSTRAINT "Adherence_chantierSourceId_fkey" FOREIGN KEY ("chantierSourceId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jalon" ADD CONSTRAINT "Jalon_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationQuestion" ADD CONSTRAINT "ConsultationQuestion_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriChantier" ADD CONSTRAINT "FavoriChantier_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
