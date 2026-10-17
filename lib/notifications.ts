import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { isKanbanLeadershipRole } from "@/lib/raid-labels";
import { scheduleRaidEventMails } from "@/lib/raid-notification-mail";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type AppNotification,
  type AttentionTypeStats,
  type NotificationReadState,
  type NotificationType,
} from "@/lib/notification-labels";

export type {
  AppNotification,
  AttentionTypeStats,
  NotificationReadState,
  NotificationType,
};
export { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES };

export type ListNotificationsOpts = {
  readState?: NotificationReadState;
  type?: string;
  q?: string;
  since?: Date;
  limit?: number;
  offset?: number;
};

function notificationWhere(
  userId: string,
  opts?: ListNotificationsOpts
): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = { userId };
  if (opts?.readState === "unread") where.readAt = null;
  if (opts?.readState === "read") where.readAt = { not: null };
  if (opts?.type) where.type = opts.type;
  if (opts?.since) where.createdAt = { gte: opts.since };
  const q = opts?.q?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

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

/** PMO first, then Directeur, then suppléant — at most one user with an account. */
function leadershipMailRank(role: string, is_directeur?: boolean): number {
  const r = (role || "").trim().toLowerCase();
  if (/^pmo(\s|$|[-_])/.test(r) || r === "pmo") return 0;
  if (/suppl/.test(r)) return 2;
  if (is_directeur || /directeur\s+de\s+chantier/.test(r)) return 1;
  return 3;
}

export async function getPrimaryChantierLeadershipUserId(
  chantierId: string | null | undefined
): Promise<string | null> {
  if (!chantierId) return null;
  const membres = await prisma.membreEquipe.findMany({
    where: { chantierId },
    select: { ressourceId: true, role: true, is_directeur: true },
  });
  const ranked = membres
    .filter(
      (m) =>
        !!m.ressourceId && isKanbanLeadershipRole(m.role, m.is_directeur)
    )
    .sort(
      (a, b) =>
        leadershipMailRank(a.role, a.is_directeur) -
        leadershipMailRank(b.role, b.is_directeur)
    );
  for (const m of ranked) {
    const ids = await userIdsForRessourceIds([m.ressourceId as string]);
    if (ids[0]) return ids[0];
  }
  return null;
}

async function mailUserIdsForRaidChange(
  raidId: string,
  chantierId?: string | null
): Promise<string[]> {
  const raid = await prisma.raid.findUnique({
    where: { id: raidId },
    select: { responsableRessourceId: true, chantierId: true },
  });
  if (raid?.responsableRessourceId) {
    return userIdsForRessourceIds([raid.responsableRessourceId]);
  }
  const primary = await getPrimaryChantierLeadershipUserId(
    chantierId || raid?.chantierId
  );
  return primary ? [primary] : [];
}

async function raidNotifyContext(raidId: string): Promise<{
  chantierId: string;
  chantierCode: string;
  responsableRessourceId: string | null;
}> {
  const raid = await prisma.raid.findUnique({
    where: { id: raidId },
    select: {
      responsableRessourceId: true,
      chantier: { select: { id: true, code: true } },
    },
  });
  return {
    chantierId: raid?.chantier?.id ?? "",
    chantierCode: raid?.chantier?.code ?? "",
    responsableRessourceId: raid?.responsableRessourceId ?? null,
  };
}

async function filterRaidChangedRecipients(
  userIds: string[],
  assigneeRessourceId: string | null
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, ressourceId: true, notif_raid_changes: true },
  });
  return users
    .filter((u) => {
      if (u.notif_raid_changes !== "mine") return true;
      return (
        !!assigneeRessourceId && u.ressourceId === assigneeRessourceId
      );
    })
    .map((u) => u.id);
}

