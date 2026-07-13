import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/auth";
import { getRoleByCode } from "@/lib/roles";

export type RaidAuditAction =
  | "created"
  | "status_changed"
  | "assigned"
  | "auto_assigned"
  | "unassigned"
  | "commented"
  | "field_updated";

export {
  isRaidClosed,
  RAID_CLOSED_STATUTS,
  KANBAN_LEADERSHIP_ROLES,
  isKanbanLeadershipRole,
  canMoveRaidKanbanClient,
} from "@/lib/raid-labels";
import { isKanbanLeadershipRole } from "@/lib/raid-labels";

export async function getActorDisplay(session: SessionData): Promise<{
  actorUserId: string;
  actorName: string;
  actorRessourceId: string | null;
}> {
  let actorName = session.username;
  if (session.ressourceId) {
    const res = await prisma.ressource.findUnique({
      where: { id: session.ressourceId },
      select: { nom_complet: true },
    });
    if (res?.nom_complet?.trim()) actorName = res.nom_complet.trim();
  } else {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { first_name: true, last_name: true, username: true },
    });
    const full = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
    if (full) actorName = full;
    else if (user?.username) actorName = user.username;
  }
  return {
    actorUserId: session.userId,
    actorName,
    actorRessourceId: session.ressourceId,
  };
}

/** Institutional hierarchy team only (legacy helper name). */
export async function resolveEquipeIdFromRessource(
  ressourceId: string | null | undefined
): Promise<string | null> {
  if (!ressourceId) return null;
  const res = await prisma.ressource.findUnique({
    where: { id: ressourceId },
    select: {
      equipeHierarchieId: true,
      equipeHierarchie: { select: { type: true } },
    },
  });
  if (!res?.equipeHierarchieId) return null;
  if (
    res.equipeHierarchie?.type &&
    res.equipeHierarchie.type !== "institutionnelle"
  ) {
    return null;
  }
  return res.equipeHierarchieId;
}

/** Prefer resolveRaidEquipeId from lib/equipe-chantier for RAID assignment. */
export { resolveRaidEquipeId } from "@/lib/equipe-chantier";

export async function writeRaidAudit(params: {
  raidId: string;
  action: RaidAuditAction;
  summary: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  actorUserId?: string | null;
  actorName: string;
  actorRessourceId?: string | null;
  createdAt?: Date;
}) {
  return prisma.raidAuditLog.create({
    data: {
      raidId: params.raidId,
      action: params.action,
      field: params.field ?? "",
      oldValue: params.oldValue ?? "",
      newValue: params.newValue ?? "",
      summary: params.summary,
      actorUserId: params.actorUserId ?? null,
      actorName: params.actorName,
      actorRessourceId: params.actorRessourceId ?? null,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
    },
  });
}

export type RaidAccessShape = {
  responsableRessourceId: string | null;
  chantierId: string | null;
  equipeId: string | null;
};

/** Institutional Program Office team names (case-insensitive match). */
const PROGRAMME_OFFICE_EQUIPE_NAMES = [
  "bureau programme",
  "programme office",
  "bureau du programme",
];

/**
 * Admin role, Programme_Office role, or member of institutional "Bureau Programme".
 */
export async function isProgrammeLevelActor(
  session: SessionData
): Promise<boolean> {
  if (session.role === "Admin" || session.role === "Programme_Office") {
    return true;
  }
  if (!session.ressourceId) return false;
  const me = await prisma.ressource.findUnique({
    where: { id: session.ressourceId },
    select: {
      equipeHierarchie: { select: { name: true, type: true } },
    },
  });
  const name = me?.equipeHierarchie?.name?.trim().toLowerCase() ?? "";
  const type = me?.equipeHierarchie?.type ?? "institutionnelle";
  if (type !== "institutionnelle" && type !== "") return false;
  return PROGRAMME_OFFICE_EQUIPE_NAMES.some(
    (n) => name === n || name.includes(n)
  );
}

/**
 * Collaboration access (comment, status, auto-assign when unassigned):
 * - Admin / Bureau Programme
 * - Assignee (responsable ressource)
 * - Member of the linked chantier team (MembreEquipe)
 * - Same institutional team as the assignee
 * - Same derived RAID equipe (functional chantier team or institutional)
 */
export async function canCollaborateOnRaid(
  session: SessionData,
  raid: RaidAccessShape
): Promise<boolean> {
  if (await isProgrammeLevelActor(session)) {
    return true;
  }

  if (!session.ressourceId) return false;

  // Assigned to me
  if (raid.responsableRessourceId === session.ressourceId) return true;

  // On the same chantier team
  if (raid.chantierId) {
    const membre = await prisma.membreEquipe.findFirst({
      where: {
        chantierId: raid.chantierId,
        ressourceId: session.ressourceId,
      },
      select: { id: true },
    });
    if (membre) return true;
  }

  const me = await prisma.ressource.findUnique({
    where: { id: session.ressourceId },
    select: {
      equipeHierarchieId: true,
      equipesFonctionnelles: { select: { equipeId: true } },
    },
  });
  if (!me) return false;

  // Same institutional (hierarchy) team as the assignee — key when assignee
  // is outside the chantier team (RAID.equipeId = institutional).
  if (raid.responsableRessourceId && me.equipeHierarchieId) {
    const assignee = await prisma.ressource.findUnique({
      where: { id: raid.responsableRessourceId },
      select: { equipeHierarchieId: true },
    });
    if (
      assignee?.equipeHierarchieId &&
      assignee.equipeHierarchieId === me.equipeHierarchieId
    ) {
      return true;
    }
  }

  // Same derived RAID team (fonctionnelle or institutionnelle)
  if (raid.equipeId) {
    if (me.equipeHierarchieId === raid.equipeId) return true;
    if (me.equipesFonctionnelles.some((e) => e.equipeId === raid.equipeId)) {
      return true;
    }
  }

  return false;
}

