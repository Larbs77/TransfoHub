-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "seuil_relance_jours" INTEGER NOT NULL DEFAULT 3,
    "seuil_qa_critique_heures" INTEGER NOT NULL DEFAULT 48,
    "poids_precadrage" INTEGER NOT NULL DEFAULT 10,
    "poids_cadrage" INTEGER NOT NULL DEFAULT 20,
    "poids_execution" INTEGER NOT NULL DEFAULT 50,
    "poids_cloture" INTEGER NOT NULL DEFAULT 20
);
INSERT INTO "new_Settings" ("id", "seuil_qa_critique_heures", "seuil_relance_jours") SELECT "id", "seuil_qa_critique_heures", "seuil_relance_jours" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
