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
      <KpiCard
        icon={FolderKanban}
        label="Chantiers Actifs"
        value={`${stats.activeChantiers}/${stats.totalChantiers}`}
        subtitle="lancé / total"
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

const VARIANT_HOVER: Record<
  "default" | "destructive" | "warning" | "success",
  string
> = {
  default:
    "group-hover:border-sky-400/55 dark:group-hover:border-sky-400/45",
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
          : "text-sky-600 dark:text-sky-400";
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
          "group-hover:shadow-xl group-hover:shadow-slate-900/15",
          "dark:group-hover:shadow-2xl dark:group-hover:shadow-black/50",
          VARIANT_HOVER[variant],
        ].join(" ")}
      >
        {/* Top shine */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-60 dark:via-white/20"
        />
        {/* Hover glow */}
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
                  : "bg-gradient-to-b from-sky-400/15 via-transparent to-transparent",
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
