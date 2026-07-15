/**
 * Generic governance workflow engine (first use-case: jalons).
 * Server-only — imports prisma. Client code must use `@/lib/workflow-shared`.
 */

import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/auth";
import { getRoleByCode } from "@/lib/roles";
import { getActorDisplay } from "@/lib/raid-collaboration";
import type { Prisma } from "@/generated/prisma/client";

// Re-export client-safe surface for server modules
export {
  WORKFLOW_ENTITY,
  WORKFLOW_OPERATION,
  WORKFLOW_MODE,
  WORKFLOW_STATUS,
  WORKFLOW_MODE_OPTIONS,
  WORKFLOW_OPERATION_LABELS,
  WORKFLOW_STATUS_LABELS,
  normalizeWorkflowMode,
  isWorkflowMode,
  resolveJalonWorkflowCaps,
  modeForOperation,
  parseDecisionHistory,
  type WorkflowEntityType,
  type WorkflowOperation,
  type WorkflowMode,
  type WorkflowStatus,
  type JalonWorkflowCaps,
  type DecisionEvent,
} from "@/lib/workflow-shared";

import {
  WORKFLOW_STATUS,
  resolveJalonWorkflowCaps,
  parseDecisionHistory,
  resolveWorkflowOrigin,
  type WorkflowEntityType,
  type WorkflowOperation,
  type JalonWorkflowCaps,
  type DecisionEvent,
} from "@/lib/workflow-shared";

export async function getSessionJalonWorkflowCaps(
  session: SessionData
): Promise<JalonWorkflowCaps> {
  const role = await getRoleByCode(session.role);
  return resolveJalonWorkflowCaps(role);
}

// ── Request creation ───────────────────────────────────

export type CreateWorkflowRequestInput = {
  entityType: WorkflowEntityType | string;
  operation: WorkflowOperation;
  entityId?: string | null;
  entityLabel?: string;
  chantierId?: string | null;
  motif: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  priority?: string;
  session: SessionData;
};

export async function assertNoPendingRequest(params: {
  entityType: string;
  operation: WorkflowOperation;
  entityId?: string | null;
  chantierId?: string | null;
}) {
  const where: {
    status: string;
    entityType: string;
    operation: string;
    entityId?: string;
    chantierId?: string;
  } = {
    status: WORKFLOW_STATUS.PENDING,
    entityType: params.entityType,
    operation: params.operation,
  };

  if (params.entityId) {
    where.entityId = params.entityId;
  } else if (params.chantierId && params.operation === "create") {
    // One pending create per chantier (no entity yet)
    where.chantierId = params.chantierId;
  } else {
    return;
  }

  const existing = await prisma.workflowRequest.findFirst({ where });
  if (existing) {
    throw new Error(
      "Une demande est déjà en attente pour cet objet et cette opération."
    );
  }
}

