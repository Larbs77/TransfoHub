"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requirePageWrite,
  requireRaidWriteOrAssignee,
  type SessionData,
} from "@/lib/auth";
import { getRoleByCode, roleCanWritePage } from "@/lib/roles";
import { isRaidAssignee } from "@/lib/raid-labels";
import {
  canAssignRaid,
  canCollaborateOnRaid,
  canEditRaidForm,
  canMoveRaidOnKanban,
  formatChantierAuditLabel,
  getActorDisplay,
  getKanbanMoveContext,
  requireRaidViewAccess,
  writeRaidAudit,
} from "@/lib/raid-collaboration";
import { applyMentionTokens } from "@/lib/raid-mentions";
import {
  isRaidSharedWithSession,
  listRaidMentionCandidates,
  listRaidShareTargets,
} from "@/lib/raid-share";
import { EQUIPE_TYPES } from "@/lib/equipe-types";
import { resolveRaidEquipeId } from "@/lib/equipe-chantier";
import {
  governanceComiteInfo,
  isChantierAssignedScope,
  loadRaidAssignmentContext,
  resolveAssignChantierTarget,
} from "@/lib/raid-assign";
import {
  notifyRaidAssigned,
  notifyRaidChanged,
  notifyRaidMentions,
  notifyRaidShared,
} from "@/lib/notifications";

function revalidateRaid(id: string, chantierId?: string | null) {
  revalidatePath("/raid");
  revalidatePath(`/raid/${id}`);
  revalidatePath("/");
  revalidatePath("/chantiers");
  revalidatePath("/comites");
  revalidatePath("/mon-tableau-de-bord");
  if (chantierId) revalidatePath(`/chantiers/${chantierId}`);
}

async function loadRaidForCollab(id: string) {
  const raid = await prisma.raid.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      type: true,
      intitule: true,
      statut: true,
      responsable: true,
      responsableRessourceId: true,
      equipeId: true,
      chantierId: true,
      comiteId: true,
      categorie: true,
      date_echeance: true,
      deletedAt: true,
    },
  });
  if (raid?.deletedAt) {
    throw new Error(
      "Cette entrée RAID est supprimée : restaurez-la avant de la modifier."
    );
  }
  return raid;
}

/**
 * If unassigned, claim the ticket for the current user (except pure comments).
 */
async function ensureAssignedIfNeeded(
  session: SessionData,
  raid: {
    id: string;
    code?: string;
    intitule?: string;
    responsableRessourceId: string | null;
    responsable: string;
    chantierId: string | null;
  },
  opts: { skipIfCommentOnly: boolean }
): Promise<void> {
  if (opts.skipIfCommentOnly) return;
  if (raid.responsableRessourceId) return;
  if (!session.ressourceId) {
    throw new Error(
      "Votre compte n'est lié à aucune ressource : impossible de s'auto-assigner."
    );
  }

  const actor = await getActorDisplay(session);
  const team = await resolveRaidEquipeId({
    responsableRessourceId: session.ressourceId,
    chantierId: raid.chantierId,
  });
  const res = await prisma.ressource.findUnique({
    where: { id: session.ressourceId },
    select: { nom_complet: true },
  });
  const nom = res?.nom_complet?.trim() || actor.actorName;

  await prisma.raid.update({
    where: { id: raid.id },
    data: {
      responsableRessourceId: session.ressourceId,
      responsable: nom,
      equipeId: team.equipeId,
    },
  });

  // Keep in-memory raid in sync for subsequent status logic
  raid.responsableRessourceId = session.ressourceId;
  raid.responsable = nom;

  const teamHint = team.equipeName
    ? ` · ${team.kind === "fonctionnelle" ? "équipe chantier" : "équipe institutionnelle"} « ${team.equipeName} »`
    : "";
  await writeRaidAudit({
    raidId: raid.id,
    action: "auto_assigned",
    field: "responsableRessourceId",
    oldValue: "",
    newValue: nom,
    summary: `Auto-assignation à ${nom} (action collaborative)${teamHint}`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });
  // Leadership notified by the parent action (status change) to avoid double notify.
}

