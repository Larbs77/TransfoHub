-- Q&A Consultation workflow modes on AppRole (DIRECT | VALIDATION | INTERDIT)
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "qa_create_mode" TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "qa_update_mode" TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "qa_delete_mode" TEXT NOT NULL DEFAULT 'DIRECT';

-- Align defaults with previous hard-coded requireRole behaviour:
-- Admin / Programme_Office: full DIRECT
-- PMO_Chantier: create/update DIRECT, delete INTERDIT
-- Workforce_Manager: all INTERDIT
UPDATE "AppRole" SET
  "qa_create_mode" = 'DIRECT',
  "qa_update_mode" = 'DIRECT',
  "qa_delete_mode" = 'DIRECT'
WHERE "code" IN ('Admin', 'Programme_Office');

UPDATE "AppRole" SET
  "qa_create_mode" = 'DIRECT',
  "qa_update_mode" = 'DIRECT',
  "qa_delete_mode" = 'INTERDIT'
WHERE "code" = 'PMO_Chantier';

UPDATE "AppRole" SET
  "qa_create_mode" = 'INTERDIT',
  "qa_update_mode" = 'INTERDIT',
  "qa_delete_mode" = 'INTERDIT'
WHERE "code" = 'Workforce_Manager';
