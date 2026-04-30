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
          : "";
  const hasColor = variant !== "default";

  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md h-full">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Icon className={`size-4 ${hasColor ? colorClass : ""}`} />
            {label}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className={`text-2xl font-bold whitespace-nowrap ${hasColor ? colorClass : ""}`}>
            {value}
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DashboardPMO({ stats, dashboardType }: { stats: PMODashboardStats; dashboardType: "complete" | "limited" }) {
  const isLimited = dashboardType === "limited";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <LayoutDashboard className="size-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Mon Tableau de Bord</h1>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
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
          href="/raid/actions"
        />
        <KpiCard
          icon={Clock}
          label="Actions Échues"
          value={String(stats.overdueActions)}
          subtitle="Date dépassée"
          variant={stats.overdueActions > 0 ? "destructive" : "default"}
          href="/raid/actions?overdue=true"
        />
        <KpiCard
          icon={ShieldCheck}
          label="Risques Ouverts"
          value={String(stats.totalRisks)}
          subtitle="Non clos"
          href="/raid/risques"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Risques Critiques"
          value={String(stats.criticalRisks)}
          subtitle="Score >= 12/25"
          variant={stats.criticalRisks > 0 ? "destructive" : "default"}
          href="/raid/risques?critical=true"
        />
        <KpiCard
          icon={Gavel}
          label="Décisions en attente"
          value={String(stats.pendingDecisions)}
          subtitle="Non validées"
          variant={stats.pendingDecisions > 0 ? "warning" : "default"}
          href="/raid/decisions?statut=En+attente"
        />
        <KpiCard
          icon={TrendingUp}
          label="Taux Clôture"
          value={`${stats.actionCloseRate}%`}
          subtitle="Actions clôturées"
          variant={stats.actionCloseRate >= 50 ? "success" : "default"}
          href="/raid/actions"
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
          <ChantierTimelinePMO chantierTimeline={stats.chantierTimeline} />
        </CardContent>
      </Card>
    </div>
  );
}
