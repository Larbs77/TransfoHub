-- CreateTable
CREATE TABLE "RaidFieldOption" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaidFieldOption_kind_position_idx" ON "RaidFieldOption"("kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RaidFieldOption_kind_label_key" ON "RaidFieldOption"("kind", "label");

-- Seed: historical hardcoded CATEGORIE_LIST
INSERT INTO "RaidFieldOption" ("id", "kind", "label", "color", "position", "createdAt")
VALUES
  (gen_random_uuid()::text, 'categorie', 'Budget', '#0A3C74', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'categorie', 'Fournisseur', '#7c3aed', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'categorie', 'Opérationnel', '#2563eb', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'categorie', 'Planning', '#0891b2', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'categorie', 'Ressources', '#059669', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'categorie', 'Stratégique', '#dc2626', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'categorie', 'Technique', '#00BDBB', 6, CURRENT_TIMESTAMP);

-- Seed: historical hardcoded DOMAINE_LIST
INSERT INTO "RaidFieldOption" ("id", "kind", "label", "color", "position", "createdAt")
VALUES
  (gen_random_uuid()::text, 'domaine', 'Agence', '#0A3C74', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Monétique', '#2563eb', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Chèques & LCN', '#7c3aed', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Virements domestiques & prélèvements', '#0891b2', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Référentiel & TDC', '#059669', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Produits et tarification', '#ca8a04', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Bancassurance', '#ea580c', 6, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Transferts internationaux & dotations', '#dc2626', 7, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Engagement', '#be185d', 8, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Crédit', '#4f46e5', 9, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Migration', '#0d9488', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Infrastructure', '#64748b', 11, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'BSS', '#00BDBB', 12, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Architecture et sécurité', '#b45309', 13, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'domaine', 'Programme Office', '#334155', 14, CURRENT_TIMESTAMP);

-- Seed: distinct Catégorie values already present on Raid (preserve free-text imports)
INSERT INTO "RaidFieldOption" ("id", "kind", "label", "color", "position", "createdAt")
SELECT
  gen_random_uuid()::text,
  'categorie',
  d.label,
  '#6b7280',
  100 + (ROW_NUMBER() OVER (ORDER BY d.label))::int,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM(categorie) AS label
  FROM "Raid"
  WHERE categorie IS NOT NULL AND TRIM(categorie) <> ''
) d
WHERE NOT EXISTS (
  SELECT 1 FROM "RaidFieldOption" o
  WHERE o.kind = 'categorie' AND o.label = d.label
);

-- Seed: distinct Domaine values already present on Raid
INSERT INTO "RaidFieldOption" ("id", "kind", "label", "color", "position", "createdAt")
SELECT
  gen_random_uuid()::text,
  'domaine',
  d.label,
  '#6b7280',
  100 + (ROW_NUMBER() OVER (ORDER BY d.label))::int,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM(domaine) AS label
  FROM "Raid"
  WHERE domaine IS NOT NULL AND TRIM(domaine) <> ''
) d
WHERE NOT EXISTS (
  SELECT 1 FROM "RaidFieldOption" o
  WHERE o.kind = 'domaine' AND o.label = d.label
);
