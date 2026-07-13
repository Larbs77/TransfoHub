-- CreateTable
CREATE TABLE "EquipeRaidCategorieAccess" (
    "id" TEXT NOT NULL,
    "equipeId" TEXT NOT NULL,
    "raidFieldOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipeRaidCategorieAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipeRaidCategorieAccess_equipeId_idx" ON "EquipeRaidCategorieAccess"("equipeId");

-- CreateIndex
CREATE INDEX "EquipeRaidCategorieAccess_raidFieldOptionId_idx" ON "EquipeRaidCategorieAccess"("raidFieldOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipeRaidCategorieAccess_equipeId_raidFieldOptionId_key" ON "EquipeRaidCategorieAccess"("equipeId", "raidFieldOptionId");

-- AddForeignKey
ALTER TABLE "EquipeRaidCategorieAccess" ADD CONSTRAINT "EquipeRaidCategorieAccess_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipeRaidCategorieAccess" ADD CONSTRAINT "EquipeRaidCategorieAccess_raidFieldOptionId_fkey" FOREIGN KEY ("raidFieldOptionId") REFERENCES "RaidFieldOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
