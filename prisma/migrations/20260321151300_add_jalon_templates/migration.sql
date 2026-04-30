-- CreateTable
CREATE TABLE "JalonTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phase" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "offsetPct" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "JalonTemplate_phase_idx" ON "JalonTemplate"("phase");
