"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requirePageAccess } from "@/lib/auth";
import {
  approveWorkflowRequest,
  rejectWorkflowRequest,
  listWorkflowRequests,
  getWorkflowDashboardStats,
  getSessionJalonWorkflowCaps,
  WORKFLOW_ENTITY,
  WORKFLOW_OPERATION,
} from "@/lib/workflow";
import { buildJalonEntityLabel } from "@/lib/workflow-shared";

async function recalculateChantierProgress(chantierId: string) {
  const { PHASES } = await import("@/lib/jalon-labels");
  const PHASE_WEIGHT_KEYS: Record<string, string> = {
    Précadrage: "poids_precadrage",
    Cadrage: "poids_cadrage",
    Exécution: "poids_execution",
    Clôture: "poids_cloture",
  };
  const PHASE_TO_STATUT: Record<string, string> = {
    Précadrage: "Pré cadrage",
    Cadrage: "Cadrage",
    Exécution: "Exécution",
    Clôture: "Clôture",
  };

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  const jalons = await prisma.jalon.findMany({
    where: { chantierId },
    select: { phase: true, statut: true },
  });

  let totalProgress = 0;
  let currentStatut = "Non démarré";

  for (const phase of PHASES) {
    const phaseJalons = jalons.filter((j) => j.phase === phase);
    if (phaseJalons.length === 0) continue;
    const weightKey = PHASE_WEIGHT_KEYS[phase];
    const weight =
      ((settings as Record<string, unknown> | null)?.[weightKey] as number) ??
      0;
    const completed = phaseJalons.filter((j) => j.statut === "Atteint").length;
    const hasStarted = phaseJalons.some(
      (j) => j.statut === "En cours" || j.statut === "Atteint"
    );
    totalProgress += (completed / phaseJalons.length) * weight;
    if (hasStarted) {
      currentStatut = PHASE_TO_STATUT[phase];
    }
  }

  if (currentStatut === "Clôture") {
    const clotureJalons = jalons.filter((j) => j.phase === "Clôture");
    if (
      clotureJalons.length > 0 &&
      clotureJalons.every((j) => j.statut === "Atteint")
    ) {
      currentStatut = "Clôturé";
    }
  }

  await prisma.chantier.update({
    where: { id: chantierId },
    data: { avancement: Math.round(totalProgress), statut: currentStatut },
  });
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

async function executeJalonFromRequest(request: {
  entityType: string;
  operation: string;
  entityId: string | null;
  chantierId: string | null;
  newValues: unknown;
  oldValues: unknown;
}): Promise<{ entityId?: string | null; entityLabel?: string }> {
  if (request.entityType !== WORKFLOW_ENTITY.JALON) {
    throw new Error("Type d'objet non supporté pour exécution.");
  }

  if (request.operation === WORKFLOW_OPERATION.CREATE) {
    const nv = asRecord(request.newValues);
    if (!nv) throw new Error("Valeurs proposées manquantes.");
    const chantierId = String(nv.chantierId ?? request.chantierId ?? "");
    if (!chantierId) throw new Error("Chantier manquant.");

    const created = await prisma.jalon.create({
      data: {
        chantierId,
        phase: String(nv.phase ?? "Exécution"),
        nom: String(nv.nom ?? ""),
        description: String(nv.description ?? ""),
        ordre: Number(nv.ordre ?? 0),
        date_cible: new Date(String(nv.date_cible)),
        date_reelle: nv.date_reelle
          ? new Date(String(nv.date_reelle))
          : null,
        statut: String(nv.statut ?? "Planifié"),
        livrables: String(nv.livrables ?? ""),
        commentaire: String(nv.commentaire ?? ""),
      },
    });
    await recalculateChantierProgress(chantierId);
    return {
      entityId: created.id,
      entityLabel: buildJalonEntityLabel(created.phase, created.nom),
    };
  }

  if (request.operation === WORKFLOW_OPERATION.UPDATE) {
    if (!request.entityId) throw new Error("Jalon cible manquant.");
    const nv = asRecord(request.newValues);
    if (!nv) throw new Error("Valeurs proposées manquantes.");
    const updated = await prisma.jalon.update({
      where: { id: request.entityId },
      data: {
        phase: String(nv.phase ?? "Exécution"),
        nom: String(nv.nom ?? ""),
        description: String(nv.description ?? ""),
        ordre: Number(nv.ordre ?? 0),
        date_cible: new Date(String(nv.date_cible)),
        date_reelle: nv.date_reelle
          ? new Date(String(nv.date_reelle))
          : null,
        statut: String(nv.statut ?? "Planifié"),
        livrables: String(nv.livrables ?? ""),
        commentaire: String(nv.commentaire ?? ""),
      },
    });
    await recalculateChantierProgress(updated.chantierId);
    return {
      entityId: updated.id,
      entityLabel: buildJalonEntityLabel(updated.phase, updated.nom),
    };
  }

  if (request.operation === WORKFLOW_OPERATION.DELETE) {
    if (!request.entityId) throw new Error("Jalon cible manquant.");
    const existing = await prisma.jalon.findUnique({
      where: { id: request.entityId },
    });
    if (!existing) {
      // Already gone — still close the request
      const ov = asRecord(request.oldValues);
      return {
        entityId: request.entityId,
        entityLabel: buildJalonEntityLabel(
          String(ov?.phase ?? ""),
          String(ov?.nom ?? "")
        ),
      };
    }
    await prisma.jalon.delete({ where: { id: request.entityId } });
    await recalculateChantierProgress(existing.chantierId);
    return {
      entityId: existing.id,
      entityLabel: buildJalonEntityLabel(existing.phase, existing.nom),
    };
  }

  throw new Error("Opération non supportée.");
}

function revalidateWorkflowPaths(chantierId?: string | null) {
  revalidatePath("/workflow/demandes");
  revalidatePath("/workflow/historique");
  revalidatePath("/workflow/dashboard");
  revalidatePath("/jalons");
  revalidatePath("/");
  if (chantierId) revalidatePath(`/chantiers/${chantierId}`);
}

export async function getWorkflowRequestsForUi(filters?: {
  status?: string[];
  operation?: string[];
  chantierId?: string;
  pendingOnly?: boolean;
}) {
  const session = await requireAuth();
  const caps = await getSessionJalonWorkflowCaps(session);
  if (
    !caps.canViewRequests &&
    !caps.canViewHistory &&
    !caps.canApprove &&
    !caps.canReject
  ) {
    // Page access may still grant entry; allow if page granted
    try {
      await requirePageAccess(
        "/workflow/demandes",
        "/workflow/historique",
        "/workflow/dashboard"
      );
    } catch {
      throw new Error("Accès non autorisé aux demandes.");
    }
  }

  // Non-validators only see their own requests
  const isValidator = caps.canApprove || caps.canReject;
  const rows = await listWorkflowRequests({
    entityType: WORKFLOW_ENTITY.JALON,
    status: filters?.status,
    operation: filters?.operation,
    chantierId: filters?.chantierId,
    pendingOnly: filters?.pendingOnly,
    ...(isValidator ? {} : { requesterId: session.userId }),
  });

  const chantierIds = [
    ...new Set(rows.map((r) => r.chantierId).filter(Boolean) as string[]),
  ];
  const chantiers =
    chantierIds.length > 0
      ? await prisma.chantier.findMany({
          where: { id: { in: chantierIds } },
          select: { id: true, code: true, nom: true },
        })
      : [];
  const chantierMap = Object.fromEntries(chantiers.map((c) => [c.id, c]));

  return {
    caps,
    isValidator,
    requests: rows.map((r) => ({
      ...r,
      chantier: r.chantierId ? chantierMap[r.chantierId] ?? null : null,
    })),
  };
}

export async function approveWorkflowRequestAction(
  requestId: string,
  decisionComment: string
) {
  const session = await requireAuth();
  const updated = await approveWorkflowRequest(
    requestId,
    session,
    executeJalonFromRequest,
    decisionComment
  );
  revalidateWorkflowPaths(updated.chantierId);
  return { ok: true as const };
}

export async function rejectWorkflowRequestAction(
  requestId: string,
  rejectMotif: string
) {
  const session = await requireAuth();
  const updated = await rejectWorkflowRequest(
    requestId,
    session,
    rejectMotif
  );
  revalidateWorkflowPaths(updated.chantierId);
  return { ok: true as const };
}

export async function getWorkflowDashboardForUi() {
  const session = await requireAuth();
  const caps = await getSessionJalonWorkflowCaps(session);
  if (!caps.canViewKpi) {
    try {
      await requirePageAccess("/workflow/dashboard");
    } catch {
      throw new Error("Accès non autorisé au dashboard workflow.");
    }
  }
  // Prefer capability flag
  if (!caps.canViewKpi && session.role !== "Admin") {
    // Page access alone is enough if admin configured page without flag
  }

  const stats = await getWorkflowDashboardStats();
  const chantierIds = stats.byChantier.map((c) => c.chantierId);
  const chantiers =
    chantierIds.length > 0
      ? await prisma.chantier.findMany({
          where: { id: { in: chantierIds } },
          select: { id: true, code: true, nom: true },
        })
      : [];
  const map = Object.fromEntries(chantiers.map((c) => [c.id, c]));

  return {
    caps,
    stats: {
      ...stats,
      byChantier: stats.byChantier.map((c) => ({
        ...c,
        label: map[c.chantierId]
          ? `${map[c.chantierId].code} — ${map[c.chantierId].nom}`
          : c.chantierId,
      })),
    },
  };
}

export async function getWorkflowCapsForSession() {
  const session = await requireAuth();
  return getSessionJalonWorkflowCaps(session);
}
