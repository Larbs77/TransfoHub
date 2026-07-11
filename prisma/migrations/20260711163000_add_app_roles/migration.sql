-- CreateTable
CREATE TABLE "AppRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "chantier_scope" TEXT NOT NULL DEFAULT 'none',
    "pages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppRole_code_key" ON "AppRole"("code");

-- CreateIndex
CREATE INDEX "AppRole_is_active_idx" ON "AppRole"("is_active");

-- Seed built-in roles (match previous hard-coded matrix)
INSERT INTO "AppRole" ("id", "code", "label", "description", "color", "is_active", "is_system", "chantier_scope", "pages", "createdAt", "updatedAt")
VALUES
(
  gen_random_uuid()::text,
  'Admin',
  'Administrateur',
  'Accès complet à l''application et à l''administration',
  '#dc2626',
  true,
  true,
  'all',
  '["/","/chantiers","/adherences","/raid","/jalons","/saisie-temps","/consultation-backlog","/favoris","/comites","/dashboards","/rmds","/calendrier","/ressources","/profils","/capacite","/admin/users","/admin/roles","/settings"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::text,
  'Programme_Office',
  'Bureau Programme',
  'Pilotage programme et gouvernance',
  '#2563eb',
  true,
  true,
  'all',
  '["/","/chantiers","/adherences","/raid","/jalons","/saisie-temps","/consultation-backlog","/favoris","/comites","/dashboards","/rmds","/calendrier","/ressources","/capacite"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::text,
  'PMO_Chantier',
  'PMO Chantier',
  'Pilotage des chantiers assignés',
  '#059669',
  true,
  true,
  'assigned',
  '["/","/chantiers","/adherences","/raid","/jalons","/saisie-temps","/consultation-backlog","/favoris","/comites","/calendrier"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::text,
  'Workforce_Manager',
  'Gestionnaire Ressources',
  'Gestion des ressources, profils et capacité',
  '#7c3aed',
  true,
  true,
  'none',
  '["/","/saisie-temps","/calendrier","/ressources","/profils","/capacite"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
