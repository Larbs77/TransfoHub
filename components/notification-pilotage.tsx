"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Bell, Mail, Siren } from "lucide-react";
import {
  NOTIFICATION_TYPE_LABELS,
  type AttentionTypeStats,
} from "@/lib/notification-labels";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PilotageData = {
  windowDays: number;
  assigned: AttentionTypeStats;
  mention: AttentionTypeStats;
  unreadOpen: number;
  stale: Array<{
    id: string;
    type: string;
    title: string;
    href: string;
    chantierCode: string;
    createdAt: Date;
    recipient: string;
  }>;
};

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function rateLabel(s: AttentionTypeStats): string {
  if (s.rate24h === null) return "—";
  return `${s.rate24h} %`;
}

export function NotificationPilotage({ data }: { data: PilotageData }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 h-8 gap-1 px-0" asChild>
            <Link href="/notifications">
              <ArrowLeft className="size-4" />
              Centre de notifications
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary">
            Pilotage de l&apos;attention
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assignations et mentions des {data.windowDays} derniers jours.
            Les modifications RAID ne sont pas un KPI de lecture (elles se
            regroupent dans l&apos;inbox).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Assignations lues sous 24 h"
            value={rateLabel(data.assigned)}
            hint={`${data.assigned.readWithin24h} / ${data.assigned.total} sur 7 jours`}
          />
          <Kpi
            label="Mentions lues sous 24 h"
            value={rateLabel(data.mention)}
            hint={`${data.mention.readWithin24h} / ${data.mention.total} sur 7 jours`}
          />
          <Kpi
            label="Non lues ouvertes"
            value={String(data.unreadOpen)}
            hint="Assignations et mentions encore non lues"
          />
          <Kpi
            label="Retards de plus de 24 h"
            value={String(data.stale.length)}
            hint="Liste ci-dessous (40 premiers)"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="size-4 text-[#00BDBB]" />
              Inbox in-app
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Événement personnel : on m&apos;a assigné, cité, partagé une
              fiche, ou modifié un RAID de mon périmètre.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4 text-[#00BDBB]" />
              Mail RAID
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Le même événement, un destinataire. Indépendant de l&apos;inbox.
              Relances lun/jeu = synthèse chantier, pas cet historique.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Siren className="size-4 text-destructive" />
              Échéances
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              File opérationnelle (actions échues, Q&A critiques). Pas une
              notification : le métier reste ouvert jusqu&apos;au traitement.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">
              Assignations et mentions non lues depuis plus de 24 h
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinataire</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead>Chantier</TableHead>
                <TableHead>Reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stale.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Aucun retard de lecture sur ce périmètre.
                  </TableCell>
                </TableRow>
              ) : (
                data.stale.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{row.recipient}</TableCell>
                    <TableCell className="text-xs">
                      {NOTIFICATION_TYPE_LABELS[row.type] ?? row.type}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      {row.href ? (
                        <Link
                          href={row.href}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {row.title}
                        </Link>
                      ) : (
                        <span className="text-sm">{row.title}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.chantierCode || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(row.createdAt), "dd MMM yyyy HH:mm", {
                        locale: fr,
                      })}
                      {" · "}
                      {formatDistanceToNow(new Date(row.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
