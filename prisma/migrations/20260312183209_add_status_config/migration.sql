-- CreateTable
CREATE TABLE "StatusConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StatusConfig_type_position_idx" ON "StatusConfig"("type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StatusConfig_type_label_key" ON "StatusConfig"("type", "label");
