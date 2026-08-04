-- Workstream / activité under JalonTemplate (settings référentiel only)

CREATE TABLE "WorkstreamTemplate" (
    "id" TEXT NOT NULL,
    "jalonTemplateId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkstreamTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActiviteTemplate" (
    "id" TEXT NOT NULL,
    "workstreamTemplateId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiviteTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkstreamTemplate_jalonTemplateId_idx" ON "WorkstreamTemplate"("jalonTemplateId");

CREATE INDEX "ActiviteTemplate_workstreamTemplateId_idx" ON "ActiviteTemplate"("workstreamTemplateId");

ALTER TABLE "WorkstreamTemplate" ADD CONSTRAINT "WorkstreamTemplate_jalonTemplateId_fkey" FOREIGN KEY ("jalonTemplateId") REFERENCES "JalonTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActiviteTemplate" ADD CONSTRAINT "ActiviteTemplate_workstreamTemplateId_fkey" FOREIGN KEY ("workstreamTemplateId") REFERENCES "WorkstreamTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;