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

function optionalIsoDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function executePlanningFromRequest(request: {
  entityType: string;
  operation: string;
  entityId: string | null;
  chantierId: string | null;
  newValues: unknown;
  oldValues: unknown;
}): Promise<{ entityId?: string | null; entityLabel?: string }> {
  const {
    buildWorkstreamEntityLabel,
    buildActiviteEntityLabel,
  } = await import("@/lib/workflow-shared");

  // ── Jalon ──────────────────────────────────────────
  if (request.entityType === WORKFLOW_ENTITY.JALON) {
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
          date_debut: optionalIsoDate(nv.date_debut),
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
      const jalonStatut = String(nv.statut ?? "Planifié");
      if (jalonStatut === "Atteint") {
        const { assertJalonCanBeAtteint } = await import(
          "@/lib/planning-status-assert"
        );
        await assertJalonCanBeAtteint(request.entityId);
      }
      const updated = await prisma.jalon.update({
        where: { id: request.entityId },
        data: {
          phase: String(nv.phase ?? "Exécution"),
          nom: String(nv.nom ?? ""),
          description: String(nv.description ?? ""),
          ordre: Number(nv.ordre ?? 0),
          date_debut: optionalIsoDate(nv.date_debut),
          date_cible: new Date(String(nv.date_cible)),
          date_reelle: nv.date_reelle
            ? new Date(String(nv.date_reelle))
            : null,
          statut: jalonStatut,
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
  }

  // ── Workstream ─────────────────────────────────────
  if (request.entityType === WORKFLOW_ENTITY.WORKSTREAM) {
    if (request.operation === WORKFLOW_OPERATION.CREATE) {
      const nv = asRecord(request.newValues);
      if (!nv) throw new Error("Valeurs proposées manquantes.");
      const jalonId = String(nv.jalonId ?? "");
      if (!jalonId) throw new Error("Jalon parent manquant.");
      const jalon = await prisma.jalon.findUnique({
        where: { id: jalonId },
        select: { nom: true },
      });
      const wsStatut = String(nv.statut ?? "Planifié");
      const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");
      const wsDateReelle = resolvePlanningDateReelle({
        statut: wsStatut,
        dateReelle:
          nv.date_reelle != null ? String(nv.date_reelle) : null,
      });
      const created = await prisma.workstream.create({
        data: {
          jalonId,
          nom: String(nv.nom ?? ""),
          ordre: Number(nv.ordre ?? 0),
          description: String(nv.description ?? ""),
          date_debut: optionalIsoDate(nv.date_debut),
          date_fin: optionalIsoDate(nv.date_fin),
          date_reelle: optionalIsoDate(wsDateReelle),
          statut: wsStatut,
          commentaire: String(nv.commentaire ?? ""),
        },
      });
      return {
        entityId: created.id,
        entityLabel: buildWorkstreamEntityLabel(
          jalon?.nom ?? "",
          created.nom
        ),
      };
    }
    if (request.operation === WORKFLOW_OPERATION.UPDATE) {
      if (!request.entityId) throw new Error("Workstream cible manquant.");
      const nv = asRecord(request.newValues);
      if (!nv) throw new Error("Valeurs proposées manquantes.");
      const existingWs = await prisma.workstream.findUnique({
        where: { id: request.entityId },
        select: { date_reelle: true },
      });
      const wsStatutUp = String(nv.statut ?? "Planifié");
      if (wsStatutUp === "Atteint") {
        const { assertWorkstreamCanBeAtteint } = await import(
          "@/lib/planning-status-assert"
        );
        await assertWorkstreamCanBeAtteint(request.entityId);
      }
      const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");
      const wsDateReelleUp = resolvePlanningDateReelle({
        statut: wsStatutUp,
        dateReelle:
          nv.date_reelle != null ? String(nv.date_reelle) : null,
        previousDateReelle: existingWs?.date_reelle,
      });
      const updated = await prisma.workstream.update({
        where: { id: request.entityId },
        data: {
          nom: String(nv.nom ?? ""),
          ordre: Number(nv.ordre ?? 0),
          description: String(nv.description ?? ""),
          date_debut: optionalIsoDate(nv.date_debut),
          date_fin: optionalIsoDate(nv.date_fin),
          date_reelle: optionalIsoDate(wsDateReelleUp),
          statut: wsStatutUp,
          commentaire: String(nv.commentaire ?? ""),
        },
        include: { jalon: { select: { nom: true } } },
      });
      return {
        entityId: updated.id,
        entityLabel: buildWorkstreamEntityLabel(updated.jalon.nom, updated.nom),
      };
    }
    if (request.operation === WORKFLOW_OPERATION.DELETE) {
      if (!request.entityId) throw new Error("Workstream cible manquant.");
      const existing = await prisma.workstream.findUnique({
        where: { id: request.entityId },
        include: { jalon: { select: { nom: true } } },
      });
      if (!existing) {
        const ov = asRecord(request.oldValues);
        return {
          entityId: request.entityId,
          entityLabel: buildWorkstreamEntityLabel(
            "",
            String(ov?.nom ?? "")
          ),
        };
      }
      await prisma.workstream.delete({ where: { id: request.entityId } });
      return {
        entityId: existing.id,
        entityLabel: buildWorkstreamEntityLabel(
          existing.jalon.nom,
          existing.nom
        ),
      };
    }
  }

  // ── Activité ───────────────────────────────────────
  if (request.entityType === WORKFLOW_ENTITY.ACTIVITE) {
    if (request.operation === WORKFLOW_OPERATION.CREATE) {
      const nv = asRecord(request.newValues);
      if (!nv) throw new Error("Valeurs proposées manquantes.");
      const workstreamId = String(nv.workstreamId ?? "");
      if (!workstreamId) throw new Error("Workstream parent manquant.");
      const ws = await prisma.workstream.findUnique({
        where: { id: workstreamId },
        select: { nom: true },
      });
      const actStatut = String(nv.statut ?? "Planifié");
      const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");
      const actDateReelle = resolvePlanningDateReelle({
        statut: actStatut,
        dateReelle:
          nv.date_reelle != null ? String(nv.date_reelle) : null,
      });
      const created = await prisma.activite.create({
        data: {
          workstreamId,
          nom: String(nv.nom ?? ""),
          ordre: Number(nv.ordre ?? 0),
          description: String(nv.description ?? ""),
          date_debut: optionalIsoDate(nv.date_debut),
          date_fin: optionalIsoDate(nv.date_fin),
          date_reelle: optionalIsoDate(actDateReelle),
          statut: actStatut,
          commentaire: String(nv.commentaire ?? ""),
        },
      });
      return {
        entityId: created.id,
        entityLabel: buildActiviteEntityLabel(ws?.nom ?? "", created.nom),
      };
    }
    if (request.operation === WORKFLOW_OPERATION.UPDATE) {
      if (!request.entityId) throw new Error("Activité cible manquante.");
      const nv = asRecord(request.newValues);
      if (!nv) throw new Error("Valeurs proposées manquantes.");
      const existingAct = await prisma.activite.findUnique({
        where: { id: request.entityId },
        select: { date_reelle: true },
      });
      const actStatutUp = String(nv.statut ?? "Planifié");
      const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");
      const actDateReelleUp = resolvePlanningDateReelle({
        statut: actStatutUp,
        dateReelle:
          nv.date_reelle != null ? String(nv.date_reelle) : null,
        previousDateReelle: existingAct?.date_reelle,
      });
      const updated = await prisma.activite.update({
        where: { id: request.entityId },
        data: {
          nom: String(nv.nom ?? ""),
          ordre: Number(nv.ordre ?? 0),
          description: String(nv.description ?? ""),
          date_debut: optionalIsoDate(nv.date_debut),
          date_fin: optionalIsoDate(nv.date_fin),
          date_reelle: optionalIsoDate(actDateReelleUp),
          statut: actStatutUp,
          commentaire: String(nv.commentaire ?? ""),
        },
        include: { workstream: { select: { nom: true } } },
      });
      return {
        entityId: updated.id,
        entityLabel: buildActiviteEntityLabel(
          updated.workstream.nom,
          updated.nom
        ),
      };
    }
    if (request.operation === WORKFLOW_OPERATION.DELETE) {
      if (!request.entityId) throw new Error("Activité cible manquante.");
      const existing = await prisma.activite.findUnique({
        where: { id: request.entityId },
        include: { workstream: { select: { nom: true } } },
      });
      if (!existing) {
        const ov = asRecord(request.oldValues);
        return {
          entityId: request.entityId,
          entityLabel: buildActiviteEntityLabel("", String(ov?.nom ?? "")),
        };
      }
      await prisma.activite.delete({ where: { id: request.entityId } });
      return {
        entityId: existing.id,
        entityLabel: buildActiviteEntityLabel(
          existing.workstream.nom,
          existing.nom
        ),
      };
    }
  }

  // ── Question Q&A (consultation) ────────────────────
  if (request.entityType === WORKFLOW_ENTITY.CONSULTATION_QUESTION) {
    const { formatQaWorkflowLabel } = await import("@/lib/workflow-shared");
    if (request.operation === WORKFLOW_OPERATION.CREATE) {
      const nv = asRecord(request.newValues);
      if (!nv) throw new Error("Valeurs proposées manquantes.");
      const chantierId = String(nv.chantierId ?? request.chantierId ?? "");
      if (!chantierId) throw new Error("Chantier manquant.");
      const echeance = optionalIsoDate(nv.echeance);
      const echeanceActu =
        optionalIsoDate(nv.echeance_actualisee) ?? echeance;
      const statut = String(nv.statut ?? "Ouverte");
      const closed = statut === "Résolue" || statut === "Abandonnée";
      const resolution = String(nv.resolution ?? "").trim();
      if (closed && !resolution) {
        throw new Error(
          "La réponse est obligatoire pour un statut Résolue ou Abandonnée."
        );
      }
      const created = await prisma.consultationQuestion.create({
        data: {
          chantierId,
          dossier_ref: String(nv.dossier_ref ?? ""),
          question: String(nv.question ?? ""),
          categorie: String(nv.categorie ?? "Générale"),
          priorite: String(nv.priorite ?? "Moyenne"),
          statut,
          remontee_par: String(nv.remontee_par ?? ""),
          affectee_a: String(nv.affectee_a ?? ""),
          echeance,
          echeance_actualisee: echeanceActu,
          date_fin_reelle: closed
            ? optionalIsoDate(nv.date_fin_reelle) ?? new Date()
            : null,
          resolution,
        },
      });
      return {
        entityId: created.id,
        entityLabel: formatQaWorkflowLabel({
          newValues: nv,
          entityLabel: created.question,
        }),
      };
    }
    if (request.operation === WORKFLOW_OPERATION.UPDATE) {
      if (!request.entityId) throw new Error("Question cible manquante.");
      const nv = asRecord(request.newValues);
      if (!nv) throw new Error("Valeurs proposées manquantes.");
      const existingQa = await prisma.consultationQuestion.findUnique({
        where: { id: request.entityId },
      });
      if (!existingQa) throw new Error("Question cible introuvable.");
      const statut = String(nv.statut ?? "Ouverte");
      const closed = statut === "Résolue" || statut === "Abandonnée";
      const resolution = String(nv.resolution ?? "").trim();
      if (closed && !resolution) {
        throw new Error(
          "La réponse est obligatoire pour un statut Résolue ou Abandonnée."
        );
      }
      const wasClosed =
        existingQa.statut === "Résolue" || existingQa.statut === "Abandonnée";
      const dateFin = !closed
        ? null
        : wasClosed && existingQa.date_fin_reelle
          ? existingQa.date_fin_reelle
          : optionalIsoDate(nv.date_fin_reelle) ?? new Date();
      // Texte de la question non modifiable via workflow : conserver l'existant
      const updated = await prisma.consultationQuestion.update({
        where: { id: request.entityId },
        data: {
          chantierId: String(nv.chantierId ?? request.chantierId ?? ""),
          dossier_ref: String(nv.dossier_ref ?? ""),
          question: existingQa.question,
          categorie: String(nv.categorie ?? "Générale"),
          priorite: String(nv.priorite ?? "Moyenne"),
          statut,
          remontee_par: String(nv.remontee_par ?? ""),
          affectee_a: String(nv.affectee_a ?? ""),
          // échéance initiale immuable
          echeance_actualisee:
            optionalIsoDate(nv.echeance_actualisee) ??
            existingQa.echeance_actualisee ??
            existingQa.echeance,
          date_fin_reelle: dateFin,
          resolution,
        },
      });
      return {
        entityId: updated.id,
        entityLabel: formatQaWorkflowLabel({
          newValues: nv,
          entityLabel: updated.question,
        }),
      };
    }
    if (request.operation === WORKFLOW_OPERATION.DELETE) {
      if (!request.entityId) throw new Error("Question cible manquante.");
      const existing = await prisma.consultationQuestion.findUnique({
        where: { id: request.entityId },
      });
      if (!existing) {
        return {
          entityId: request.entityId,
          entityLabel: formatQaWorkflowLabel({
            oldValues: request.oldValues,
          }),
        };
      }
      await prisma.consultationQuestion.delete({
        where: { id: request.entityId },
      });
      return {
        entityId: existing.id,
        entityLabel: formatQaWorkflowLabel({
          oldValues: {
            dossier_ref: existing.dossier_ref,
            question: existing.question,
          },
        }),
      };
    }
  }

  throw new Error("Type d'objet ou opération non supporté pour exécution.");
}

function revalidateWorkflowPaths(chantierId?: string | null) {
  revalidatePath("/workflow/demandes");
  revalidatePath("/workflow/historique");
  revalidatePath("/workflow/dashboard");
  revalidatePath("/jalons");
  revalidatePath("/consultation-backlog");
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
  // Include jalon / workstream / activité + Q&A consultation requests
  const rowsAll = await listWorkflowRequests({
    status: filters?.status,
    operation: filters?.operation,
    chantierId: filters?.chantierId,
    pendingOnly: filters?.pendingOnly,
    ...(isValidator ? {} : { requesterId: session.userId }),
  });
  const supportedTypes = new Set<string>([
    WORKFLOW_ENTITY.JALON,
    WORKFLOW_ENTITY.WORKSTREAM,
    WORKFLOW_ENTITY.ACTIVITE,
    WORKFLOW_ENTITY.CONSULTATION_QUESTION,
  ]);
  const rows = rowsAll.filter((r) => supportedTypes.has(r.entityType));

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
    executePlanningFromRequest,
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
