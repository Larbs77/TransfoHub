-- Share a RAID with other chantier functional teams, and @mentions in the discussion.

CREATE TABLE "RaidPartage" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "equipeId" TEXT NOT NULL,
    "sharedByUserId" TEXT,
    "sharedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidPartage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaidCommentMention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "ressourceId" TEXT NOT NULL,

    CONSTRAINT "RaidCommentMention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaidPartage_raidId_equipeId_key" ON "RaidPartage"("raidId", "equipeId");
CREATE INDEX "RaidPartage_raidId_idx" ON "RaidPartage"("raidId");
CREATE INDEX "RaidPartage_equipeId_idx" ON "RaidPartage"("equipeId");

CREATE UNIQUE INDEX "RaidCommentMention_commentId_ressourceId_key" ON "RaidCommentMention"("commentId", "ressourceId");
CREATE INDEX "RaidCommentMention_ressourceId_idx" ON "RaidCommentMention"("ressourceId");

ALTER TABLE "RaidPartage" ADD CONSTRAINT "RaidPartage_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidPartage" ADD CONSTRAINT "RaidPartage_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidCommentMention" ADD CONSTRAINT "RaidCommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "RaidComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaidCommentMention" ADD CONSTRAINT "RaidCommentMention_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "Ressource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
