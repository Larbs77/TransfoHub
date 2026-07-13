import { prisma } from "@/lib/prisma";
import { isKanbanLeadershipRole } from "@/lib/raid-labels";

export type NotificationType = "raid_assigned" | "raid_changed";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  entityType: string;
  entityId: string;
  readAt: Date | null;
  createdAt: Date;
};

/** Resolve active app user ids linked to these ressources. */
export async function userIdsForRessourceIds(
  ressourceIds: string[]
): Promise<string[]> {
  const unique = [...new Set(ressourceIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const users = await prisma.user.findMany({
    where: {
      ressourceId: { in: unique },
      is_active: true,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * App users who are Directeur / Suppléant / PMO on the chantier team
 * (same leadership detector as RAID assign rights).
 */
export async function getChantierLeadershipUserIds(
  chantierId: string | null | undefined
): Promise<string[]> {
  if (!chantierId) return [];
  const membres = await prisma.membreEquipe.findMany({
    where: { chantierId },
    select: {
      ressourceId: true,
      role: true,
      is_directeur: true,
    },
  });
  const ressourceIds = membres
    .filter(
      (m) =>
        !!m.ressourceId && isKanbanLeadershipRole(m.role, m.is_directeur)
    )
    .map((m) => m.ressourceId as string);
  return userIdsForRessourceIds(ressourceIds);
}

export async function createNotifications(params: {
  userIds: string[];
  type: NotificationType | string;
  title: string;
  message?: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  /** Do not notify this user (usually the actor). */
  excludeUserId?: string | null;
}): Promise<number> {
  const exclude = params.excludeUserId ?? null;
  const userIds = [...new Set(params.userIds)].filter(
    (id) => id && id !== exclude
  );
  if (userIds.length === 0) return 0;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message ?? "",
      href: params.href ?? "",
      entityType: params.entityType ?? "",
      entityId: params.entityId ?? "",
    })),
  });
  return userIds.length;
}

function raidLabel(code?: string | null, intitule?: string | null): string {
  const c = (code ?? "").trim();
  const t = (intitule ?? "").trim();
  if (c && t) return `${c} — ${t}`;
  if (c) return c;
  if (t) return t;
  return "entrée RAID";
}

function raidHref(raidId: string): string {
  return `/raid/${raidId}`;
}

/**
 * Notify the assignee's app user when they receive a RAID assignment.
 * Skips if no user account is linked to the ressource, or if assignee is the actor.
 */
export async function notifyRaidAssigned(params: {
  raidId: string;
  code?: string | null;
  intitule?: string | null;
  assigneeRessourceId: string | null | undefined;
  actorUserId?: string | null;
  actorName?: string;
}): Promise<void> {
  if (!params.assigneeRessourceId) return;
  const userIds = await userIdsForRessourceIds([params.assigneeRessourceId]);
  const label = raidLabel(params.code, params.intitule);
  const by = params.actorName?.trim()
    ? ` par ${params.actorName.trim()}`
    : "";
  await createNotifications({
    userIds,
    type: "raid_assigned",
    title: `Assignation RAID : ${label}`,
    message: `Vous avez été assigné(e) à ${label}${by}.`,
    href: raidHref(params.raidId),
    entityType: "raid",
    entityId: params.raidId,
    excludeUserId: params.actorUserId,
  });
}

/**
 * Notify Directeur / Suppléant / PMO of the linked chantier about a RAID change.
 * No-op if no chantier or no leadership users with accounts.
 */
export async function notifyRaidChanged(params: {
  raidId: string;
  code?: string | null;
  intitule?: string | null;
  chantierId: string | null | undefined;
  summary: string;
  actorUserId?: string | null;
  actorName?: string;
}): Promise<void> {
  if (!params.chantierId) return;
  const userIds = await getChantierLeadershipUserIds(params.chantierId);
  const label = raidLabel(params.code, params.intitule);
  const by = params.actorName?.trim()
    ? ` (${params.actorName.trim()})`
    : "";
  await createNotifications({
    userIds,
    type: "raid_changed",
    title: `RAID modifié : ${label}`,
    message: `${params.summary}${by}`.trim(),
    href: raidHref(params.raidId),
    entityType: "raid",
    entityId: params.raidId,
    excludeUserId: params.actorUserId,
  });
}

export async function listUserNotifications(
  userId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<AppNotification[]> {
  const limit = opts?.limit ?? 50;
  return prisma.notification.findMany({
    where: {
      userId,
      ...(opts?.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      href: true,
      entityType: true,
      entityId: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
