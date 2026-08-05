-- Date de finalisation réelle (passage Atteint) pour workstreams et activités
ALTER TABLE "Workstream" ADD COLUMN IF NOT EXISTS "date_reelle" TIMESTAMP(3);
ALTER TABLE "Activite" ADD COLUMN IF NOT EXISTS "date_reelle" TIMESTAMP(3);
