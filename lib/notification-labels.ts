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
