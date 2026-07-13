"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, type SessionData } from "@/lib/auth";
import {
  canAssignRaid,
  canCollaborateOnRaid,
  canMoveRaidOnKanban,
  getActorDisplay,
  getKanbanMoveContext,
  requireRaidViewAccess,
  writeRaidAudit,
} from "@/lib/raid-collaboration";
import { resolveRaidEquipeId } from "@/lib/equipe-chantier";

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
  return prisma.raid.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      intitule: true,
      statut: true,
      responsable: true,
      responsableRessourceId: true,
      equipeId: true,
      chantierId: true,
    },
  });
}

/**
 * If unassigned, claim the ticket for the current user (except pure comments).
 */
async function ensureAssignedIfNeeded(
  session: SessionData,
  raid: {
    id: string;
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
      raidComments: {
        orderBy: { createdAt: "asc" },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!raid) return null;

  const canCollaborate = await canCollaborateOnRaid(session, raid);
  const canAssign = await canAssignRaid(session, raid);

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

  return {
    raid,
    canCollaborate,
    canAssign,
    currentUser: {
      userId: session.userId,
      ressourceId: session.ressourceId,
      displayName: actor.actorName,
    },
  };
}

export async function addRaidComment(raidId: string, body: string) {
  const session = await requireAuth();
  const text = body.trim();
  if (!text) throw new Error("Le commentaire ne peut pas être vide.");

  const raid = await loadRaidForCollab(raidId);
  if (!raid) throw new Error("Entrée RAID introuvable.");

  const allowed = await canCollaborateOnRaid(session, raid);
  // Comments: allow if collaborator OR has view access on chantier/assigned scope
  // User asked: comment does NOT require auto-assign; still need collab access
  if (!allowed) {
    throw new Error("Vous n'avez pas accès pour commenter cette entrée RAID.");
  }

  // No auto-assign for comments
  const actor = await getActorDisplay(session);
  const comment = await prisma.raidComment.create({
    data: {
      raidId,
      body: text,
      is_system: false,
      authorUserId: actor.actorUserId,
      authorName: actor.actorName,
      authorRessourceId: actor.actorRessourceId,
    },
  });

  await writeRaidAudit({
    raidId,
    action: "commented",
    field: "comment",
    newValue: text.slice(0, 200),
    summary: `${actor.actorName} a ajouté un commentaire`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });

  revalidateRaid(raidId, raid.chantierId);
  return comment;
}

async function applyRaidStatusChange(
  session: SessionData,
  raid: {
    id: string;
    statut: string;
    responsableRessourceId: string | null;
    responsable: string;
    chantierId: string | null;
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

  const actor = await getActorDisplay(session);

  await prisma.raid.update({
    where: { id: raid.id },
    data: { statut },
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

  await writeRaidAudit({
    raidId: raid.id,
    action: "status_changed",
    field: "statut",
    oldValue: oldStatut,
    newValue: statut,
    summary: `Statut : « ${oldStatut || "—"} » → « ${statut} » — ${actor.actorName}`,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
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

export async function assignRaidToRessource(
  raidId: string,
  ressourceId: string | null
) {
  const session = await requireAuth();
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
    revalidateRaid(raidId, raid.chantierId);
    return;
  }

  const target = await prisma.ressource.findUnique({
    where: { id: ressourceId },
    select: {
      id: true,
      nom_complet: true,
    },
  });
  if (!target) throw new Error("Ressource introuvable.");

  // Team linked to RAID: same resolveRaidEquipeId rule (unchanged)
  const team = await resolveRaidEquipeId({
    responsableRessourceId: target.id,
    chantierId: raid.chantierId,
  });
  await prisma.raid.update({
    where: { id: raidId },
    data: {
      responsableRessourceId: target.id,
      responsable: target.nom_complet,
      equipeId: team.equipeId,
    },
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

  revalidateRaid(raidId, raid.chantierId);
}

export async function autoAssignRaidToMe(raidId: string) {
  const session = await requireAuth();
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

  revalidateRaid(raidId, raid.chantierId);
}
