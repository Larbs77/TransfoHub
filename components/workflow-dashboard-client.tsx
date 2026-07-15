"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import {
  Clock3,
  GitBranch,
  Zap,
  Hourglass,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CalendarDays,
  Info,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";

type Stats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  validationTotal: number;
  directTotal: number;
  directToday: number;
  directThisWeek: number;
  directThisMonth: number;
  createdToday: number;
  createdThisWeek: number;
  createdThisMonth: number;
  validationToday: number;
  byOperation: { create: number; update: number; delete: number };
  byOperationValidation: { create: number; update: number; delete: number };
  byOperationDirect: { create: number; update: number; delete: number };
  avgProcessingHours: number;
  maxProcessingHours: number;
  minProcessingHours: number;
  processingSampleSize: number;
  byChantier: { chantierId: string; count: number; label: string }[];
  byRequester: { requesterId: string; name: string; count: number }[];
  byApprover: { approverId: string; name: string; count: number }[];
  approvalRate: number;
  rejectRate: number;
  deleteRequests: number;
  trendDaily: {
    date: string;
    validation: number;
    direct: number;
    total: number;
  }[];
};

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <div
        className="absolute -right-4 -top-4 size-16 rounded-full opacity-[0.12]"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: accent + "18", color: accent }}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function RankList({
  items,
  empty,
}: {
  items: { key: string; label: string; count: number }[];
  empty: string;
}) {
  const max = items[0]?.count ?? 1;
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={item.key} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate font-medium" title={item.label}>
                {item.label}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.count}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70 transition-all"
              style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WorkflowDashboardClient({ stats }: { stats: Stats }) {
  const validationOpData = [
    { name: "Créations", value: stats.byOperationValidation.create },
    { name: "Modifs", value: stats.byOperationValidation.update },
    { name: "Suppressions", value: stats.byOperationValidation.delete },
  ];

  const originPie = [
    { name: "Via validation", value: stats.validationTotal, fill: "#7c3aed" },
    { name: "Directes", value: stats.directTotal, fill: "#0ea5e9" },
  ];

  const decided = stats.approved + stats.rejected;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0A3C74]/10 via-background to-[#00BDBB]/8 p-6 shadow-sm">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
              <LayoutDashboard className="size-3.5" />
              Pilotage
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Dashboard Workflow
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Suivi des demandes de gouvernance jalons — actions directes et
              processus de validation sont traités séparément.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/workflow/demandes"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
            >
              Centre de validation
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/workflow/historique"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
            >
              Historique
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Origin split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-violet-500/20 shadow-sm">
          <CardHeader className="border-b bg-violet-500/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <GitBranch className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Via validation</CardTitle>
                <CardDescription>
                  Demandes soumises puis traitées par un validateur
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-muted-foreground">Total</p>
              <p className="text-xl font-bold tabular-nums">
                {stats.validationTotal}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">En attente</p>
              <p className="text-xl font-bold tabular-nums text-amber-600">
                {stats.pending}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Approuvées</p>
              <p className="text-xl font-bold tabular-nums text-emerald-600">
                {stats.approved}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Rejetées</p>
              <p className="text-xl font-bold tabular-nums text-destructive">
                {stats.rejected}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-sky-500/25 shadow-sm">
          <CardHeader className="border-b bg-sky-500/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
                <Zap className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Actions directes</CardTitle>
                <CardDescription>
                  Auto-approuvées — hors délai de traitement
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-muted-foreground">Total</p>
              <p className="text-xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
                {stats.directTotal}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Aujourd&apos;hui</p>
              <p className="text-xl font-bold tabular-nums">{stats.directToday}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Cette semaine</p>
              <p className="text-xl font-bold tabular-nums">
                {stats.directThisWeek}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Ce mois</p>
              <p className="text-xl font-bold tabular-nums">
                {stats.directThisMonth}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance KPIs — validation only */}
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Performance (validation uniquement)
            </h2>
            <p className="text-xs text-muted-foreground">
              Indicateurs de délai et de qualité sur le circuit de validation
            </p>
          </div>
        </div>

        <div className="mb-3 flex gap-2 rounded-xl border border-sky-500/25 bg-sky-500/8 px-3.5 py-2.5 text-xs leading-relaxed text-sky-950 dark:text-sky-100">
          <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
          <p>
            Les <strong>actions directes</strong> (auto-approuvées) ne sont{" "}
            <strong>pas incluses</strong> dans le temps moyen, min et max de
            traitement — elles n&apos;ont pas de file d&apos;attente. Seules les
            demandes <strong>via validation</strong> alimentent ces délais.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Temps moyen"
            value={`${stats.avgProcessingHours} h`}
            hint={
              stats.processingSampleSize > 0
                ? `Sur ${stats.processingSampleSize} demande(s) validée(s) · min ${stats.minProcessingHours}h · max ${stats.maxProcessingHours}h`
                : "Aucune demande validée traitée"
            }
            icon={Clock3}
            accent="#0A3C74"
          />
          <KpiCard
            label="En attente"
            value={stats.pending}
            hint="Demandes à traiter"
            icon={Hourglass}
            accent="#f59e0b"
          />
          <KpiCard
            label="Taux d'approbation"
            value={`${stats.approvalRate}%`}
            hint={
              decided > 0
                ? `${stats.approved} approuvées / ${decided} tranchées`
                : "Pas encore de décision"
            }
            icon={CheckCircle2}
            accent="#16a34a"
          />
          <KpiCard
            label="Taux de rejet"
            value={`${stats.rejectRate}%`}
            hint={`${stats.rejected} rejet(s) · ${stats.deleteRequests} suppression(s) demandée(s)`}
            icon={XCircle}
            accent="#dc2626"
          />
        </div>
      </div>

      {/* Activity strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <CalendarDays className="mx-auto mb-1 size-4 text-muted-foreground" />
          <p className="text-lg font-bold tabular-nums">{stats.createdToday}</p>
          <p className="text-[11px] text-muted-foreground">
            Aujourd&apos;hui
            <span className="mt-0.5 block text-[10px]">
              (val. {stats.validationToday} · dir. {stats.directToday})
            </span>
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <TrendingUp className="mx-auto mb-1 size-4 text-muted-foreground" />
          <p className="text-lg font-bold tabular-nums">
            {stats.createdThisWeek}
          </p>
          <p className="text-[11px] text-muted-foreground">Cette semaine</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <LayoutDashboard className="mx-auto mb-1 size-4 text-muted-foreground" />
          <p className="text-lg font-bold tabular-nums">
            {stats.createdThisMonth}
          </p>
          <p className="text-[11px] text-muted-foreground">Ce mois</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Tendance 14 jours
            </CardTitle>
            <CardDescription>
              Volume quotidien — validation vs direct
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trendDaily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="validation"
                  name="Via validation"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="direct"
                  name="Directes"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Opérations (via validation)
            </CardTitle>
            <CardDescription>
              Répartition des demandes soumises à validation
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={validationOpData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="#0A3C74" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-muted-foreground">
              <span>
                Directes · créa. {stats.byOperationDirect.create} · mod.{" "}
                {stats.byOperationDirect.update} · suppr.{" "}
                {stats.byOperationDirect.delete}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Origin summary + ranks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Répartition globale</CardTitle>
            <CardDescription>{stats.total} entrée(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {originPie.map((o) => {
              const pct =
                stats.total > 0
                  ? Math.round((o.value / stats.total) * 100)
                  : 0;
              return (
                <div key={o.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{o.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {o.value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: o.fill,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Par chantier</CardTitle>
            <CardDescription>Validation · top 8</CardDescription>
          </CardHeader>
          <CardContent>
            <RankList
              items={stats.byChantier.slice(0, 8).map((c) => ({
                key: c.chantierId,
                label: c.label,
                count: c.count,
              }))}
              empty="Aucune donnée"
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Par demandeur</CardTitle>
            <CardDescription>Validation · top 8</CardDescription>
          </CardHeader>
          <CardContent>
            <RankList
              items={stats.byRequester.slice(0, 8).map((r) => ({
                key: r.requesterId,
                label: r.name,
                count: r.count,
              }))}
              empty="Aucune donnée"
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Par approbateur</CardTitle>
            <CardDescription>Décisions · top 8</CardDescription>
          </CardHeader>
          <CardContent>
            <RankList
              items={stats.byApprover.slice(0, 8).map((r) => ({
                key: r.approverId,
                label: r.name,
                count: r.count,
              }))}
              empty="Aucune donnée"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
