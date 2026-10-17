-- AlterTable
ALTER TABLE "User" ADD COLUMN "notif_raid_changes" TEXT NOT NULL DEFAULT 'chantier';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "actorName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Notification" ADD COLUMN "chantierId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Notification" ADD COLUMN "chantierCode" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Notification_chantierId_createdAt_idx" ON "Notification"("chantierId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");
