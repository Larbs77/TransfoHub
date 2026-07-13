-- AppRole: permission to create RAID entries (three levels).
-- Default for all existing and new roles: none (Non autorisé).

ALTER TABLE "AppRole"
ADD COLUMN "raid_create_scope" TEXT NOT NULL DEFAULT 'none';