export async function createNotifications(params: {
  userIds: string[];
  type: NotificationType | string;
  title: string;
  message?: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  actorName?: string;
  chantierId?: string;
  chantierCode?: string;
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
      actorName: params.actorName ?? "",
      chantierId: params.chantierId ?? "",
      chantierCode: params.chantierCode ?? "",
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
  const title = `Assignation RAID : ${label}`;
  const message = `Vous avez été assigné(e) à ${label}${by}.`;
  const ctx = await raidNotifyContext(params.raidId);
  await createNotifications({
    userIds,
    type: "raid_assigned",
    title,
    message,
    href: raidHref(params.raidId),
    entityType: "raid",
    entityId: params.raidId,
    actorName: params.actorName?.trim() ?? "",
    chantierId: ctx.chantierId,
    chantierCode: ctx.chantierCode,
    excludeUserId: params.actorUserId,
  });
  scheduleRaidEventMails({
    userIds,
    excludeUserId: params.actorUserId,
    eventType: "raid_assigned",
    raidId: params.raidId,
    subject: title,
    body: message,
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
  /** In-app stays on leadership; set false to skip the e-mail (avoid duplicates). */
  sendMail?: boolean;
}): Promise<void> {
  if (!params.chantierId) return;
  const ctx = await raidNotifyContext(params.raidId);
  const leadershipIds = await getChantierLeadershipUserIds(params.chantierId);
  const userIds = await filterRaidChangedRecipients(
    leadershipIds,
    ctx.responsableRessourceId
  );
  const label = raidLabel(params.code, params.intitule);
  const by = params.actorName?.trim()
    ? ` (${params.actorName.trim()})`
    : "";
  const title = `RAID modifié : ${label}`;
  const message = `${params.summary}${by}`.trim();
  await createNotifications({
    userIds,
    type: "raid_changed",
    title,
    message,
    href: raidHref(params.raidId),
    entityType: "raid",
    entityId: params.raidId,
    actorName: params.actorName?.trim() ?? "",
    chantierId: ctx.chantierId || params.chantierId,
    chantierCode: ctx.chantierCode,
    excludeUserId: params.actorUserId,
  });
  if (params.sendMail === false) return;
  const mailUserIds = await mailUserIdsForRaidChange(
    params.raidId,
    params.chantierId
  );
  scheduleRaidEventMails({
    userIds: mailUserIds,
    excludeUserId: params.actorUserId,
    eventType: "raid_changed",
    raidId: params.raidId,
    subject: title,
    body: message,
  });
}

/** Notify Directeur / Suppléant / PMO of a team that just received (or lost) a share. */
export async function notifyRaidShared(params: {
  raidId: string;
  code?: string | null;
  intitule?: string | null;
  targetChantierId: string;
  equipeName: string;
  removed?: boolean;
  actorUserId?: string | null;
  actorName?: string;
}): Promise<void> {
  const userIds = await getChantierLeadershipUserIds(params.targetChantierId);
  const ctx = await raidNotifyContext(params.raidId);
  const target = await prisma.chantier.findUnique({
    where: { id: params.targetChantierId },
    select: { id: true, code: true },
  });
  const label = raidLabel(params.code, params.intitule);
  const by = params.actorName?.trim()
    ? ` par ${params.actorName.trim()}`
    : "";
  const removed = !!params.removed;
  const title = removed
    ? `Partage retiré : ${label}`
    : `RAID partagé : ${label}`;
  const message = removed
    ? `Le partage de ${label} avec « ${params.equipeName} » a été retiré${by}.`
    : `${label} a été partagé avec « ${params.equipeName} »${by}.`;
  await createNotifications({
    userIds,
    type: "raid_shared",
    title,
    message,
    href: raidHref(params.raidId),
    entityType: "raid",
    entityId: params.raidId,
    actorName: params.actorName?.trim() ?? "",
    chantierId: target?.id || ctx.chantierId,
    chantierCode: target?.code || ctx.chantierCode,
    excludeUserId: params.actorUserId,
  });
  const mailUserId = await getPrimaryChantierLeadershipUserId(
    params.targetChantierId
  );
  scheduleRaidEventMails({
    userIds: mailUserId ? [mailUserId] : [],
    excludeUserId: params.actorUserId,
    eventType: "raid_shared",
    raidId: params.raidId,
    subject: title,
    body: message,
  });
}

/** Notify app users linked to mentioned ressources. */
export async function notifyRaidMentions(params: {
  raidId: string;
  code?: string | null;
  intitule?: string | null;
  ressourceIds: string[];
  actorUserId?: string | null;
  actorName?: string;
}): Promise<void> {
  const userIds = await userIdsForRessourceIds(params.ressourceIds);
  const label = raidLabel(params.code, params.intitule);
  const by = params.actorName?.trim()
    ? ` par ${params.actorName.trim()}`
    : "";
  const title = `Mention RAID : ${label}`;
  const message = `Vous avez été mentionné(e) sur ${label}${by}.`;
  const ctx = await raidNotifyContext(params.raidId);
  await createNotifications({
    userIds,
    type: "raid_mention",
    title,
    message,
    href: raidHref(params.raidId),
    entityType: "raid",
    entityId: params.raidId,
    actorName: params.actorName?.trim() ?? "",
    chantierId: ctx.chantierId,
    chantierCode: ctx.chantierCode,
    excludeUserId: params.actorUserId,
  });
  scheduleRaidEventMails({
    userIds,
    excludeUserId: params.actorUserId,
    eventType: "raid_mention",
    raidId: params.raidId,
    subject: title,
    body: message,
  });
}

const NOTIF_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  href: true,
  entityType: true,
  entityId: true,
  actorName: true,
  chantierId: true,
  chantierCode: true,
  readAt: true,
  createdAt: true,
} as const;

export async function listUserNotifications(
  userId: string,
  opts?: ListNotificationsOpts & { unreadOnly?: boolean }
): Promise<AppNotification[]> {
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;
  const readState: NotificationReadState | undefined = opts?.unreadOnly
    ? "unread"
    : opts?.readState;
  return prisma.notification.findMany({
    where: notificationWhere(userId, { ...opts, readState }),
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: NOTIF_SELECT,
  });
}

export async function countUserNotifications(
  userId: string,
  opts?: ListNotificationsOpts & { unreadOnly?: boolean }
): Promise<number> {
  const readState: NotificationReadState | undefined = opts?.unreadOnly
    ? "unread"
    : opts?.readState;
  return prisma.notification.count({
    where: notificationWhere(userId, { ...opts, readState }),
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return countUserNotifications(userId, { readState: "unread" });
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

export async function markNotificationUnread(
  userId: string,
  notificationId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: null },
  });
}

export async function markNotificationsUnread(
  userId: string,
  ids: string[]
): Promise<number> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return 0;
  const result = await prisma.notification.updateMany({
    where: { userId, id: { in: unique } },
    data: { readAt: null },
  });
  return result.count;
}

