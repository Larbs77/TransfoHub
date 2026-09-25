-- Favorites were global (one row per chantier). Copy that set onto every
-- account, then store one row per user and chantier.

CREATE TEMP TABLE "_favori_shared" AS
SELECT "chantierId", "createdAt" FROM "FavoriChantier";

DELETE FROM "FavoriChantier";

DROP INDEX IF EXISTS "FavoriChantier_chantierId_key";

ALTER TABLE "FavoriChantier" ADD COLUMN "userId" TEXT;

INSERT INTO "FavoriChantier" ("id", "userId", "chantierId", "createdAt")
SELECT md5(u."id" || ':' || f."chantierId"), u."id", f."chantierId", f."createdAt"
FROM "_favori_shared" f
CROSS JOIN "User" u;

ALTER TABLE "FavoriChantier" ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "FavoriChantier_userId_chantierId_key" ON "FavoriChantier"("userId", "chantierId");
CREATE INDEX "FavoriChantier_userId_idx" ON "FavoriChantier"("userId");
CREATE INDEX "FavoriChantier_chantierId_idx" ON "FavoriChantier"("chantierId");

ALTER TABLE "FavoriChantier" ADD CONSTRAINT "FavoriChantier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
