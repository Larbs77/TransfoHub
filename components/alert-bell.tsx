"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, AlertTriangle, Inbox } from "lucide-react";
import { format } from "date-fns";
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
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [a, n] = await Promise.all([
        getAlerts().catch(() => [] as Alert[]),
        getMyNotifications().catch(() => ({
          items: [] as UserNotif[],
          unreadCount: 0,
        })),
      ]);
      setAlerts(a);
      setNotifs(n.items);
      setUnreadCount(n.unreadCount);
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

  const badgeCount = unreadCount + alerts.length;

  async function handleNotifClick(n: UserNotif) {
    if (!n.readAt) {
      try {
        await markMyNotificationRead(n.id);
        setNotifs((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, readAt: new Date() } : x
          )
        );
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
      setNotifs((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date() }))
      );
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,26rem)] p-0">
        <Tabs defaultValue="notifications" className="w-full">
          <div className="border-b px-2 pt-2">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/50 p-1">
              <TabsTrigger value="notifications" className="gap-1.5 text-xs">
                <Inbox className="size-3.5" />
                Notifications
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="alertes" className="gap-1.5 text-xs">
                <AlertTriangle className="size-3.5" />
                Alertes / Relances
                {alerts.length > 0 && (
                  <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                    {alerts.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="notifications" className="mt-0">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {loading ? "Chargement…" : `${notifs.length} notification(s)`}
              </p>
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
              {notifs.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune notification
                </p>
              ) : (
                notifs.map((n) => {
                  const unread = !n.readAt;
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
                        {unread && (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
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
                            {format(new Date(n.createdAt), "dd MMM yyyy HH:mm", {
                              locale: fr,
                            })}
                            {n.type === "raid_assigned" ? " · Assignation" : ""}
                            {n.type === "raid_changed" ? " · Modification" : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="alertes" className="mt-0">
            <div className="border-b px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Alertes opérationnelles calculées (actions échues, Q&A critiques)
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