export async function markRaidThreadRead(
  userId: string,
  entityId: string
): Promise<number> {
  if (!entityId) return 0;
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      entityType: "raid",
      entityId,
      type: "raid_changed",
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function markAllNotificationsRead(
  userId: string
): Promise<{ count: number; ids: string[] }> {
  const unread = await prisma.notification.findMany({
    where: { userId, readAt: null },
    select: { id: true },
  });
  const ids = unread.map((r) => r.id);
  if (ids.length === 0) return { count: 0, ids: [] };
  const result = await prisma.notification.updateMany({
    where: { userId, id: { in: ids } },
    data: { readAt: new Date() },
  });
  return { count: result.count, ids };
}

export async function getUserRaidChangeNotifScope(
  userId: string
): Promise<"chantier" | "mine"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notif_raid_changes: true },
  });
  return user?.notif_raid_changes === "mine" ? "mine" : "chantier";
}

export async function setUserRaidChangeNotifScope(
  userId: string,
  scope: "chantier" | "mine"
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { notif_raid_changes: scope === "mine" ? "mine" : "chantier" },
  });
}

const MS_24H = 24 * 60 * 60 * 1000;

export type AttentionStaleRow = {
  id: string;
  type: string;
  title: string;
  href: string;
  chantierCode: string;
  createdAt: Date;
  recipient: string;
};

export async function getAttentionPilotage(opts?: {
  chantierIds?: string[] | "all";
}): Promise<{
  windowDays: number;
  assigned: AttentionTypeStats;
  mention: AttentionTypeStats;
  unreadOpen: number;
  stale: AttentionStaleRow[];
}> {
  const since7 = new Date(Date.now() - 7 * MS_24H);
  const since24 = new Date(Date.now() - MS_24H);
  const ids = opts?.chantierIds;
  const chantierFilter: Prisma.NotificationWhereInput =
    !ids || ids === "all"
      ? {}
      : ids.length > 0
        ? { chantierId: { in: ids } }
        : { id: { in: [] } };

  async function statsFor(type: string): Promise<AttentionTypeStats> {
    const base: Prisma.NotificationWhereInput = {
      type,
      createdAt: { gte: since7 },
      ...chantierFilter,
    };
    const rows = await prisma.notification.findMany({
      where: base,
      select: { createdAt: true, readAt: true },
    });
    const total = rows.length;
    const read = rows.filter((r) => r.readAt).length;
    const readWithin24h = rows.filter((r) => {
      if (!r.readAt) return false;
      return r.readAt.getTime() - r.createdAt.getTime() <= MS_24H;
    }).length;
    return {
      total,
      read,
      readWithin24h,
      rate24h: total === 0 ? null : Math.round((readWithin24h / total) * 100),
    };
  }

  const [assigned, mention, unreadOpen, staleRows] = await Promise.all([
    statsFor("raid_assigned"),
    statsFor("raid_mention"),
    prisma.notification.count({
      where: {
        readAt: null,
        type: { in: ["raid_assigned", "raid_mention"] },
        ...chantierFilter,
      },
    }),
    prisma.notification.findMany({
      where: {
        type: { in: ["raid_assigned", "raid_mention"] },
        readAt: null,
        createdAt: { lt: since24 },
        ...chantierFilter,
      },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: {
        id: true,
        type: true,
        title: true,
        href: true,
        chantierCode: true,
        createdAt: true,
        user: {
          select: { first_name: true, last_name: true, username: true },
        },
      },
    }),
  ]);

  return {
    windowDays: 7,
    assigned,
    mention,
    unreadOpen,
    stale: staleRows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      href: r.href,
      chantierCode: r.chantierCode,
      createdAt: r.createdAt,
      recipient:
        `${r.user.first_name} ${r.user.last_name}`.trim() || r.user.username,
    })),
  };
}