/**
 * Assign / reassign permission (stricter than general collaboration):
 * - Admin and Programme Office (role or institutional team "Bureau Programme"): any RAID
 * - On a chantier: only Directeur de chantier, Suppléant, PMO for RAIDs linked to that chantier
 * Auto-assign (claim unassigned) stays on canCollaborateOnRaid.
 */
export async function canAssignRaid(
  session: SessionData,
  raid: RaidAccessShape
): Promise<boolean> {
  if (await isProgrammeLevelActor(session)) {
    return true;
  }

  if (!session.ressourceId) return false;
  if (!raid.chantierId) {
    // No chantier: only programme-level actors may reassign
    return false;
  }

  const membres = await prisma.membreEquipe.findMany({
    where: {
      chantierId: raid.chantierId,
      ressourceId: session.ressourceId,
    },
    select: { role: true, is_directeur: true },
  });

  return membres.some((m) => isKanbanLeadershipRole(m.role, m.is_directeur));
}

/**
 * Kanban / status-move permission:
 * - Assignee
 * - Admin / Bureau Programme
 * - Directeur de chantier, suppléant, or PMO on the RAID's chantier team
 * - Same institutional team as assignee (when RAID is institutional-scoped)
 */
export async function canMoveRaidOnKanban(
  session: SessionData,
  raid: {
    responsableRessourceId: string | null;
    chantierId: string | null;
    equipeId?: string | null;
  }
): Promise<boolean> {
  if (await isProgrammeLevelActor(session)) {
    return true;
  }
  if (!session.ressourceId) return false;

  if (raid.responsableRessourceId === session.ressourceId) return true;

  // Same institutional team as assignee (manage RAID routed to bank unit)
  const me = await prisma.ressource.findUnique({
    where: { id: session.ressourceId },
    select: { equipeHierarchieId: true },
  });
  if (me?.equipeHierarchieId) {
    if (raid.equipeId && raid.equipeId === me.equipeHierarchieId) {
      return true;
    }
    if (raid.responsableRessourceId) {
      const assignee = await prisma.ressource.findUnique({
        where: { id: raid.responsableRessourceId },
        select: { equipeHierarchieId: true },
      });
      if (
        assignee?.equipeHierarchieId &&
        assignee.equipeHierarchieId === me.equipeHierarchieId
      ) {
        return true;
      }
    }
  }

  if (!raid.chantierId) return false;

  const membres = await prisma.membreEquipe.findMany({
    where: {
      chantierId: raid.chantierId,
      ressourceId: session.ressourceId,
    },
    select: { role: true, is_directeur: true },
  });

  return membres.some((m) => isKanbanLeadershipRole(m.role, m.is_directeur));
}

/** Chantiers where the current user is Directeur / suppléant / PMO. */
export async function getLeadershipChantierIds(
  session: SessionData
): Promise<string[]> {
  if (!session.ressourceId) return [];
  const membres = await prisma.membreEquipe.findMany({
    where: { ressourceId: session.ressourceId },
    select: { chantierId: true, role: true, is_directeur: true },
  });
  const ids = new Set<string>();
  for (const m of membres) {
    if (isKanbanLeadershipRole(m.role, m.is_directeur)) {
      ids.add(m.chantierId);
    }
  }
  return [...ids];
}

/** Client context for Kanban drag permissions. */
export async function getKanbanMoveContext(session: SessionData): Promise<{
  ressourceId: string | null;
  isProgramme: boolean;
  leadershipChantierIds: string[];
  /** Institutional hierarchy team of the current user (for off-chantier RAID). */
  institutionalEquipeId: string | null;
}> {
  const isProgramme =
    session.role === "Admin" || session.role === "Programme_Office";
  let institutionalEquipeId: string | null = null;
  if (session.ressourceId) {
    const me = await prisma.ressource.findUnique({
      where: { id: session.ressourceId },
      select: { equipeHierarchieId: true },
    });
    institutionalEquipeId = me?.equipeHierarchieId ?? null;
  }
  return {
    ressourceId: session.ressourceId,
    isProgramme,
    leadershipChantierIds: isProgramme
      ? []
      : await getLeadershipChantierIds(session),
    institutionalEquipeId,
  };
}

/** Authenticated users with RAID-related pages may open the detail view. */
export async function requireRaidViewAccess(session: SessionData) {
  if (session.role === "Admin") return;
  if (
    session.role === "Programme_Office" ||
    session.role === "PMO_Chantier"
  ) {
    return;
  }
  const role = await getRoleByCode(session.role);
  if (role && role.is_active) {
    const pages = role.pages ?? [];
    if (
      pages.includes("/raid") ||
      pages.includes("/mon-tableau-de-bord") ||
      pages.includes("/chantiers") ||
      pages.includes("/comites")
    ) {
      return;
    }
  }
  throw new Error("Accès à cette entrée RAID non autorisé");
}
