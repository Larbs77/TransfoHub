"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, AlertTriangle, Inbox, History } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAlerts,
  getMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from "@/app/(app)/actions";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notification-labels";
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

interface UserNotif {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  entityType: string;
  entityId: string;
  readAt: Date | null;
  createdAt: Date;
}

export function AlertBell() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifs, setNotifs] = useState<UserNotif[]>([]);
  const [unreadItems, setUnreadItems] = useState<UserNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<"unread" | "all">("unread");

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
      setUnreadCount(unread.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const visibleNotifs = useMemo(() => {
    if (inboxFilter === "unread") return unreadItems;
    return notifs;
  }, [inboxFilter, notifs, unreadItems]);

  /** Badge = unread events only. Operational alerts have their own tab count. */
  const badgeCount = unreadCount;

  async function handleNotifClick(n: UserNotif) {
    if (!n.readAt) {
      try {
        await markMyNotificationRead(n.id);
        const now = new Date();
        setNotifs((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: now } : x))
        );
        setUnreadItems((prev) => prev.filter((x) => x.id !== n.id));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (n.href) {
      router.push(n.href);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllMyNotificationsRead();
      const now = new Date();
      setNotifs((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? now }))
      );
      setUnreadItems([]);
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
              : "Notifications"
          }
        >
          <Bell className="size-5" />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,28rem)] p-0">
        <Tabs defaultValue="notifications" className="w-full">
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

          <TabsContent value="notifications" className="mt-0">
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
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="size-3.5" />
                  Tout marquer lu
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading && notifs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Chargement…
                </p>
              ) : visibleNotifs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {inboxFilter === "unread"
                    ? "Aucune notification non lue"
                    : "Aucune notification récente"}
                </p>
              ) : (
                visibleNotifs.map((n) => {
                  const unread = !n.readAt;
                  const typeLabel = NOTIFICATION_TYPE_LABELS[n.type] ?? n.type;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotifClick(n)}
                      className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent ${
                        unread ? "bg-primary/5" : ""
                      }`}
                    >
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
                            {typeLabel}
                            {" · "}
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                            {n.readAt
                              ? ` · Lu le ${format(new Date(n.readAt), "dd MMM HH:mm", { locale: fr })}`
                              : ""}
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
                <Link href="/notifications" onClick={() => setOpen(false)}>
                  <History className="size-3.5" />
                  Voir l&apos;historique
                </Link>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="alertes" className="mt-0">
            <div className="border-b px-3 py-2">
              <p className="text-xs text-muted-foreground">
                File opérationnelle : actions RAID échues et Q&A critiques. Ce n&apos;est pas l&apos;inbox.
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune alerte
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
                    onClick={() => setOpen(false)}
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
      </PopoverContent>
    </Popover>
  );
}