export async function createWorkflowRequest(input: CreateWorkflowRequestInput) {
  const motif = input.motif?.trim() ?? "";
  if (!motif) {
    throw new Error("Le motif de la demande est obligatoire.");
  }

  await assertNoPendingRequest({
    entityType: input.entityType,
    operation: input.operation,
    entityId: input.entityId,
    chantierId: input.chantierId,
  });

  // Also block conflicting pending ops on same entity (update vs delete)
  if (input.entityId) {
    const conflict = await prisma.workflowRequest.findFirst({
      where: {
        status: WORKFLOW_STATUS.PENDING,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
    if (conflict) {
      throw new Error(
        "Une demande est déjà en attente sur cet objet. Traitez-la avant d'en créer une autre."
      );
    }
  }

  const actor = await getActorDisplay(input.session);
  const now = new Date().toISOString();
  const history: DecisionEvent[] = [
    {
      at: now,
      status: WORKFLOW_STATUS.PENDING,
      actorId: actor.actorUserId,
      actorName: actor.actorName,
      note: "Création de la demande",
    },
  ];

  return prisma.workflowRequest.create({
    data: {
      entityType: input.entityType,
      operation: input.operation,
      status: WORKFLOW_STATUS.PENDING,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel?.trim() ?? "",
      chantierId: input.chantierId ?? null,
      requesterId: actor.actorUserId,
      requesterName: actor.actorName,
      motif,
      oldValues: (input.oldValues ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      newValues: (input.newValues ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      decisionHistory: history as unknown as Prisma.InputJsonValue,
      // Mark as validation-path request (filter / history UI)
      priority: input.priority?.trim() || "VALIDATION",
    },
  });
}

// ── Approve / Reject ───────────────────────────────────

export type ExecuteApprovedOperation = (request: {
  id: string;
  entityType: string;
  operation: string;
  entityId: string | null;
  chantierId: string | null;
  oldValues: unknown;
  newValues: unknown;
}) => Promise<{ entityId?: string | null; entityLabel?: string } | void>;

export async function approveWorkflowRequest(
  requestId: string,
  session: SessionData,
  execute: ExecuteApprovedOperation,
  decisionComment: string
) {
  const caps = await getSessionJalonWorkflowCaps(session);
  if (!caps.canApprove) {
    throw new Error("Vous n'êtes pas habilité à approuver une demande.");
  }

  const comment = decisionComment?.trim() ?? "";
  if (!comment) {
    throw new Error("Le commentaire de décision est obligatoire pour approuver.");
  }

  const request = await prisma.workflowRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new Error("Demande introuvable.");
  if (request.status !== WORKFLOW_STATUS.PENDING) {
    throw new Error("Cette demande a déjà été traitée.");
  }

  const result = await execute({
    id: request.id,
    entityType: request.entityType,
    operation: request.operation,
    entityId: request.entityId,
    chantierId: request.chantierId,
    oldValues: request.oldValues,
    newValues: request.newValues,
  });

  const actor = await getActorDisplay(session);
  const history = parseDecisionHistory(request.decisionHistory);
  history.push({
    at: new Date().toISOString(),
    status: WORKFLOW_STATUS.APPROVED,
    actorId: actor.actorUserId,
    actorName: actor.actorName,
    note: comment,
  });

  return prisma.workflowRequest.update({
    where: { id: requestId },
    data: {
      status: WORKFLOW_STATUS.APPROVED,
      approverId: actor.actorUserId,
      approverName: actor.actorName,
      // Store validator comment (same column used as decision note for reject)
      rejectMotif: "",
      processedAt: new Date(),
      decisionHistory: history as unknown as Prisma.InputJsonValue,
      ...(result?.entityId !== undefined
        ? { entityId: result.entityId }
        : {}),
      ...(result?.entityLabel
        ? { entityLabel: result.entityLabel }
        : {}),
    },
  });
}

export async function rejectWorkflowRequest(
  requestId: string,
  session: SessionData,
  rejectMotif: string
) {
  const caps = await getSessionJalonWorkflowCaps(session);
  if (!caps.canReject) {
    throw new Error("Vous n'êtes pas habilité à rejeter une demande.");
  }

  const motif = rejectMotif?.trim() ?? "";
  if (!motif) {
    throw new Error("Le commentaire de décision est obligatoire pour rejeter.");
  }

  const request = await prisma.workflowRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new Error("Demande introuvable.");
  if (request.status !== WORKFLOW_STATUS.PENDING) {
    throw new Error("Cette demande a déjà été traitée.");
  }

  const actor = await getActorDisplay(session);
  const history = parseDecisionHistory(request.decisionHistory);
  history.push({
    at: new Date().toISOString(),
    status: WORKFLOW_STATUS.REJECTED,
    actorId: actor.actorUserId,
    actorName: actor.actorName,
    note: motif,
  });

  return prisma.workflowRequest.update({
    where: { id: requestId },
    data: {
      status: WORKFLOW_STATUS.REJECTED,
      rejectMotif: motif,
      approverId: actor.actorUserId,
      approverName: actor.actorName,
      processedAt: new Date(),
      decisionHistory: history as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Audit trail for DIRECT update/delete (comment mandatory, auto-approved).
 */
export async function createDirectOperationAudit(input: {
  entityType: string;
  operation: WorkflowOperation;
  entityId?: string | null;
  entityLabel?: string;
  chantierId?: string | null;
  motif: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  session: SessionData;
}) {
  const motif = input.motif?.trim() ?? "";
  if (!motif) {
    throw new Error("Le commentaire est obligatoire pour cette opération.");
  }

  const actor = await getActorDisplay(input.session);
  const now = new Date();
  const history: DecisionEvent[] = [
    {
      at: now.toISOString(),
      status: WORKFLOW_STATUS.APPROVED,
      actorId: actor.actorUserId,
      actorName: actor.actorName,
      note: motif,
    },
  ];

  return prisma.workflowRequest.create({
    data: {
      entityType: input.entityType,
      operation: input.operation,
      status: WORKFLOW_STATUS.APPROVED,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel?.trim() ?? "",
      chantierId: input.chantierId ?? null,
      requesterId: actor.actorUserId,
      requesterName: actor.actorName,
      approverId: actor.actorUserId,
      approverName: actor.actorName,
      motif,
      rejectMotif: "",
      oldValues: (input.oldValues ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      newValues: (input.newValues ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      decisionHistory: history as unknown as Prisma.InputJsonValue,
      // Direct auto-approved audit (filter / history UI)
      priority: "DIRECT",
      processedAt: now,
    },
  });
}

/** Last validator decision note from history (approve or reject). */
export function getDecisionCommentFromRequest(request: {
  rejectMotif?: string | null;
  decisionHistory?: unknown;
  status?: string;
}): string {
  const history = parseDecisionHistory(request.decisionHistory);
  for (let i = history.length - 1; i >= 0; i--) {
    const ev = history[i];
    if (
      (ev.status === WORKFLOW_STATUS.APPROVED ||
        ev.status === WORKFLOW_STATUS.REJECTED) &&
      ev.note?.trim()
    ) {
      return ev.note.trim();
    }
  }
  if (request.rejectMotif?.trim()) return request.rejectMotif.trim();
  return "";
}

// ── Queries ────────────────────────────────────────────

export type WorkflowRequestFilters = {
  status?: string[];
  operation?: string[];
  entityType?: string;
  chantierId?: string;
  requesterId?: string;
  from?: Date;
  to?: Date;
  pendingOnly?: boolean;
};

export async function listWorkflowRequests(filters?: WorkflowRequestFilters) {
  const now = new Date();
  return prisma.workflowRequest.findMany({
    where: {
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
      ...(filters?.status?.length ? { status: { in: filters.status } } : {}),
      ...(filters?.operation?.length
        ? { operation: { in: filters.operation } }
        : {}),
      ...(filters?.chantierId ? { chantierId: filters.chantierId } : {}),
      ...(filters?.requesterId ? { requesterId: filters.requesterId } : {}),
      ...(filters?.pendingOnly
        ? { status: WORKFLOW_STATUS.PENDING }
        : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingRequestsForEntities(
  entityType: string,
  entityIds: string[]
) {
  if (entityIds.length === 0) return [];
  return prisma.workflowRequest.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      status: WORKFLOW_STATUS.PENDING,
    },
    select: {
      id: true,
      entityId: true,
      operation: true,
      status: true,
      motif: true,
      requesterName: true,
      createdAt: true,
    },
  });
}

export async function getWorkflowDashboardStats() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const all = await prisma.workflowRequest.findMany({
    select: {
      id: true,
      status: true,
      operation: true,
      priority: true,
      decisionHistory: true,
      chantierId: true,
      requesterId: true,
      requesterName: true,
      approverId: true,
      approverName: true,
      entityId: true,
      createdAt: true,
      processedAt: true,
    },
  });

  const withOrigin = all.map((r) => ({
    ...r,
    origin: resolveWorkflowOrigin(r),
  }));

  const validation = withOrigin.filter((r) => r.origin === "validation");
  const direct = withOrigin.filter((r) => r.origin === "direct");

  const pending = validation.filter(
    (r) => r.status === WORKFLOW_STATUS.PENDING
  );
  const approvedValidation = validation.filter(
    (r) => r.status === WORKFLOW_STATUS.APPROVED
  );
  const rejected = validation.filter(
    (r) => r.status === WORKFLOW_STATUS.REJECTED
  );

  // Processing time: only validation-path (exclude auto-approved direct)
  const processedValidation = validation.filter((r) => r.processedAt);
  const durations = processedValidation
    .map((r) => {
      if (!r.processedAt) return null;
      return r.processedAt.getTime() - r.createdAt.getTime();
    })
    .filter((d): d is number => d !== null);

  const avgMs =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
  const maxMs = durations.length > 0 ? Math.max(...durations) : 0;
  const minMs = durations.length > 0 ? Math.min(...durations) : 0;

  const byOperation = {
    create: all.filter((r) => r.operation === "create").length,
    update: all.filter((r) => r.operation === "update").length,
    delete: all.filter((r) => r.operation === "delete").length,
  };

  const byOperationValidation = {
    create: validation.filter((r) => r.operation === "create").length,
    update: validation.filter((r) => r.operation === "update").length,
    delete: validation.filter((r) => r.operation === "delete").length,
  };

  const byOperationDirect = {
    create: direct.filter((r) => r.operation === "create").length,
    update: direct.filter((r) => r.operation === "update").length,
    delete: direct.filter((r) => r.operation === "delete").length,
  };

  const byChantier = new Map<string, number>();
  const byRequester = new Map<string, { name: string; count: number }>();
  const byApprover = new Map<string, { name: string; count: number }>();

  for (const r of validation) {
    if (r.chantierId) {
      byChantier.set(r.chantierId, (byChantier.get(r.chantierId) ?? 0) + 1);
    }
    const req = byRequester.get(r.requesterId) ?? {
      name: r.requesterName,
      count: 0,
    };
    req.count++;
    byRequester.set(r.requesterId, req);
    if (r.approverId && r.status !== WORKFLOW_STATUS.PENDING) {
      const ap = byApprover.get(r.approverId) ?? {
        name: r.approverName,
        count: 0,
      };
      ap.count++;
      byApprover.set(r.approverId, ap);
    }
  }

  const decided = approvedValidation.length + rejected.length;
  const approvalRate =
    decided > 0
      ? Math.round((approvedValidation.length / decided) * 100)
      : 0;
  const rejectRate =
    decided > 0 ? Math.round((rejected.length / decided) * 100) : 0;

  // Daily trend last 14 days — split validation vs direct
  const trendDaily: {
    date: string;
    validation: number;
    direct: number;
    total: number;
  }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const dayRows = withOrigin.filter(
      (r) => r.createdAt >= d && r.createdAt < next
    );
    const v = dayRows.filter((r) => r.origin === "validation").length;
    const dir = dayRows.filter((r) => r.origin === "direct").length;
    trendDaily.push({
      date: d.toISOString().slice(0, 10),
      validation: v,
      direct: dir,
      total: v + dir,
    });
  }

  return {
    total: all.length,
    // Validation path
    pending: pending.length,
    approved: approvedValidation.length,
    rejected: rejected.length,
    validationTotal: validation.length,
    // Direct / auto-approved
    directTotal: direct.length,
    directToday: direct.filter((r) => r.createdAt >= startOfDay).length,
    directThisWeek: direct.filter((r) => r.createdAt >= startOfWeek).length,
    directThisMonth: direct.filter((r) => r.createdAt >= startOfMonth).length,
    // Activity (all)
    createdToday: all.filter((r) => r.createdAt >= startOfDay).length,
    createdThisWeek: all.filter((r) => r.createdAt >= startOfWeek).length,
    createdThisMonth: all.filter((r) => r.createdAt >= startOfMonth).length,
    validationToday: validation.filter((r) => r.createdAt >= startOfDay)
      .length,
    byOperation,
    byOperationValidation,
    byOperationDirect,
    // Processing times — validation only (excludes auto-approved)
    avgProcessingHours: Math.round((avgMs / 3600000) * 10) / 10,
    maxProcessingHours: Math.round((maxMs / 3600000) * 10) / 10,
    minProcessingHours: Math.round((minMs / 3600000) * 10) / 10,
    processingSampleSize: durations.length,
    byChantier: [...byChantier.entries()]
      .map(([id, count]) => ({ chantierId: id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    byRequester: [...byRequester.entries()]
      .map(([id, v]) => ({ requesterId: id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    byApprover: [...byApprover.entries()]
      .map(([id, v]) => ({ approverId: id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    approvalRate,
    rejectRate,
    deleteRequests: validation.filter((r) => r.operation === "delete").length,
    trendDaily,
  };
}

/** Users who can approve (for future notifications). */
export async function getApproverUserIds(): Promise<string[]> {
  const roles = await prisma.appRole.findMany({
    where: {
      is_active: true,
      OR: [{ workflow_can_approve: true }, { code: "Admin" }],
    },
    select: { code: true },
  });
  const codes = roles.map((r) => r.code);
  if (codes.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { is_active: true, role: { in: codes } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
