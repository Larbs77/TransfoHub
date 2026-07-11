"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  DOMAINE_COLORS,
  DOMAINE_LABELS,
  STATUT_CHANTIER_COLORS,
  PRIORITE_CHANTIER_COLORS,
  PRIORITE_CHANTIER_LABELS,
  TIMELINE_PRIORITE_COLORS,
} from "@/lib/chantier-labels";
import {
  STATUT_ACTION_COLORS,
  RAID_TYPE_COLORS,
  CRITICITE_COLORS,
} from "@/lib/raid-labels";

// ── 1. Statuts Actions (Donut) ──────────────────────

interface StatusChartProps {
  statusCounts: Record<string, number>;
}

export function StatusPieChart({ statusCounts }: StatusChartProps) {
  const data = Object.entries(statusCounts).map(([key, value]) => ({
    name: key,
    value,
    color: STATUT_ACTION_COLORS[key] ?? "#6b7280",
  }));

  if (data.length === 0)
    return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Legend />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 2. Chantiers par Domaine (Donut) ────────────────

interface DomaineChartProps {
  domaineCounts: Record<string, number>;
}

export function DomainePieChart({ domaineCounts }: DomaineChartProps) {
  const data = Object.entries(domaineCounts)
    .map(([key, value]) => ({
      name: DOMAINE_LABELS[key] ?? key,
      value,
      color: DOMAINE_COLORS[key] ?? "#6b7280",
    }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          dataKey="value"
          label={({ name, value }) => `${value}`}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 2b. Chantiers par Priorité (Donut) ───────────────

interface PrioriteChartProps {
  prioriteCounts: Record<string, number>;
}

const PRIORITE_ORDER_CHART = [
  "Fondations techniques",
  "Briques transverses EI",
  "Briques Satellite EI",
  "Dépendante de EI",
  "Indépendante de EI",
  "Pilotage Transformation",
];

export function PrioritePieChart({ prioriteCounts }: PrioriteChartProps) {
  const data = PRIORITE_ORDER_CHART
    .filter((p) => (prioriteCounts[p] ?? 0) > 0)
    .map((p) => ({
      name: PRIORITE_CHANTIER_LABELS[p] ?? p,
      value: prioriteCounts[p],
      color: PRIORITE_CHANTIER_COLORS[p] ?? "#6b7280",
    }));

  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          dataKey="value"
          label={({ name, value }) => `${value}`}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 3. Chantiers par Statut (Bar horizontal) ─────────

interface ChantierStatutChartProps {
  chantierStatutCounts: Record<string, number>;
}

const STATUT_ORDER = ["Non démarré", "Pré cadrage", "Cadrage", "Exécution", "Clôturé"];

export function ChantierStatutBarChart({ chantierStatutCounts }: ChantierStatutChartProps) {
  const data = STATUT_ORDER
    .filter((s) => (chantierStatutCounts[s] ?? 0) > 0)
    .map((s) => ({
      name: s,
      count: chantierStatutCounts[s] ?? 0,
      fill: STATUT_CHANTIER_COLORS[s] ?? "#6b7280",
    }));

  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" name="Chantiers" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 4. RAID par Type (Donut) ─────────────────────────

interface RaidTypeChartProps {
  raidTypeCounts: Record<string, number>;
}

export function RaidTypePieChart({ raidTypeCounts }: RaidTypeChartProps) {
  const data = Object.entries(raidTypeCounts).map(([key, value]) => ({
    name: key,
    value,
    color: RAID_TYPE_COLORS[key] ?? "#6b7280",
  }));

  if (data.length === 0) return <EmptyChart />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Legend />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── 5. Matrice des Risques (Heatmap 5×5) ────────────

interface RiskMatrixProps {
  riskMatrix: number[][];
}

const PROB_LABELS = ["Rare", "Peu probable", "Possible", "Probable", "Quasi-certain"];
const IMPACT_SHORT = ["Négl.", "Mineur", "Modéré", "Majeur", "Critique"];

function getHeatColor(prob: number, impact: number): string {
  const score = (prob + 1) * (impact + 1);
  if (score <= 3) return "#22c55e";
  if (score <= 6) return "#84cc16";
  if (score <= 10) return "#f59e0b";
  if (score <= 15) return "#f97316";
  return "#dc2626";
}

export function RiskMatrixChart({ riskMatrix }: RiskMatrixProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left text-muted-foreground">Prob. \ Impact</th>
            {IMPACT_SHORT.map((l) => (
              <th key={l} className="p-2 text-center font-medium">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...riskMatrix].reverse().map((row, ri) => {
            const probIdx = 4 - ri;
            return (
              <tr key={probIdx}>
                <td className="p-2 text-muted-foreground whitespace-nowrap">{PROB_LABELS[probIdx]}</td>
                {row.map((count, ci) => (
                  <td key={ci} className="p-1 text-center">
                    <div
                      className={`mx-auto flex size-10 items-center justify-center rounded-md text-sm font-bold text-white ${count > 0 ? "cursor-pointer ring-offset-background transition-shadow hover:ring-2 hover:ring-ring hover:ring-offset-1" : ""}`}
                      style={{
                        backgroundColor: getHeatColor(probIdx, ci),
                        opacity: count > 0 ? 1 : 0.25,
                      }}
                      onClick={() => {
                        if (count > 0) {
                          router.push(`/raid/risques?prob=${probIdx + 1}&impact=${ci + 1}`);
                        }
                      }}
                      title={count > 0 ? `${count} risque(s) — ${PROB_LABELS[probIdx]} / ${IMPACT_SHORT[ci]}\nCliquez pour filtrer` : ""}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 6. Timeline Chantiers (Gantt) ────────────────────

interface TimelineItem {
  id: string;
  code: string;
  nom: string;
  domaine: string;
  priorite: string;
  statut: string;
  date_debut: Date | string;
  date_fin: Date | string;
}

interface TimelineChartProps {
  chantierTimeline: TimelineItem[];
}

const PRIORITE_GROUP_ORDER = [
  "Pilotage Transformation",
  "Fondations techniques",
  "Briques transverses EI",
  "Briques Satellite EI",
  "Dépendante de EI",
  "Indépendante de EI",
];

const PRIORITE_SHORT_LABELS: Record<string, string> = {
  "Pilotage Transformation": "Transverse",
  "Fondations techniques": "Fondations",
  "Briques transverses EI": "Briques Transverses EI",
  "Briques Satellite EI": "Briques Satellites EI",
  "Dépendante de EI": "Couplées aux briques EI",
  "Indépendante de EI": "Indépendantes de EI",
};

/** January = cool sky; July = warm amber */
function timelineMonthLabelClass(month: number): string {
  if (month === 0) {
    return "font-semibold text-sky-600 dark:text-sky-400";
  }
  if (month === 6) {
    return "font-semibold text-amber-600 dark:text-amber-400";
  }
  return "text-muted-foreground";
}

function timelineMonthLineClass(month: number): string {
  if (month === 0) {
    return "border-l border-sky-400/45 dark:border-sky-400/35";
  }
  if (month === 6) {
    return "border-l border-amber-400/50 dark:border-amber-400/40";
  }
  return "border-l border-muted/30";
}

export function ChantierTimelineChart({ chantierTimeline }: TimelineChartProps) {
  const router = useRouter();

  if (chantierTimeline.length === 0) return <EmptyChart />;

  const allDates = chantierTimeline.flatMap((c) => [
    new Date(c.date_debut).getTime(),
    new Date(c.date_fin).getTime(),
  ]);
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const range = maxDate - minDate || 1;

  // Build month ticks (every 6 months — typically Jan / Jul)
  const months: { label: string; pos: number; month: number }[] = [];
  const d = new Date(minDate);
  d.setDate(1);
  while (d.getTime() <= maxDate) {
    months.push({
      label: format(d, "MMM yy", { locale: fr }),
      pos: ((d.getTime() - minDate) / range) * 100,
      month: d.getMonth(),
    });
    d.setMonth(d.getMonth() + 6);
  }

  const nowTs = Date.now();
  const todayPos =
    nowTs >= minDate && nowTs <= maxDate
      ? ((nowTs - minDate) / range) * 100
      : null;

  // Group by priorité
  const groups: { priorite: string; items: TimelineItem[] }[] = [];
  for (const p of PRIORITE_GROUP_ORDER) {
    const items = chantierTimeline.filter((c) => c.priorite === p);
    if (items.length > 0) {
      groups.push({ priorite: p, items });
    }
  }
  // Catch any without a known priorité
  const knownSet = new Set(PRIORITE_GROUP_ORDER);
  const others = chantierTimeline.filter((c) => !knownSet.has(c.priorite));
  if (others.length > 0) {
    groups.push({ priorite: "Autre", items: others });
  }

  return (
    <div className="overflow-x-auto">
      {/* Month color legend */}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" />
          <span className="font-medium text-sky-600 dark:text-sky-400">Janvier</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" />
          <span className="font-medium text-amber-600 dark:text-amber-400">Juillet</span>
        </span>
        {todayPos != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]" />
            <span className="font-semibold text-rose-600 dark:text-rose-400">Auj.</span>
          </span>
        )}
      </div>

      {/* Month headers — dates on top, "Auj." tight below */}
      <div className="mb-0.5 flex items-end border-b pb-0.5">
        <div className="w-44 shrink-0" />
        <div className="relative h-[22px] flex-1">
          {months.map((m, i) => (
            <span
              key={i}
              className={`absolute top-0 -translate-x-1/2 text-[10px] capitalize leading-none ${timelineMonthLabelClass(m.month)}`}
              style={{ left: `${m.pos}%` }}
            >
              {m.label}
            </span>
          ))}
          {todayPos != null && (
            <span
              className="absolute top-[12px] z-10 -translate-x-1/2 text-[8px] font-semibold leading-none text-rose-600 dark:text-rose-400"
              style={{ left: `${todayPos}%` }}
              title={format(new Date(nowTs), "dd MMMM yyyy", { locale: fr })}
            >
              Auj.
            </span>
          )}
        </div>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const color =
          TIMELINE_PRIORITE_COLORS[group.priorite] ??
          TIMELINE_PRIORITE_COLORS.Autre;
        const label = PRIORITE_SHORT_LABELS[group.priorite] ?? group.priorite;

        return (
          <div key={group.priorite} className="flex">
            {/* Priority label block */}
            <div
              className="flex w-44 shrink-0 items-center justify-center border-r px-2 py-1"
              style={{ backgroundColor: color + "18" }}
            >
              <span
                className="text-center text-[11px] font-semibold leading-tight"
                style={{ color }}
              >
                {label}
              </span>
            </div>

            {/* Chantier rows */}
            <div className="min-w-0 flex-1">
              {group.items.map((c) => {
                const start = new Date(c.date_debut).getTime();
                const end = new Date(c.date_fin).getTime();
                const left = ((start - minDate) / range) * 100;
                const width = Math.max(((end - start) / range) * 100, 1);

                return (
                  <div
                    key={c.code}
                    className="relative h-7 border-b border-muted/30 bg-muted/20 last:border-b-0"
                  >
                    {/* Vertical month grid lines */}
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 ${timelineMonthLineClass(m.month)}`}
                        style={{ left: `${m.pos}%` }}
                      />
                    ))}
                    {/* Today marker */}
                    {todayPos != null && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-gradient-to-b from-rose-500 via-rose-500 to-rose-400/80 shadow-[0_0_6px_rgba(244,63,94,0.55)]"
                        style={{ left: `${todayPos}%` }}
                        title="Aujourd'hui"
                      />
                    )}
                    {/* Bar */}
                    <div
                      className="absolute top-1 bottom-1 z-[1] flex cursor-pointer items-center overflow-hidden rounded transition-opacity hover:opacity-85 hover:ring-2 hover:ring-ring hover:ring-offset-1 ring-offset-background"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: color,
                      }}
                      title={`${c.code} - ${c.nom}\n${format(new Date(c.date_debut), "dd/MM/yyyy", { locale: fr })} → ${format(new Date(c.date_fin), "dd/MM/yyyy", { locale: fr })}\nCliquez pour ouvrir`}
                      onClick={() => router.push(`/chantiers/${c.id}`)}
                    >
                      <span className="truncate whitespace-nowrap px-1.5 text-[10px] font-medium text-white">
                        {c.code} {c.nom}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 7. Actions échues par Domaine (Bar) ──────────────

interface OverdueByDomaineProps {
  overdueByDomaine: Record<string, number>;
}

export function OverdueByDomaineChart({ overdueByDomaine }: OverdueByDomaineProps) {
  const data = Object.entries(overdueByDomaine)
    .map(([key, value]) => ({
      name: key.length > 20 ? key.slice(0, 18) + "…" : key,
      fullName: key,
      count: value,
    }))
    .sort((a, b) => b.count - a.count);

  if (data.length === 0) return <EmptyChart message="Aucune action échue" />;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""} />
        <Bar dataKey="count" name="Actions échues" fill="#dc2626" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 8. Budget par Domaine (Bar) ──────────────────────

interface BudgetByDomaineProps {
  budgetByDomaine: Record<string, number>;
}

export function BudgetByDomaineChart({ budgetByDomaine }: BudgetByDomaineProps) {
  const data = Object.entries(budgetByDomaine)
    .map(([key, value]) => ({
      name: DOMAINE_LABELS[key] ?? key,
      shortName: (DOMAINE_LABELS[key] ?? key).length > 18
        ? (DOMAINE_LABELS[key] ?? key).slice(0, 16) + "…"
        : (DOMAINE_LABELS[key] ?? key),
      budget: value,
      color: DOMAINE_COLORS[key] ?? "#6b7280",
    }))
    .sort((a, b) => b.budget - a.budget);

  if (data.length === 0) return <EmptyChart />;

  const formatValue = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={formatValue} />
        <YAxis type="category" dataKey="shortName" width={130} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [formatValue(Number(value)) + " MAD", "Budget"]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
        />
        <Bar dataKey="budget" name="Budget (MAD)" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Burndown Chart ──────────────────────────────────

interface BurndownProps {
  burndownData: { month: string; created: number; closed: number }[];
}

export function BurndownChart({ burndownData }: BurndownProps) {
  if (burndownData.length === 0) return <EmptyChart message="Aucune donnée de burndown" />;

  const data = burndownData.map((d) => ({
    ...d,
    month: d.month.slice(2), // "2026-03" → "26-03"
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="created" stroke="#3b82f6" name="Créées" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="closed" stroke="#22c55e" name="Clôturées" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Risk Evolution Chart ────────────────────────────

interface RiskEvolutionProps {
  riskEvolutionData: { month: string; avgScore: number; count: number }[];
}

export function RiskEvolutionChart({ riskEvolutionData }: RiskEvolutionProps) {
  if (riskEvolutionData.length === 0) return <EmptyChart message="Aucune donnée d'évolution" />;

  const data = riskEvolutionData.map((d) => ({
    ...d,
    month: d.month.slice(2),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis domain={[0, 25]} tick={{ fontSize: 12 }} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) =>
            name === "avgScore" ? [`${value}/25`, "Score moyen"] : [value, "Risques"]
          }
        />
        <Legend />
        <Line type="monotone" dataKey="avgScore" stroke="#dc2626" name="Score moyen" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Workload by Responsable Chart ───────────────────

interface WorkloadProps {
  workloadData: { responsable: string; count: number }[];
}

export function WorkloadByResponsableChart({ workloadData }: WorkloadProps) {
  if (workloadData.length === 0) return <EmptyChart message="Aucune donnée de charge" />;

  const data = workloadData.map((d) => ({
    ...d,
    shortName: d.responsable.length > 20 ? d.responsable.slice(0, 18) + "…" : d.responsable,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="shortName"
          width={140}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: any) => [value, "Éléments actifs"]}
          labelFormatter={(label: any) => {
            const item = data.find((d) => d.shortName === String(label));
            return item?.responsable ?? String(label);
          }}
        />
        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Domaine Health Radar Chart ──────────────────────

interface HealthProps {
  healthData: { domaine: string; overdueActions: number; openRisks: number; budgetPct: number }[];
}

const RADAR_COLORS = ["#3b82f6", "#dc2626", "#059669", "#f59e0b", "#8b5cf6"];

export function DomaineHealthRadarChart({ healthData }: HealthProps) {
  if (healthData.length === 0) return <EmptyChart message="Aucune donnée de santé" />;

  // Take top 5 domaines by activity (overdueActions + openRisks)
  const top = healthData.slice(0, 5);

  // Normalize metrics to 0-100 scale
  const maxOverdue = Math.max(...top.map((d) => d.overdueActions), 1);
  const maxRisks = Math.max(...top.map((d) => d.openRisks), 1);

  // Transform to radar format: metrics as angles, domaines as series
  const metrics = [
    { metric: "Actions échues", ...Object.fromEntries(top.map((d) => [d.domaine, Math.round((d.overdueActions / maxOverdue) * 100)])) },
    { metric: "Risques ouverts", ...Object.fromEntries(top.map((d) => [d.domaine, Math.round((d.openRisks / maxRisks) * 100)])) },
    { metric: "Budget (%)", ...Object.fromEntries(top.map((d) => [d.domaine, d.budgetPct])) },
  ];

  // Abbreviate domaine names
  const abbrev = (name: string) => name.length > 15 ? name.slice(0, 13) + "…" : name;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={metrics}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} />
        {top.map((d, i) => (
          <Radar
            key={d.domaine}
            name={abbrev(d.domaine)}
            dataKey={d.domaine}
            stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
            fill={RADAR_COLORS[i % RADAR_COLORS.length]}
            fillOpacity={0.15}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Decision Timeline Chart (Stacked Bar) ───────────

interface DecisionTimelineProps {
  decisionTimelineData: { month: string; pending: number; validated: number; refused: number; postponed: number }[];
}

export function DecisionTimelineChart({ decisionTimelineData }: DecisionTimelineProps) {
  if (decisionTimelineData.length === 0) return <EmptyChart message="Aucune donnée de décisions" />;

  const data = decisionTimelineData.map((d) => ({
    ...d,
    month: d.month.slice(2), // "2026-03" → "26-03"
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="pending" stackId="a" name="En attente" fill="#f59e0b" radius={[0, 0, 0, 0]} />
        <Bar dataKey="validated" stackId="a" name="Validée" fill="#22c55e" radius={[0, 0, 0, 0]} />
        <Bar dataKey="refused" stackId="a" name="Refusée" fill="#ef4444" radius={[0, 0, 0, 0]} />
        <Bar dataKey="postponed" stackId="a" name="Reportée" fill="#6b7280" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Action Completion by Domaine (Horizontal Bar) ────

interface ActionCompletionByDomaineProps {
  actionCompletionByDomaine: { domaine: string; rate: number; total: number; closed: number }[];
}

export function ActionCompletionByDomaineChart({ actionCompletionByDomaine }: ActionCompletionByDomaineProps) {
  if (actionCompletionByDomaine.length === 0) return <EmptyChart message="Aucune action" />;

  const data = actionCompletionByDomaine.map((d) => ({
    name: d.domaine.length > 20 ? d.domaine.slice(0, 18) + "…" : d.domaine,
    fullName: d.domaine,
    rate: d.rate,
    total: d.total,
    closed: d.closed,
  }));

  const height = Math.max(280, data.length * 32);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: any, _: any, props: any) =>
            [`${value}% (${props?.payload?.closed}/${props?.payload?.total})`, "Taux clôture"]
          }
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
        />
        <Bar dataKey="rate" name="Taux clôture" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 15. Charge Ressources (RAG bar chart) ──────────

import { getRAGColor } from "@/lib/capacite-labels";

interface CapaciteRessourceChartProps {
  capaciteData: {
    nom_complet: string;
    avgCharge: number;
    type: string;
  }[];
}

export function CapaciteRessourceChart({ capaciteData }: CapaciteRessourceChartProps) {
  if (capaciteData.length === 0) return <EmptyChart message="Aucune ressource active" />;

  const top10 = capaciteData
    .sort((a, b) => b.avgCharge - a.avgCharge)
    .slice(0, 10)
    .map((r) => ({
      name: r.nom_complet.length > 18 ? r.nom_complet.slice(0, 16) + "…" : r.nom_complet,
      fullName: r.nom_complet,
      charge: r.avgCharge,
      fill: getRAGColor(r.avgCharge),
    }));

  const height = Math.max(280, top10.length * 32);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={top10} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${value}%`, "Charge moyenne"]}
          labelFormatter={(_label, payload) => ((payload as unknown) as { payload?: { fullName?: string } }[])?.[0]?.payload?.fullName ?? ""}
        />
        <Bar dataKey="charge" name="Charge %" radius={[0, 4, 4, 0]}>
          {top10.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Empty state ─────────────────────────────────────

function EmptyChart({ message = "Aucune donnée" }: { message?: string }) {
  return (
    <p className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {message}
    </p>
  );
}
