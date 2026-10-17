"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Inbox,
  History,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAlerts,
  getMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  markMyNotificationsUnread,
  markMyRaidThreadRead,
} from "@/app/(app)/actions";
import {
  NOTIFICATION_TYPE_LABELS,
  buildInboxEntries,
  notificationTypeChipClass,
  type AppNotification,
  type InboxEntry,
} from "@/lib/notification-labels";
import { useInbox } from "@/components/inbox-provider";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Alert {
  id: string;
  type: string;
  message: string;
  detail?: string;
  responsable: string;
  date: Date | null;
}

type UserNotif = AppNotification;

function metaBits(n: AppNotification): string {
  const bits = [
    NOTIFICATION_TYPE_LABELS[n.type] ?? n.type,
    n.chantierCode || "",
    n.actorName ? `par ${n.actorName}` : "",
    formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr }),
  ].filter(Boolean);
  if (n.readAt) {
    bits.push(`Lu le ${format(new Date(n.readAt), "dd MMM HH:mm", { locale: fr })}`);
  }
  return bits.join(" · ");
}

function TypeChip({ type }: { type: string }) {
  return (
    <span
      className={`mb-1 inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium ${notificationTypeChipClass(type)}`}
    >
      {NOTIFICATION_TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function InboxTrigger({ compact = false }: { compact?: boolean }) {
  const { open, toggle, unreadCount } = useInbox();
  const hasUnread = unreadCount > 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "sm"}
      aria-label={
        hasUnread
          ? `Inbox, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
          : "Inbox"
      }
      aria-expanded={open}
      aria-controls="inbox-drawer"
      onClick={toggle}
      className={cn(
        "relative shrink-0 rounded-full border font-semibold transition-colors",
        compact ? "size-9" : "h-9 gap-2 px-3",
        hasUnread
          ? "border-[#00BDBB]/50 bg-[#0A3C74]/12 text-[#0A3C74] hover:bg-[#00BDBB]/20 dark:bg-[#00BDBB]/15 dark:text-teal-100"
          : "border-[#00BDBB]/30 bg-[#0A3C74]/[0.07] text-[#0A3C74] hover:bg-[#00BDBB]/15 dark:border-[#00BDBB]/40 dark:bg-[#00BDBB]/10 dark:text-teal-100",
        open && "ring-2 ring-[#00BDBB]/45"
      )}
    >
      <Bell className="size-4" />
      {!compact ? <span>Inbox</span> : null}
      {hasUnread ? (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground",
            compact && "absolute -top-1 -right-1"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Button>
  );
}

export function InboxDrawer() {
  const router = useRouter();
  const { open, setOpen, isLg, setUnreadCount } = useInbox();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifs, setNotifs] = useState<UserNotif[]>([]);
  const [unreadItems, setUnreadItems] = useState<UserNotif[]>([]);
  const [unreadCount, setLocalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<"unread" | "all">("unread");
  const [undoIds, setUndoIds] = useState<string[] | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const empty = { items: [] as UserNotif[], unreadCount: 0 };
      const [a, n, unread] = await Promise.all([
        getAlerts().catch(() => [] as Alert[]),
        getMyNotifications().catch(() => empty),
        getMyNotifications({ unreadOnly: true }).catch(() => empty),
      ]);
      setAlerts(a);
      setNotifs(n.items);
      setUnreadItems(unread.items);
      setLocalUnread(unread.unreadCount);
      setUnreadCount(unread.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const visibleNotifs = useMemo(() => {
    if (inboxFilter === "unread") return unreadItems;
    return notifs;
  }, [inboxFilter, notifs, unreadItems]);

  const entries = useMemo(
    () => buildInboxEntries(visibleNotifs),
    [visibleNotifs]
  );

  async function handleNotifClick(n: UserNotif) {
    if (!n.readAt) {
      try {
        await markMyNotificationRead(n.id);
        const now = new Date();
        setNotifs((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: now } : x))
        );
        setUnreadItems((prev) => prev.filter((x) => x.id !== n.id));
        const next = Math.max(0, unreadCount - 1);
        setLocalUnread(next);
        setUnreadCount(next);
      } catch {
        /* ignore */
      }
    }
    if (!isLg) setOpen(false);
    if (n.href) router.push(n.href);
  }

  async function handleThreadClick(
    entry: Extract<InboxEntry, { kind: "thread" }>
  ) {
    try {
      const n = await markMyRaidThreadRead(entry.entityId);
      const next = Math.max(0, unreadCount - (n || entry.unreadCount));
      setLocalUnread(next);
      setUnreadCount(next);
      setUnreadItems((prev) =>
        prev.filter(
          (x) => !(x.type === "raid_changed" && x.entityId === entry.entityId)
        )
      );
    } catch {
      /* ignore */
    }
    if (!isLg) setOpen(false);
    if (entry.href) router.push(entry.href);
  }

  function armUndo(ids: string[]) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoIds(ids);
    undoTimer.current = setTimeout(() => setUndoIds(null), 8000);
  }

  async function handleMarkAllRead() {
    try {
      const result = await markAllMyNotificationsRead();
      const now = new Date();
      setNotifs((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? now }))
      );
      setUnreadItems([]);
      setLocalUnread(0);
      setUnreadCount(0);
      if (result.ids.length > 0) armUndo(result.ids);
    } catch {
      /* ignore */
    }
  }

  async function handleUndo() {
    if (!undoIds?.length) return;
    try {
      await markMyNotificationsUnread(undoIds);
      setUndoIds(null);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      await refresh();
    } catch {
      /* ignore */
    }
  }

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Inbox className="size-4 text-[#00BDBB]" />
          Inbox
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Fermer l'inbox"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <Tabs defaultValue="notifications" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-2 pt-2">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/50 p-1">
            <TabsTrigger value="notifications" className="gap-1.5 text-xs">
              <Inbox className="size-3.5" />
              Inbox
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="alertes" className="gap-1.5 text-xs">
              <AlertTriangle className="size-3.5" />
              Échéances
              {alerts.length > 0 && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                  {alerts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="notifications" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex gap-1">
              <Button
                type="button"
                variant={inboxFilter === "unread" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setInboxFilter("unread")}
              >
                Non lues
                {unreadCount > 0 ? ` (${unreadCount})` : ""}
              </Button>
              <Button
                type="button"
                variant={inboxFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setInboxFilter("all")}
              >
                Récentes
              </Button>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void handleMarkAllRead()}
              >
                <CheckCheck className="size-3.5" />
                Tout marquer lu
              </Button>
            )}
          </div>
          {undoIds && undoIds.length > 0 ? (
            <div className="flex items-center justify-between gap-2 border-b bg-primary/5 px-3 py-1.5 text-xs">
              <span>
                {undoIds.length} notification{undoIds.length > 1 ? "s" : ""}{" "}
                marquée{undoIds.length > 1 ? "s" : ""} lue
                {undoIds.length > 1 ? "s" : ""}.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => void handleUndo()}
              >
                Annuler
              </Button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && notifs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Chargement…
              </p>
            ) : entries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {inboxFilter === "unread"
                  ? "Aucune notification non lue"
                  : "Aucune notification récente"}
              </p>
            ) : (
              entries.map((entry) => {
                if (entry.kind === "thread") {
                  const unread = entry.unreadCount > 0;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => void handleThreadClick(entry)}
                      className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent ${
                        unread ? "bg-primary/5" : ""
                      }`}
                    >
                      <TypeChip type="raid_changed" />
                      <div className="flex items-start gap-2">
                        {unread ? (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        ) : (
                          <span className="mt-1.5 size-1.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <span
                            className={`font-medium leading-snug ${
                              unread ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {entry.label}
                          </span>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {entry.items.length} modifications
                            {entry.unreadCount > 0
                              ? ` · ${entry.unreadCount} non lue${entry.unreadCount > 1 ? "s" : ""}`
                              : ""}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {[
                              entry.chantierCode,
                              entry.actorName ? `par ${entry.actorName}` : "",
                              formatDistanceToNow(new Date(entry.latestAt), {
                                addSuffix: true,
                                locale: fr,
                              }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                }
                const n = entry.notif;
                const unread = !n.readAt;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => void handleNotifClick(n)}
                    className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent ${
                      unread ? "bg-primary/5" : ""
                    }`}
                  >
                    <TypeChip type={n.type} />
                    <div className="flex items-start gap-2">
                      {unread ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      ) : (
                        <span className="mt-1.5 size-1.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span
                          className={`font-medium leading-snug ${
                            unread ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {n.title}
                        </span>
                        {n.message && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {n.message}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {metaBits(n)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2">
            <p className="text-[10px] text-muted-foreground">
              {loading
                ? "Chargement…"
                : `${notifs.length} plus récente(s) — l’historique complet est dans le centre`}
            </p>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
              <Link href="/notifications" onClick={() => !isLg && setOpen(false)}>
                <History className="size-3.5" />
                Historique
              </Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="alertes" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div className="border-b px-3 py-2">
            <p className="text-xs text-muted-foreground">
              File opérationnelle : actions RAID échues et Q&A critiques. Ce n&apos;est pas l&apos;inbox.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune échéance en retard
              </p>
            ) : (
              alerts.map((alert) => (
                <Link
                  key={`${alert.type}-${alert.id}`}
                  href={
                    alert.type === "qa_critique_echue"
                      ? "/consultation-backlog"
                      : `/raid/${alert.id}`
                  }
                  onClick={() => {
                    if (!isLg) setOpen(false);
                  }}
                  className="flex flex-col gap-0.5 border-b px-4 py-3 text-sm hover:bg-accent transition-colors last:border-b-0"
                >
                  <span
                    className={`font-medium ${
                      alert.type === "qa_critique_echue"
                        ? "text-orange-600"
                        : "text-destructive"
                    }`}
                  >
                    {alert.message}
                  </span>
                  {alert.detail && (
                    <span className="text-xs text-muted-foreground">
                      {alert.detail}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Responsable : {alert.responsable || "—"} | Échéance :{" "}
                    {alert.date
                      ? format(new Date(alert.date), "dd/MM/yyyy", {
                          locale: fr,
                        })
                      : "—"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <>
      {open && !isLg ? (
        <button
          type="button"
          aria-label="Fermer l'inbox"
          className="fixed inset-0 z-[55] bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id="inbox-drawer"
        aria-hidden={!open}
        className={cn(
          "fixed right-0 z-[60] flex flex-col border-l bg-card shadow-xl transition-transform duration-300",
          "w-[min(100vw,24rem)]",
          isLg ? "top-14 bottom-0 z-20" : "inset-y-0",
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      >
        {panel}
      </aside>
    </>
  );
}

/** @deprecated use InboxTrigger + InboxDrawer */
export function AlertBell() {
  return <InboxTrigger compact />;
}
