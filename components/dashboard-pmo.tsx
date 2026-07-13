"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  ShieldAlert,
  ShieldCheck,
  FolderKanban,
  Clock,
  Gavel,
  TrendingUp,
  LayoutDashboard,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  StatusPieChart,
  RaidTypePieChart,
  RiskMatrixChart,
  OverdueByDomaineChart,
  BurndownChart,
  RiskEvolutionChart,
  DecisionTimelineChart,
  ActionCompletionByDomaineChart,
} from "@/components/dashboard-charts";
import { ChantierTimelinePMO } from "@/components/chantier-timeline-pmo";

interface PMODashboardStats {
  totalActions: number;
  totalRisks: number;
  totalChantiers: number;
  criticalRisks: number;
  overdueActions: number;
  actionCloseRate: number;
  pendingDecisions: number;
  statusCounts: Record<string, number>;
  raidTypeCounts: Record<string, number>;
  riskMatrix: number[][];
  overdueByDomaine: Record<string, number>;
  burndownData: { month: string; created: number; closed: number }[];
  riskEvolutionData: { month: string; avgScore: number; count: number }[];
  decisionTimelineData: { month: string; pending: number; validated: number; refused: number; postponed: number }[];
  actionCompletionByDomaine: { domaine: string; rate: number; total: number; closed: number }[];
  chantierTimeline: {
    id: string;
    code: string;
    nom: string;
    domaine: string;
    priorite: string;
    statut: string;
    date_debut: Date | string;
    date_fin: Date | string;
    isMine: boolean;
  }[];
}

const VARIANT_HOVER: Record<
  "default" | "destructive" | "warning" | "success",
  string