export async function getRaidDetail(id: string) {
  const session = await requireAuth();

  const raid = await prisma.raid.findUnique({
    where: { id },
    include: {
      chantier: { select: { id: true, code: true, nom: true, domaine: true } },
      comite: {
        select: { id: true, instance: true, numero: true, date: true },
      },
      responsableRessource: {
        select: {
          id: true,
          nom_complet: true,
          organisation: true,
          email: true,
          equipeHierarchie: { select: { id: true, name: true } },
        },
      },
      equipe: { select: { id: true, name: true, type: true } },
      risqueLie: { select: { id: true, code: true, intitule: true } },
      actionsLiees: {
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          description: true,
          intitule: true,
          statut: true,
        },
        orderBy: { code: "asc" },
      },
      partages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          equipeId: true,
          sharedByName: true,
          createdAt: true,
          equipe: {
            select: {
              id: true,
              name: true,
              type: true,
              chantier: { select: { id: true, code: true, nom: true } },
            },
          },
        },
      },
      raidComments: {
        orderBy: { createdAt: "asc" },
        include: {
          mentions: {
            select: {
              ressourceId: true,
              ressource: { select: { id: true, nom_complet: true } },
            },
          },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!raid) return null;

  const role = await getRoleByCode(session.role);
  const raidPageWrite = roleCanWritePage(role, "/raid");
  const assigned = isRaidAssignee(
    session.ressourceId,
    raid.responsableRessourceId
  );
  const collaborate = await canCollaborateOnRaid(session, raid);
  const canCollaborate = (raidPageWrite || assigned) && collaborate;
  const canAssign = raidPageWrite && (await canAssignRaid(session, raid));
  const sharedWithMe = await isRaidSharedWithSession(session, raid);
  const canComment = !raid.deletedAt && (canCollaborate || sharedWithMe);
  const canEdit =
    !raid.deletedAt &&
    (raidPageWrite || assigned) &&
    (await canEditRaidForm(session, raid));
  const canShare =
    !raid.deletedAt && !!raid.chantierId && (await canAssignRaid(session, raid));
  const accessViaShareOnly = sharedWithMe && !collaborate && !canAssign;

  // Allow view if page/role grants access OR user can manage (assignee / institutional peers / chantier)
  let canView = canCollaborate || canAssign;
  if (!canView) {
    try {
      await requireRaidViewAccess(session);
      canView = true;
    } catch {
      canView = false;
    }
  }
  if (!canView) {
    throw new Error("Accès à cette entrée RAID non autorisé");
  }

  const actor = await getActorDisplay(session);
  const [mentionCandidates, shareTargets] = await Promise.all([
    listRaidMentionCandidates(raid),
    canShare ? listRaidShareTargets(raid) : Promise.resolve([]),
  ]);

  return {
    raid,
    canCollaborate,
    canAssign,
    canEdit,
    canComment,
    canShare,
    accessViaShareOnly,
    mentionCandidates,
    shareTargets,
    currentUser: {
      userId: session.userId,
      ressourceId: session.ressourceId,
      displayName: actor.actorName,
    },
  };
}

async function assertCanComment(
  session: SessionData,
  raid: {
    id: string;
    responsableRessourceId: string | null;
    chantierId: string | null;
    equipeId: string | null;
    categorie: string;
  }
) {
  const collab = await canCollaborateOnRaid(session, raid);
  const shared = await isRaidSharedWithSession(session, raid);
  if (collab) {
    try {
      await requireRaidWriteOrAssignee(raid);
      return;
    } catch (err) {
      if (!shared) throw err;
    }
  }
  if (shared) {
    await requireRaidViewAccess(session);
    return;
  }
  throw new Error("Vous n'avez pas accès pour commenter cette entrée RAID.");
}

export async function addRaidComment(
  raidId: string,
  body: string,
  mentionIds: string[] = []
) {
  const session = await requireAuth();
  const text = body.trim();
  if (!text) throw new Error("Le commentaire ne peut pas être vide.");

  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");
  await assertCanComment(session, raid);

  const candidates = await listRaidMentionCandidates(raid);
  const requested = new Set(mentionIds);
  const picked = candidates.filter((c) => requested.has(c.id));
  const stored = applyMentionTokens(text, picked);

  // No auto-assign for comments
  const actor = await getActorDisplay(session);
  const comment = await prisma.raidComment.create({
    data: {
      raidId,
      body: stored.body,
      is_system: false,
      authorUserId: actor.actorUserId,
      authorName: actor.actorName,
      authorRessourceId: actor.actorRessourceId,
      mentions:
        stored.ids.length > 0
          ? {
              create: stored.ids.map((ressourceId) => ({ ressourceId })),
            }
          : undefined,
    },
  });

  await writeRaidAudit({
    raidId,
    action: "commented",
    field: "comment",
    newValue: text.slice(0, 500),
    summary: `${actor.actorName} a ajouté un commentaire`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });

  await notifyRaidChanged({
    raidId,
    code: raid.code,
    intitule: raid.intitule,
    chantierId: raid.chantierId,
    summary: `Nouveau commentaire de ${actor.actorName}`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    sendMail: stored.ids.length === 0,
  });

  if (stored.ids.length > 0) {
    await notifyRaidMentions({
      raidId,
      code: raid.code,
      intitule: raid.intitule,
      ressourceIds: stored.ids,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
  }

  revalidateRaid(raidId, raid.chantierId);
  return comment;
}

export async function shareRaidWithEquipes(raidId: string, equipeIds: string[]) {
  const session = await requireAuth();
  const unique = [...new Set(equipeIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) throw new Error("Sélectionnez au moins une équipe.");

  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");
  if (!raid.chantierId) {
    throw new Error(
      "Le partage concerne les équipes chantier : rattachez d'abord un chantier."
    );
  }
  if (!(await canAssignRaid(session, raid))) {
    throw new Error(
      "Partage réservé à l'Admin, au Bureau Programme, ou au Directeur / Suppléant / PMO du chantier."
    );
  }

  const targets = await listRaidShareTargets(raid);
  const allowed = new Map(targets.map((t) => [t.id, t]));
  const chosen = unique.filter((id) => allowed.has(id));
  if (chosen.length === 0) {
    throw new Error("Aucune équipe valide à partager.");
  }

  const actor = await getActorDisplay(session);
  for (const equipeId of chosen) {
    const target = allowed.get(equipeId)!;
    await prisma.raidPartage.create({
      data: {
        raidId,
        equipeId,
        sharedByUserId: actor.actorUserId,
        sharedByName: actor.actorName,
      },
    });
    await writeRaidAudit({
      raidId,
      action: "shared",
      field: "partage",
      newValue: target.name,
      summary: `Partagé avec l'équipe « ${target.name} »`,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      actorRessourceId: actor.actorRessourceId,
    });
    const equipe = await prisma.equipe.findUnique({
      where: { id: equipeId },
      select: { chantierId: true, name: true },
    });
    if (equipe?.chantierId) {
      await notifyRaidShared({
        raidId,
        code: raid.code,
        intitule: raid.intitule,
        targetChantierId: equipe.chantierId,
        equipeName: equipe.name,
        actorUserId: actor.actorUserId,
        actorName: actor.actorName,
      });
    }
  }

  revalidateRaid(raidId, raid.chantierId);
}

export async function unshareRaidEquipe(raidId: string, equipeId: string) {
  const session = await requireAuth();
  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");
  if (!(await canAssignRaid(session, raid))) {
    throw new Error(
      "Retrait du partage réservé à l'Admin, au Bureau Programme, ou au Directeur / Suppléant / PMO du chantier."
    );
  }

  const partage = await prisma.raidPartage.findUnique({
    where: { raidId_equipeId: { raidId, equipeId } },
    include: {
      equipe: { select: { name: true, type: true, chantierId: true } },
    },
  });
  if (!partage) throw new Error("Ce partage n'existe pas.");
  if (partage.equipe.type !== EQUIPE_TYPES.fonctionnelle) {
    throw new Error("Seules les équipes fonctionnelles sont partagées.");
  }

  await prisma.raidPartage.delete({ where: { id: partage.id } });
  const actor = await getActorDisplay(session);
  await writeRaidAudit({
    raidId,
    action: "unshared",
    field: "partage",
    oldValue: partage.equipe.name,
    summary: `Partage retiré : équipe « ${partage.equipe.name} »`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });
  if (partage.equipe.chantierId) {
    await notifyRaidShared({
      raidId,
      code: raid.code,
      intitule: raid.intitule,
      targetChantierId: partage.equipe.chantierId,
      equipeName: partage.equipe.name,
      removed: true,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
  }
  revalidateRaid(raidId, raid.chantierId);
}

async function applyRaidStatusChange(
  session: SessionData,
  raid: {
    id: string;
    code?: string;
    type?: string;
    intitule?: string;
    statut: string;
    responsableRessourceId: string | null;
    responsable: string;
    chantierId: string | null;
    date_echeance?: Date | null;
  },
  statut: string,
  note: string,
  opts: { autoAssignIfNeeded: boolean }
) {
  if (opts.autoAssignIfNeeded) {
    await ensureAssignedIfNeeded(session, raid, { skipIfCommentOnly: false });
  }

  const oldStatut = raid.statut;
  if (oldStatut === statut) {
    throw new Error("Le statut est déjà à cette valeur.");
  }

  const { actionRequiresEcheance } = await import("@/lib/raid-labels");
  if (
    raid.type === "Action" &&
    actionRequiresEcheance(statut) &&
    !raid.date_echeance
  ) {
    throw new Error(
      "Renseignez d'abord une date d'échéance (ouvrir l'action) avant de quitter « A planifier »."
    );
  }

  const actor = await getActorDisplay(session);

  const { isRaidClosed } = await import("@/lib/raid-labels");
  const becomingClosed =
    isRaidClosed(statut) && !isRaidClosed(raid.statut);
  const reopening = !isRaidClosed(statut) && isRaidClosed(raid.statut);

  await prisma.raid.update({
    where: { id: raid.id },
    data: {
      statut,
      ...(becomingClosed
        ? { date_fin_reelle: new Date() }
        : reopening
          ? { date_fin_reelle: null }
          : {}),
    },
  });

  await prisma.raidComment.create({
    data: {
      raidId: raid.id,
      body: note,
      is_system: true,
      authorUserId: actor.actorUserId,
      authorName: actor.actorName,
      authorRessourceId: actor.actorRessourceId,
    },
  });

  const notePreview =
    note.length > 200 ? `${note.slice(0, 200)}…` : note;
  await writeRaidAudit({
    raidId: raid.id,
    action: "status_changed",
    field: "statut",
    oldValue: oldStatut,
    newValue: statut,
    summary: `Statut : « ${oldStatut || "—"} » → « ${statut} » — ${actor.actorName} — ${notePreview}`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });
  await writeRaidAudit({
    raidId: raid.id,
    action: "commented",
    field: "comment",
    newValue: note.slice(0, 500),
    summary: `${actor.actorName} a ajouté un commentaire (changement de statut)`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });

  await notifyRaidChanged({
    raidId: raid.id,
    code: raid.code,
    intitule: raid.intitule,
    chantierId: raid.chantierId,
    summary: `Statut : « ${oldStatut || "—"} » → « ${statut} »`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
  });

  revalidateRaid(raid.id, raid.chantierId);
}

export async function changeRaidStatus(
  raidId: string,
  newStatut: string,
  comment: string
) {
  const session = await requireAuth();
  const statut = newStatut.trim();
  const note = comment.trim();
  if (!statut) throw new Error("Statut obligatoire.");
  if (!note) {
    throw new Error(
      "Un commentaire est obligatoire lors d'un changement de statut."
    );
  }

  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");
  await requireRaidWriteOrAssignee(raid);

  const allowed = await canCollaborateOnRaid(session, raid);
  if (!allowed) throw new Error("Modification non autorisée sur cette entrée.");

  await applyRaidStatusChange(session, raid, statut, note, {
    autoAssignIfNeeded: true,
  });
}

/**
 * Kanban-only status move: assignee OR Directeur/suppléant/PMO on chantier team.
 * Mandatory comment. No auto-assign of unassigned cards (must be assignee or leader).
 */
export async function changeRaidKanbanStatus(
  raidId: string,
  newStatut: string,
  comment: string
) {
  const session = await requireAuth();
  const statut = newStatut.trim();
  const note = comment.trim();
  if (!statut) throw new Error("Statut obligatoire.");
  if (!note) {
    throw new Error(
      "Un commentaire est obligatoire pour déplacer une carte sur le Kanban."
    );
  }

  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");
  await requireRaidWriteOrAssignee(raid);

  const allowed = await canMoveRaidOnKanban(session, raid);
  if (!allowed) {
    throw new Error(
      "Déplacement non autorisé : l'action doit vous être assignée, ou vous devez être Directeur de chantier, suppléant ou PMO de l'équipe chantier."
    );
  }

  await applyRaidStatusChange(session, raid, statut, note, {
    autoAssignIfNeeded: false,
  });
}

/** Context for client Kanban (who can drag which cards). */
export async function fetchKanbanMoveContext() {
  const session = await requireAuth();
  return getKanbanMoveContext(session);
}

export async function getRaidAssignmentContext(raidId: string) {
  const session = await requirePageWrite("/raid");
  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");
  const allowed = await canAssignRaid(session, raid);
  if (!allowed) {
    throw new Error(
      "Réaffectation non autorisée : réservée à l'Admin, au Bureau Programme, ou au Directeur / Suppléant / PMO du chantier lié."
    );
  }
  return loadRaidAssignmentContext({
    session,
    chantierId: raid.chantierId,
    comiteId: raid.comiteId,
  });
}

export async function assignRaidToRessource(
  raidId: string,
  ressourceId: string | null,
  requestedChantierId?: string | null
) {
  const session = await requirePageWrite("/raid");
  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");

  // Strict assign/reassign rights (Admin / Bureau Programme / DC-Suppléant-PMO chantier)
  const allowed = await canAssignRaid(session, raid);
  if (!allowed) {
    throw new Error(
      "Réaffectation non autorisée : réservée à l'Admin, au Bureau Programme, ou au Directeur / Suppléant / PMO du chantier lié."
    );
  }

  const actor = await getActorDisplay(session);
  const prevName = raid.responsable || "—";

  if (!ressourceId) {
    await prisma.raid.update({
      where: { id: raidId },
      data: {
        responsableRessourceId: null,
        responsable: "",
        equipeId: null,
      },
    });
    await writeRaidAudit({
      raidId,
      action: "unassigned",
      field: "responsableRessourceId",
      oldValue: prevName,
      newValue: "",
      summary: `Désassignation (était ${prevName}) par ${actor.actorName}`,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      actorRessourceId: actor.actorRessourceId,
    });
    await notifyRaidChanged({
      raidId,
      code: raid.code,
      intitule: raid.intitule,
      chantierId: raid.chantierId,
      summary: `Désassignation (était ${prevName})`,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
    revalidateRaid(raidId, raid.chantierId);
    return;
  }

  const target = await prisma.ressource.findUnique({
    where: { id: ressourceId },
    select: {
      id: true,
      nom_complet: true,
      membres: { select: { chantierId: true } },
    },
  });
  if (!target) throw new Error("Ressource introuvable.");

  const [restricted, gov] = await Promise.all([
    isChantierAssignedScope(session),
    governanceComiteInfo(raid.comiteId),
  ]);
  const targetChantier = resolveAssignChantierTarget({
    restricted,
    governance: gov.governance,
    governanceLabel: gov.label,
    currentChantierId: raid.chantierId,
    requestedChantierId,
    memberChantierIds: target.membres.map((m) => m.chantierId),
  });

  const team = await resolveRaidEquipeId({
    responsableRessourceId: target.id,
    chantierId: targetChantier.chantierId,
  });

  let droppedShare = false;
  await prisma.$transaction(async (tx) => {
    await tx.raid.update({
      where: { id: raidId },
      data: {
        responsableRessourceId: target.id,
        responsable: target.nom_complet,
        chantierId: targetChantier.chantierId,
        equipeId: team.equipeId,
      },
    });
    if (targetChantier.moved && team.equipeId) {
      const removed = await tx.raidPartage.deleteMany({
        where: { raidId, equipeId: team.equipeId },
      });
      droppedShare = removed.count > 0;
    }
  });

  const teamLabel = team.equipeName
    ? ` · ${team.kind === "fonctionnelle" ? "équipe chantier" : "équipe institutionnelle"} « ${team.equipeName} »`
    : "";
  await writeRaidAudit({
    raidId,
    action: "assigned",
    field: "responsableRessourceId",
    oldValue: prevName,
    newValue: target.nom_complet,
    summary: `Assigné à ${target.nom_complet}${teamLabel} par ${actor.actorName}`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });

  if (targetChantier.moved && targetChantier.chantierId) {
    const [fromChantier, toChantier] = await Promise.all([
      raid.chantierId
        ? prisma.chantier.findUnique({
            where: { id: raid.chantierId },
            select: { code: true, nom: true },
          })
        : Promise.resolve(null),
      prisma.chantier.findUnique({
        where: { id: targetChantier.chantierId },
        select: { code: true, nom: true },
      }),
    ]);
    await writeRaidAudit({
      raidId,
      action: "field_updated",
      field: "chantierId",
      oldValue: formatChantierAuditLabel(fromChantier),
      newValue: formatChantierAuditLabel(toChantier),
      summary: `Chantier modifié : ${formatChantierAuditLabel(fromChantier)} → ${formatChantierAuditLabel(toChantier)} par ${actor.actorName}`,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      actorRessourceId: actor.actorRessourceId,
    });
  }

  if (droppedShare) {
    await writeRaidAudit({
      raidId,
      action: "unshared",
      field: "partage",
      oldValue: team.equipeName ?? "",
      newValue: "",
      summary: `Partage retiré : l'équipe « ${team.equipeName ?? "chantier"} » devient l'équipe du RAID`,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      actorRessourceId: actor.actorRessourceId,
    });
  }

  const chantierMoveSummary = targetChantier.moved
    ? `Chantier modifié et assigné à ${target.nom_complet}`
    : `Assigné à ${target.nom_complet}`;

  await notifyRaidAssigned({
    raidId,
    code: raid.code,
    intitule: raid.intitule,
    assigneeRessourceId: target.id,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
  });
  await notifyRaidChanged({
    raidId,
    code: raid.code,
    intitule: raid.intitule,
    chantierId: raid.chantierId,
    summary: chantierMoveSummary,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    sendMail: false,
  });
  if (
    targetChantier.moved &&
    targetChantier.chantierId &&
    targetChantier.chantierId !== raid.chantierId
  ) {
    await notifyRaidChanged({
      raidId,
      code: raid.code,
      intitule: raid.intitule,
      chantierId: targetChantier.chantierId,
      summary: `RAID rattaché à ce chantier et assigné à ${target.nom_complet}`,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      sendMail: false,
    });
  }

  revalidateRaid(raidId, raid.chantierId);
  if (targetChantier.moved && targetChantier.chantierId) {
    revalidateRaid(raidId, targetChantier.chantierId);
  }
}

export async function autoAssignRaidToMe(raidId: string) {
  const session = await requirePageWrite("/raid");
  if (!session.ressourceId) {
    throw new Error(
      "Votre compte n'est lié à aucune ressource : impossible de s'assigner."
    );
  }

  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");

  // Auto-assign: collaboration access (unchanged) — claim for self
  const allowed = await canCollaborateOnRaid(session, raid);
  if (!allowed) throw new Error("Vous n'avez pas accès à cette entrée.");

  if (raid.responsableRessourceId === session.ressourceId) {
    return; // already mine
  }

  // If already assigned to someone else, only reassign actors may take over
  if (raid.responsableRessourceId) {
    const mayReassign = await canAssignRaid(session, raid);
    if (!mayReassign) {
      throw new Error(
        "Cette entrée est déjà assignée. Seuls l'Admin, le Bureau Programme ou le Directeur / Suppléant / PMO du chantier peuvent la réaffecter."
      );
    }
  }

  const actor = await getActorDisplay(session);
  const res = await prisma.ressource.findUnique({
    where: { id: session.ressourceId },
    select: {
      nom_complet: true,
    },
  });
  if (!res) throw new Error("Ressource introuvable.");

  const team = await resolveRaidEquipeId({
    responsableRessourceId: session.ressourceId,
    chantierId: raid.chantierId,
  });
  const prevName = raid.responsable || "—";
  await prisma.raid.update({
    where: { id: raidId },
    data: {
      responsableRessourceId: session.ressourceId,
      responsable: res.nom_complet,
      equipeId: team.equipeId,
    },
  });

  const teamLabel = team.equipeName
    ? ` · ${team.kind === "fonctionnelle" ? "équipe chantier" : "équipe institutionnelle"} « ${team.equipeName} »`
    : "";
  await writeRaidAudit({
    raidId,
    action: "auto_assigned",
    field: "responsableRessourceId",
    oldValue: prevName,
    newValue: res.nom_complet,
    summary: `${actor.actorName} s'est auto-assigné(e)${teamLabel}`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });

  // Self-assign: no assignee self-notify; leadership informed in-app only
  await notifyRaidChanged({
    raidId,
    code: raid.code,
    intitule: raid.intitule,
    chantierId: raid.chantierId,
    summary: `${actor.actorName} s'est auto-assigné(e)`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    sendMail: false,
  });

  revalidateRaid(raidId, raid.chantierId);
}
