-- Soft-delete séances via statut « Supprimé »; record the creator for delete rights.

ALTER TABLE "Comite" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Comite" ADD COLUMN "createdByName" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Comite_createdByUserId_idx" ON "Comite"("createdByUserId");
CREATE INDEX "Comite_statut_idx" ON "Comite"("statut");
