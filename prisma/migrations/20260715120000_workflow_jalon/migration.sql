-- Jalon / generic workflow governance (AppRole modes + WorkflowRequest)

-- AppRole: operation modes + workflow capabilities
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "jalon_create_mode" TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "jalon_update_mode" TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "jalon_delete_mode" TEXT NOT NULL DEFAULT 'DIRECT';
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "workflow_can_approve" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "workflow_can_reject" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "workflow_can_view_requests" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "workflow_can_view_history" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppRole" ADD COLUMN IF NOT EXISTS "workflow_can_view_kpi" BOOLEAN NOT NULL DEFAULT false;

-- Sensible defaults for seeded system roles (by code, not used at runtime for auth)
UPDATE "AppRole" SET
  "jalon_create_mode" = 'DIRECT',
  "jalon_update_mode" = 'DIRECT',
  "jalon_delete_mode" = 'DIRECT',
  "workflow_can_approve" = true,
  "workflow_can_reject" = true,
  "workflow_can_view_requests" = true,
  "workflow_can_view_history" = true,
  "workflow_can_view_kpi" = true
WHERE "code" IN ('Admin', 'Programme_Office');

UPDATE "AppRole" SET
  "jalon_create_mode" = 'DIRECT',
  "jalon_update_mode" = 'VALIDATION',
  "jalon_delete_mode" = 'VALIDATION',
  "workflow_can_approve" = false,
  "workflow_can_reject" = false,
  "workflow_can_view_requests" = true,
  "workflow_can_view_history" = true,
  "workflow_can_view_kpi" = false
WHERE "code" = 'PMO_Chantier';

UPDATE "AppRole" SET
  "jalon_create_mode" = 'INTERDIT',
  "jalon_update_mode" = 'INTERDIT',
  "jalon_delete_mode" = 'INTERDIT',
  "workflow_can_approve" = false,
  "workflow_can_reject" = false,
  "workflow_can_view_requests" = false,
  "workflow_can_view_history" = false,
  "workflow_can_view_kpi" = false
WHERE "code" = 'Workforce_Manager';

-- Generic workflow requests (permanent history)
CREATE TABLE IF NOT EXISTS "WorkflowRequest" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "entityId" TEXT,
    "entityLabel" TEXT NOT NULL DEFAULT '',
    "chantierId" TEXT,
    "requesterId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL DEFAULT '',
    "approverId" TEXT,
    "approverName" TEXT NOT NULL DEFAULT '',
    "motif" TEXT NOT NULL,
    "rejectMotif" TEXT NOT NULL DEFAULT '',
    "oldValues" JSONB,
    "newValues" JSONB,
    "decisionHistory" JSONB,
    "priority" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkflowRequest_status_createdAt_idx" ON "WorkflowRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkflowRequest_entityType_operation_status_idx" ON "WorkflowRequest"("entityType", "operation", "status");
CREATE INDEX IF NOT EXISTS "WorkflowRequest_entityId_status_idx" ON "WorkflowRequest"("entityId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowRequest_chantierId_idx" ON "WorkflowRequest"("chantierId");
CREATE INDEX IF NOT EXISTS "WorkflowRequest_requesterId_idx" ON "WorkflowRequest"("requesterId");
