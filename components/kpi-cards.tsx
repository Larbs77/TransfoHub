"use client";

import {
  ClipboardList,
  ShieldAlert,
  ShieldCheck,
  FolderKanban,
  Clock,
  Gavel,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  Activity,
  MessageCircleQuestion,
  Shield,
} from "lucide-react";
import { KpiHoverCard } from "@/components/kpi-hover-card";

interface Stats {
  totalActions: number;
  totalRisks: number;
  /** Chantiers with statut ≠ "Non démarré" */
  activeChantiers: number;
  /** All chantiers (denominator for Chantiers Actifs) */
  totalChantiers: number;
  criticalRisks: number;
  overdueActions: number;
  pendingDecisions: number;
  upcomingComites: number;
  totalBudget: number;
  actionCloseRate: number;
  averageProgress: number;
  untreatedInformations: number;
  criticalQABacklog: number;
  riskMitigationRate: number;
}

function formatBudget(amount: number): { num: string; unit: string } {
  if (!amount || amount === 0) return { num: "—", unit: "" };
  if (amount >= 1_000_000_000) return { num: (amount / 1_000_000_000).toFixed(1), unit: "MM MAD" };
  if (amount >= 1_000_000) return { num: String(Math.round(amount / 1_000_000)), unit: "M MAD" };
  if (amount >= 1_000) return { num: String(Math.round(amount / 1_000)), unit: "K MAD" };
  return { num: String(amount), unit: "MAD" };
}

export function KpiCards({ stats }: { stats: Stats }) {
  return (
    <section className="grid grid-cols-2 gap-4 overflow-visible py-2 sm:grid-cols-3 lg:grid-cols-6">
      <KpiHoverCard
        icon={FolderKanban}
        label="Lancés / total"
        value={`${stats.activeChantiers}/${stats.totalChantiers}`}
        subtitle="Chantiers démarrés"
        href="/chantiers"
      />
      <KpiHoverCard
        icon={ClipboardList}
        label="Actions Actives"
        value={String(stats.totalActions)}
        subtitle="Non clôturées"
        href="/raid/actions?statut=active&scope=all"
      />
      <KpiHoverCard
        icon={Clock}
        label="Actions Échues"
        value={String(stats.overdueActions)}
        subtitle="Date dépassée"
        variant={stats.overdueActions > 0 ? "destructive" : "default"}
        href="/raid/actions?overdue=true&scope=all"
      />
      <KpiHoverCard
        icon={ShieldCheck}
        label="Risques Ouverts"
        value={String(stats.totalRisks)}
        subtitle="Non clos"
        href="/raid/risques?statut=open&scope=all"
      />
      <KpiHoverCard
        icon={ShieldAlert}
        label="Risques Critiques"
        value={String(stats.criticalRisks)}
        subtitle="Majeure ou Critique"
        variant={stats.criticalRisks > 0 ? "destructive" : "default"}
        href="/raid/risques?critical=true&scope=all"
      />
      <KpiHoverCard
        icon={Gavel}
        label="Décisions en attente"
        value={String(stats.pendingDecisions)}
        subtitle="Non validées"
        variant={stats.pendingDecisions > 0 ? "warning" : "default"}
        href="/raid/decisions?statut=En+attente&scope=all"
      />
      <KpiHoverCard
        icon={CalendarCheck}
        label="Comités à venir"
        value={String(stats.upcomingComites)}
        subtitle="Planifiés"
        href="/comites?upcoming=true"
      />
      {(() => {
        const b = formatBudget(stats.totalBudget);
        return (
          <KpiHoverCard
            icon={DollarSign}
            label="Budget Total"
            value={b.num}
            subtitle={b.unit}
            href="/chantiers"
          />
        );
      })()}
      <KpiHoverCard
        icon={TrendingUp}
        label="Taux Clôture"
        value={`${stats.actionCloseRate}%`}
        subtitle="Actions clôturées"
        variant={stats.actionCloseRate >= 50 ? "success" : "default"}
        href="/raid/actions?statut=Clôturé&scope=all"
      />
      <KpiHoverCard
        icon={Activity}
        label="Avancement Moyen"
        value={`${stats.averageProgress}%`}
        subtitle="Chantiers actifs"
        variant={stats.averageProgress >= 50 ? "success" : "default"}
        href="/chantiers"
      />
      <KpiHoverCard
        icon={MessageCircleQuestion}
        label="Q&A Critiques"
        value={String(stats.criticalQABacklog)}
        subtitle="Ouvertes"
        variant={stats.criticalQABacklog > 0 ? "destructive" : "default"}
        href="/consultation-backlog?priorite=Critique&statut=Ouverte"
      />
      <KpiHoverCard
        icon={Shield}
        label="Risques Mitigés"
        value={`${stats.riskMitigationRate}%`}
        subtitle="Avec stratégie"
        variant={stats.riskMitigationRate >= 70 ? "success" : "default"}
        href="/raid/risques?scope=all"
      />
    </section>
  );
}
