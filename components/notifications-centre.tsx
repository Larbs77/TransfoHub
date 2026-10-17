"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  getMyNotificationsCentre,
  markMyNotificationRead,
  markMyNotificationUnread,
} from "@/app/(app)/actions";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type AppNotification,
  type NotificationReadState,
} from "@/lib/notification-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PeriodKey = "7" | "30" | "90" | "all";

export function NotificationsCentre() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [readState, setReadState] = useState<NotificationReadState>("all");
  const [type, setType] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyNotificationsCentre({
        readState,
        type: type === "all" ? undefined : type,
        q: q.trim() || undefined,
        periodDays: period === "all" ? null : Number(period),
        page,
      });
      setItems(result.items);
      setTotal(result.total);
      setUnreadCount(result.unreadCount);
      setPageSize(result.pageSize);
    } finally {
      setLoading(false);
    }
  }, [page, period, q, readState, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  async function markRead(id: string, nextRead: boolean) {
    if (nextRead) await markMyNotificationRead(id);
    else await markMyNotificationUnread(id);
    await load();
  }

  function openItem(n: AppNotification) {
    void (async () => {
      if (!n.readAt) {
        try {
          await markMyNotificationRead(n.id);
        } catch {
          /* ignore */
        }
      }
      if (n.href) router.push(n.href);
    })();
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary">
              <Bell className="size-6 text-[#00BDBB]" />
              Centre de notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Historique de ce qui vous a été adressé : reçu, lu, à revoir.
              {unreadCount > 0
                ? ` ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}.`
                : " Tout est lu."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Statut</p>
            <Select
              value={readState}
              onValueChange={(v) => {
                setReadState(v as NotificationReadState);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="unread">Non lues</SelectItem>
                <SelectItem value="read">Lues</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Type</p>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {NOTIFICATION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">Période</p>
            <Select
              value={period}
              onValueChange={(v) => {
                setPeriod(v as PeriodKey);
                setPage(1);
              }}
            >
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout l&apos;historique</SelectItem>
                <SelectItem value="7">7 derniers jours</SelectItem>
                <SelectItem value="30">30 derniers jours</SelectItem>
                <SelectItem value="90">90 derniers jours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <form
            className="flex min-w-[12rem] flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qDraft);
              setPage(1);
            }}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                Recherche
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  placeholder="Titre ou message…"
                  className="h-8 pl-8"
                />
              </div>
            </div>
            <Button type="submit" size="sm" className="h-8">
              Filtrer
            </Button>
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Statut</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead className="w-40">Reçu le</TableHead>
                <TableHead className="w-40">Lu le</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Inbox className="mx-auto mb-2 size-8 opacity-40" />
                    Aucune notification pour ces filtres.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((n) => {
                  const unread = !n.readAt;
                  return (
                    <TableRow
                      key={n.id}
                      className={unread ? "bg-primary/5" : undefined}
                    >
                      <TableCell className="whitespace-nowrap">
                        {unread ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <span className="size-1.5 rounded-full bg-primary" />
                            Non lu
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Lu</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        <button
                          type="button"
                          onClick={() => openItem(n)}
                          className="text-left"
                        >
                          <p className={`text-sm leading-snug ${unread ? "font-semibold" : "font-medium"}`}>
                            {n.title}
                          </p>
                          {n.message ? (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.message}
                            </p>
                          ) : null}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(n.createdAt), "dd MMM yyyy HH:mm", {
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {n.readAt
                          ? format(new Date(n.readAt), "dd MMM yyyy HH:mm", {
                              locale: fr,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {n.href ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openItem(n)}
                            >
                              Ouvrir
                            </Button>
                          ) : null}
                          {unread ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => void markRead(n.id, true)}
                            >
                              <Check className="size-3.5" />
                              Marquer lu
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => void markRead(n.id, false)}
                            >
                              <RotateCcw className="size-3.5" />
                              Non lu
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>
            {total} notification{total > 1 ? "s" : ""}
            {total > 0
              ? ` · page ${page} / ${pageCount}`
              : ""}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Précédent
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Conservé tant que la donnée existe en base. Les échéances RAID / Q&A
          restent dans l&apos;onglet Échéances de la cloche, pas ici.{" "}
          <Link href="/" className="text-primary underline-offset-2 hover:underline">
            Retour au tableau de bord
          </Link>
        </p>
      </main>
    </div>
  );
}
