"use client";

import Link from "next/link";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";

interface Stats {
  totalActions: number;
  totalRisks: number;
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
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        icon={FolderKanban}
        label="Chantiers Actifs"
        value={String(stats.totalChantiers)}
        subtitle="En cours"
        href="/chantiers"
      />
      <KpiCard
        icon={ClipboardList}
        label="Actions Actives"
        value={String(stats.totalActions)}
        subtitle="Non clôturées"
        href="/raid/actions?statut=active"
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
        href="/raid/risques?statut=open"
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
        icon={CalendarCheck}
        label="Comités à venir"
        value={String(stats.upcomingComites)}
        subtitle="Planifiés"
        href="/comites?upcoming=true"
      />
      {(() => {
        const b = formatBudget(stats.totalBudget);
        return (
          <KpiCard
            icon={DollarSign}
            label="Budget Total"
            value={b.num}
            subtitle={b.unit}
            href="/chantiers"
          />
        );
      })()}
      <KpiCard
        icon={TrendingUp}
        label="Taux Clôture"
        value={`${stats.actionCloseRate}%`}
        subtitle="Actions clôturées"
        variant={stats.actionCloseRate >= 50 ? "success" : "default"}
        href="/raid/actions?statut=Clôturé"
      />
      <KpiCard
        icon={Activity}
        label="Avancement Moyen"
        value={`${stats.averageProgress}%`}
        subtitle="Chantiers actifs"
        variant={stats.averageProgress >= 50 ? "success" : "default"}
        href="/chantiers"
      />
      <KpiCard
        icon={MessageCircleQuestion}
        label="Q&A Critiques"
        value={String(stats.criticalQABacklog)}
        subtitle="Ouvertes"
        variant={stats.criticalQABacklog > 0 ? "destructive" : "default"}
        href="/consultation-backlog?priorite=Critique&statut=Ouverte"
      />
      <KpiCard
        icon={Shield}
        label="Risques Mitigés"
        value={`${stats.riskMitigationRate}%`}
        subtitle="Avec stratégie"
        variant={stats.riskMitigationRate >= 70 ? "success" : "default"}
        href="/raid/risques"
      />
    </section>
  );
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
