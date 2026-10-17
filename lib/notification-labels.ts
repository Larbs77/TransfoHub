/** Client-safe labels and types for in-app notifications. */

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  raid_assigned: "Assignation",
  raid_changed: "Modification",
  raid_shared: "Partage",
  raid_mention: "Mention",
};

export const NOTIFICATION_TYPES = [
  "raid_assigned",
  "raid_changed",
  "raid_shared",
  "raid_mention",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationReadState = "all" | "unread" | "read";

export type RaidChangeNotifScope = "chantier" | "mine";

export type AttentionTypeStats = {
  total: number;
  read: number;
  readWithin24h: number;
  rate24h: number | null;
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  entityType: string;
  entityId: string;
  actorName: string;
  chantierId: string;
  chantierCode: string;
  readAt: Date | null;
  createdAt: Date;
};

export type InboxEntry =
  | { kind: "single"; key: string; notif: AppNotification }
  | {
      kind: "thread";
      key: string;
      entityId: string;
      href: string;
      label: string;
      chantierCode: string;
      actorName: string;
      items: AppNotification[];
      unreadCount: number;
      latestAt: Date | string;
    };

/** Assignation / mention / partage stay as their own rows. Modifications RAID group by fiche. */
export function buildInboxEntries(items: AppNotification[]): InboxEntry[] {
  const changed = new Map<string, AppNotification[]>();
  const rest: AppNotification[] = [];
  for (const n of items) {
    if (n.type === "raid_changed" && n.entityId) {
      const arr = changed.get(n.entityId) ?? [];
      arr.push(n);
      changed.set(n.entityId, arr);
    } else {
      rest.push(n);
    }
  }

  const entries: InboxEntry[] = rest.map((n) => ({
    kind: "single" as const,
    key: n.id,
    notif: n,
  }));

  for (const [entityId, group] of changed) {
    const sorted = [...group].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    );
    if (sorted.length === 1) {
      entries.push({ kind: "single", key: sorted[0].id, notif: sorted[0] });
      continue;
    }
    const latest = sorted[0];
    const label = latest.title.replace(/^RAID modifié\s*:\s*/i, "") || latest.title;
    entries.push({
      kind: "thread",
      key: `thread-${entityId}`,
      entityId,
      href: latest.href,
      label,
      chantierCode: latest.chantierCode,
      actorName: latest.actorName,
      items: sorted,
      unreadCount: sorted.filter((x) => !x.readAt).length,
      latestAt: latest.createdAt,
    });
  }

  entries.sort((a, b) => {
    const da =
      a.kind === "single" ? +new Date(a.notif.createdAt) : +new Date(a.latestAt);
    const db =
      b.kind === "single" ? +new Date(b.notif.createdAt) : +new Date(b.latestAt);
    return db - da;
  });
  return entries;
}

export function notificationTypeChipClass(type: string): string {
  switch (type) {
    case "raid_assigned":
      return "bg-[#00BDBB]/15 text-[#0A3C74] border-[#00BDBB]/30";
    case "raid_mention":
      return "bg-primary/10 text-primary border-primary/20";
    case "raid_shared":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