> = {
  default:
    "group-hover:border-[#00BDBB]/55 dark:group-hover:border-[#00BDBB]/40",
  destructive:
    "group-hover:border-destructive/55 dark:group-hover:border-destructive/45",
  warning:
    "group-hover:border-amber-400/60 dark:group-hover:border-amber-400/45",
  success:
    "group-hover:border-emerald-400/60 dark:group-hover:border-emerald-400/45",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  variant = "default",
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subtitle: string;
  variant?: "default" | "destructive" | "warning" | "success";
  href: string;
}) {
  const colorClass =
    variant === "destructive"
      ? "text-destructive"
      : variant === "warning"
        ? "text-amber-500"
        : variant === "success"
          ? "text-emerald-500"
          : "text-[#0A3C74] dark:text-[#5ad4d2]";
  const hasColor = variant !== "default";

  return (
    <Link
      href={href}
      className="group block h-full rounded-xl outline-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:scale-[1.03] active:-translate-y-0.5 active:scale-[1.01] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        className={[
          "relative h-full cursor-pointer overflow-hidden",
          "border bg-card/95 backdrop-blur-[2px]",
          "shadow-sm transition-[box-shadow,border-color,background-color] duration-300 ease-out",
          "group-hover:shadow-xl group-hover:shadow-[#0A3C74]/12",
          "dark:group-hover:shadow-2xl dark:group-hover:shadow-black/50",
          VARIANT_HOVER[variant],
        ].join(" ")}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-60 dark:via-white/20"
        />
        <div
          aria-hidden
          className={[
            "pointer-events-none absolute -inset-px z-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            variant === "destructive"
              ? "bg-gradient-to-b from-destructive/15 via-transparent to-transparent"
              : variant === "warning"
                ? "bg-gradient-to-b from-amber-400/15 via-transparent to-transparent"
                : variant === "success"
                  ? "bg-gradient-to-b from-emerald-400/15 via-transparent to-transparent"
                  : "bg-gradient-to-b from-[#00BDBB]/18 via-transparent to-transparent",
          ].join(" ")}
        />

        <CardHeader className="relative z-10 pb-2">
          <CardDescription className="flex items-center gap-2">
            <span
              className={[
                "flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-sm",
                "bg-background transition-transform duration-300 ease-out",
                "group-hover:scale-110 group-hover:shadow-md",
                hasColor ? "border-current/15" : "border-border",
              ].join(" ")}
            >
              <Icon className={`size-3.5 ${colorClass}`} />
            </span>
            <span className="truncate font-medium">{label}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 text-center">
          <div
            className={[
              "text-2xl font-bold tracking-tight whitespace-nowrap",
              "transition-transform duration-300 ease-out group-hover:scale-105",
              hasColor ? colorClass : "text-foreground",
            ].join(" ")}
          >
            {value}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/75">
            {subtitle}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardPMO({
  stats,
  dashboardType,
  nowMs,
}: {
  stats: PMODashboardStats;
  dashboardType: "complete" | "limited";
  /** Server clock snapshot — keeps the timeline “Auj.” marker hydration-safe. */
  nowMs?: number;
}) {
  const isLimited = dashboardType === "limited";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <LayoutDashboard className="size-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Mon Tableau de Bord</h1>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-4 overflow-visible py-2 sm:grid-cols-3 lg:grid-cols-7">
        <KpiCard
          icon={FolderKanban}
          label="Mes Chantiers"
          value={String(stats.totalChantiers)}
          subtitle="Actifs"
          href="/chantiers"
        />
        <KpiCard
          icon={ClipboardList}
          label="Actions Actives"
          value={String(stats.totalActions)}
          subtitle="Non clôturées"
          href="/raid/actions?scope=all"
        />
        <KpiCard
          icon={Clock}
          label="Actions Échues"
          value={String(stats.overdueActions)}
          subtitle="Date dépassée"
          variant={stats.overdueActions > 0 ? "destructive" : "default"}
          href="/raid/actions?overdue=true&scope=all"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Risques Ouverts"
          value={String(stats.totalRisks)}
          subtitle="Non clos"
          href="/raid/risques?scope=all"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Risques Critiques"
          value={String(stats.criticalRisks)}
          subtitle="Score >= 12/25"
          variant={stats.criticalRisks > 0 ? "destructive" : "default"}
          href="/raid/risques?critical=true&scope=all"
        />
        <KpiCard
          icon={Gavel}
          label="Décisions en attente"
          value={String(stats.pendingDecisions)}
          subtitle="Non validées"
          variant={stats.pendingDecisions > 0 ? "warning" : "default"}
          href="/raid/decisions?statut=En+attente&scope=all"
        />
        <KpiCard
          icon={TrendingUp}
          label="Taux Clôture"
          value={`${stats.actionCloseRate}%`}
          subtitle="Actions clôturées"
          variant={stats.actionCloseRate >= 50 ? "success" : "default"}
          href="/raid/actions?scope=all"
        />
      </section>

      {/* Row 1: Statuts Actions + RAID par Type */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Statuts Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPieChart statusCounts={stats.statusCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>RAID par Type</CardTitle>
          </CardHeader>
          <CardContent>
            <RaidTypePieChart raidTypeCounts={stats.raidTypeCounts} />
          </CardContent>
        </Card>
      </section>

      {/* Row 2: Matrice des Risques + Actions échues par Domaine */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Matrice des Risques</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskMatrixChart riskMatrix={stats.riskMatrix} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Actions Échues par Domaine</CardTitle>
          </CardHeader>
          <CardContent>
            <OverdueByDomaineChart overdueByDomaine={stats.overdueByDomaine} />
          </CardContent>
        </Card>
      </section>

      {/* Extended charts only for "complete" dashboard */}
      {!isLimited && (
        <>
          {/* Row 3: Burndown + Évolution des Risques */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Burndown Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <BurndownChart burndownData={stats.burndownData} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Évolution des Risques</CardTitle>
              </CardHeader>
              <CardContent>
                <RiskEvolutionChart riskEvolutionData={stats.riskEvolutionData} />
              </CardContent>
            </Card>
          </section>

          {/* Row 4: Tendance Décisions + Taux Complétion */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tendance Décisions</CardTitle>
              </CardHeader>
              <CardContent>
                <DecisionTimelineChart decisionTimelineData={stats.decisionTimelineData} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Taux Complétion Actions par Domaine</CardTitle>
              </CardHeader>
              <CardContent>
                <ActionCompletionByDomaineChart actionCompletionByDomaine={stats.actionCompletionByDomaine} />
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {/* Timeline Chantiers (full width) — always shown */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline Chantiers</CardTitle>
          <CardDescription>Tous les chantiers du programme — vos chantiers sont mis en surbrillance</CardDescription>
        </CardHeader>
        <CardContent>
          <ChantierTimelinePMO
            chantierTimeline={stats.chantierTimeline}
            nowMs={nowMs}
          />
        </CardContent>
      </Card>
    </div>
  );
}
