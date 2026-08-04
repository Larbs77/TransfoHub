-- Planning detail: Workstream / Activite instances + gouvernance setting

ALTER TABLE "Settings" ADD COLUMN "planning_detail_gouvernance" TEXT NOT NULL DEFAULT 'libre';

CREATE TABLE "Workstream" (
    "id" TEXT NOT NULL,
    "jalonId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "date_debut" TIMESTAMP(3),
    "date_fin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "commentaire" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workstream_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activite" (
    "id" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "date_debut" TIMESTAMP(3),
    "date_fin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'Planifié',
    "commentaire" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Workstream_jalonId_idx" ON "Workstream"("jalonId");
CREATE INDEX "Workstream_statut_idx" ON "Workstream"("statut");
CREATE INDEX "Activite_workstreamId_idx" ON "Activite"("workstreamId");
CREATE INDEX "Activite_statut_idx" ON "Activite"("statut");

ALTER TABLE "Workstream" ADD CONSTRAINT "Workstream_jalonId_fkey" FOREIGN KEY ("jalonId") REFERENCES "Jalon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "Workstream"("id") ON DELETE CASCADE ON UPDATE CASCADE;