"use client";

import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Ban,
  Target,
  Gauge,
  BarChart3,
  ShieldAlert,
  Coins,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatMADCompact } from "@/lib/utils-pmo";

interface CTPData {
  periode: string;
  avancement: number;
  nbRisques: number;
  spi: number;
  cpi: number;
  goLiveRate: number;
  goLiveTargetPct: number;
  goLiveTargetYear: number;
  majeurs: number;
  bloquants: number;
  totalBudgetMAD: number;
  topRisks: {
    chantier: string;
    description: string;
    mitigation: string;
    responsable: string;
    echeance: string | null;
  }[];
  pendingDecisions: {
    sujet: string;
    enjeu: string;
    responsable: string;
    chantier: string;
  }[];
  budgetConsumed: number;
  budgetJHTotal: number;
}

function MeteoIcon({ spi, cpi }: { spi: number; cpi: number }) {
  if (spi >= 1 && cpi >= 1) return <span className="text-2xl" title="En avance et sous budget">☀️</span>;
  if (spi < 1 && cpi >= 1) return <span className="text-2xl" title="En retard mais sous budget">⛅</span>;
  if (spi >= 1 && cpi < 1) return <span className="text-2xl" title="En avance mais surcoût">🌥️</span>;
  return <span className="text-2xl" title="En retard et en dépassement">⛈️</span>;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color = "text-foreground",
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center">
      <Icon className={`size-5 ${color}`} />
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</span>
      {subtitle && <span className="text-[9px] text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

function SpiCpiLegend() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground mt-2">
      <div className="flex items-center gap-1">
        <span className="inline-block size-2 rounded-full bg-green-500" />
        SPI&gt;1 &amp; CPI&gt;1 : En avance et sous budget
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-2 rounded-full bg-yellow-500" />
        SPI&lt;1 &amp; CPI&gt;1 : En retard, sous budget
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-2 rounded-full bg-orange-500" />
        SPI&gt;1 &amp; CPI&lt;1 : En avance, surcoût
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block size-2 rounded-full bg-red-500" />
        SPI&lt;1 &amp; CPI&lt;1 : En retard et dépassement
      </div>
    </div>
  );
}

export function DashboardCTP({ data }: { data: CTPData }) {
  const budgetPct = data.budgetJHTotal > 0
    ? Math.round((data.budgetConsumed / data.budgetJHTotal) * 100)
    : 0;

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-card shadow-lg overflow-hidden print:shadow-none print:border">
      {/* Header band */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-4 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Dashboard CTP — proposition</h2>
            <p className="text-sm opacity-90">Période : {data.periode}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium opacity-80">Météo du programme :</span>
            <MeteoIcon spi={data.spi} cpi={data.cpi} />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          <KpiCard
            label="Taux d'avancement"
            value={`${data.avancement}%`}
            icon={Gauge}
            color="text-blue-600"
          />
          <KpiCard
            label="Nbr. de risques"
            value={data.nbRisques}
            icon={ShieldAlert}
            color={data.nbRisques > 0 ? "text-amber-600" : "text-green-600"}
          />
          <KpiCard
            label="SPI"
            value={data.spi.toFixed(2)}
            icon={data.spi >= 1 ? TrendingUp : TrendingDown}
            color={data.spi >= 1 ? "text-green-600" : "text-red-600"}
          />
          <KpiCard
            label="CPI"
            value={data.cpi.toFixed(2)}
            icon={data.cpi >= 1 ? TrendingUp : TrendingDown}
            color={data.cpi >= 1 ? "text-green-600" : "text-red-600"}
          />
          <KpiCard
            label="Taux de Go Live"
            value={`${data.goLiveRate}%`}
            icon={Target}
            color="text-emerald-600"
          />
          <KpiCard
            label={`Cible Go Live ${data.goLiveTargetYear}`}
            value={`${data.goLiveTargetPct}%`}
            icon={Target}
            color="text-violet-600"
          />
          <KpiCard
            label="Majeurs"
            value={data.majeurs}
            icon={AlertTriangle}
            color={data.majeurs > 0 ? "text-orange-600" : "text-green-600"}
          />
          <KpiCard
            label="Bloquants"
            value={data.bloquants}
            icon={Ban}
            color={data.bloquants > 0 ? "text-red-600" : "text-green-600"}
          />
          <KpiCard
            label="Budget total"
            value={formatMADCompact(data.totalBudgetMAD)}
            icon={Coins}
            color="text-primary"
            subtitle="KMAD"
          />
        </div>

        <SpiCpiLegend />

        {/* Two-column layout: Risks + Decisions */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Principaux Risques */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-red-50 dark:bg-red-950/30 px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                <ShieldAlert className="size-4" />
                Principaux Risques
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Chantier</th>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="px-3 py-2 text-left font-medium">Plan d&apos;atténuation</th>
                    <th className="px-3 py-2 text-left font-medium">Owner</th>
                    <th className="px-3 py-2 text-left font-medium">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.topRisks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                        Aucun risque majeur
                      </td>
                    </tr>
                  )}
                  {data.topRisks.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{r.chantier}</td>
                      <td className="px-3 py-2 max-w-48 truncate">{r.description}</td>
                      <td className="px-3 py-2 max-w-40 truncate">{r.mitigation || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.responsable || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.echeance ? format(new Date(r.echeance), "dd/MM/yyyy", { locale: fr }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Décisions requises */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Décisions requises
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Sujet</th>
                    <th className="px-3 py-2 text-left font-medium">Enjeu</th>
                    <th className="px-3 py-2 text-left font-medium">Responsable</th>
                    <th className="px-3 py-2 text-left font-medium">Chantier</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.pendingDecisions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                        Aucune décision en attente
                      </td>
                    </tr>
                  )}
                  {data.pendingDecisions.map((d, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium max-w-40 truncate">{d.sujet}</td>
                      <td className="px-3 py-2 max-w-48 truncate">{d.enjeu || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.responsable || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{d.chantier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Budget consumption bar */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Consommation budget
            </h3>
            <span className="text-xs text-muted-foreground">
              {new Intl.NumberFormat("fr-FR").format(data.budgetConsumed)} JH / {new Intl.NumberFormat("fr-FR").format(data.budgetJHTotal)} JH
            </span>
          </div>
          <div className="h-5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-gradient-to-r from-primary to-primary/70"
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>Budget Global: {formatMADCompact(data.totalBudgetMAD)}</span>
            <span>Consommé: {budgetPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
