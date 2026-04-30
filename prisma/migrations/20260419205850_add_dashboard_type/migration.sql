-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PMO_Chantier',
    "must_change_pwd" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ressourceId" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "dashboard_type" TEXT NOT NULL DEFAULT 'complete',
    "locked_until" DATETIME,
    "last_login" DATETIME,
    "created_by" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "created_by", "failed_attempts", "id", "is_active", "last_login", "locked_until", "must_change_pwd", "password_hash", "ressourceId", "role", "updatedAt", "username") SELECT "createdAt", "created_by", "failed_attempts", "id", "is_active", "last_login", "locked_until", "must_change_pwd", "password_hash", "ressourceId", "role", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_ressourceId_key" ON "User"("ressourceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
