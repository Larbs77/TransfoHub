-- Grant portfolio Gantt page to operational system roles that already have
-- Jalons (Programme Office + PMO Chantier). Admin already has full pages.
-- Idempotent: skip roles that already include /gantt.
UPDATE "AppRole"
SET "pages" = "pages"::jsonb || '["/gantt"]'::jsonb
WHERE "code" IN ('Programme_Office', 'PMO_Chantier')
  AND NOT ("pages"::jsonb ? '/gantt');
