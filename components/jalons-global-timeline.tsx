"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  format,
  differenceInDays,
  addMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
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
import {
  Milestone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  LayoutList,
  GanttChart,
  Filter,
} from "lucide-react";
import {
  PHASES,
  PHASE_COLORS,
  STATUT_JALON_COLORS,
  STATUT_JALON_LIST,
} from "@/lib/jalon-labels";
import { DOMAINE_LABELS } from "@/lib/chantier-labels";

interface JalonWithChantier {
  id: string;
  chantierId: string;
  phase: string;
  nom: string;
  description: string;
  ordre: number;
  date_cible: Date;
  date_reelle: Date | null;
  statut: string;
  livrables: string;
  commentaire: string;
  chantier: {
    id: string;
    code: string;
    nom: string;
    domaine: string;
    date_debut: Date;
    date_fin: Date;
    statut: string;
  };
}

interface Stats {
  total: number;
  atteints: number;
  enRetard: number;
  aVenir: number;
  tauxRealisation: number;
}

interface Props {
  jalons: JalonWithChantier[];
  stats: Stats;
}

type ViewMode = "timeline" | "table";
type ZoomLevel = "month" | "quarter";

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className="flex size-9 items-center justify-center rounded-md"
        style={{ backgroundColor: color + "18" }}
      >
        <Icon className="size-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold">
          {value}
          {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function JalonsGlobalTimeline({ jalons, stats }: Props) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("timeline");
  const [zoom, setZoom] = useState<ZoomLevel>("quarter");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [domaineFilter, setDomaineFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    jalon: JalonWithChantier;
    x: number;
    y: number;
  } | null>(null);

  // Stable "now" to avoid SSR/client hydration mismatch
  const [now] = useState(() => new Date());

  // Filter jalons
  const filtered = useMemo(() => {
    return jalons.filter((j) => {
      if (phaseFilter !== "all" && j.phase !== phaseFilter) return false;
      if (statutFilter !== "all" && j.statut !== statutFilter) return false;
      if (domaineFilter !== "all" && j.chantier.domaine !== domaineFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !j.nom.toLowerCase().includes(q) &&
          !j.chantier.code.toLowerCase().includes(q) &&
          !j.chantier.nom.toLowerCase().includes(q)
        )
          return false;
      }
      if (overdueOnly) {
        if (
          !(new Date(j.date_cible) < now && !["Atteint", "Annulé"].includes(j.statut))
        )
          return false;
      }
      return true;
    });
  }, [jalons, phaseFilter, statutFilter, domaineFilter, search, overdueOnly, now]);

  // Group jalons by chantier for timeline view
  const chantierGroups = useMemo(() => {
    const map = new Map<
      string,
      { chantier: JalonWithChantier["chantier"]; jalons: JalonWithChantier[] }
    >();
    for (const j of filtered) {
      const existing = map.get(j.chantierId);
      if (existing) {
        existing.jalons.push(j);
      } else {
        map.set(j.chantierId, { chantier: j.chantier, jalons: [j] });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(a.chantier.date_debut).getTime() - new Date(b.chantier.date_debut).getTime()
    );
  }, [filtered]);

  // Unique domaines
  const domaines = useMemo(() => {
    const set = new Set(jalons.map((j) => j.chantier.domaine));
    return Array.from(set).sort();
  }, [jalons]);

  // Timeline date range
  const { minDate, maxDate, range } = useMemo(() => {
    if (filtered.length === 0) {
      const d = new Date();
      return { minDate: d, maxDate: d, range: 1 };
    }
    const dates = filtered.flatMap((j) => {
      const cDates = [new Date(j.date_cible)];
      if (j.date_reelle) cDates.push(new Date(j.date_reelle));
      cDates.push(new Date(j.chantier.date_debut), new Date(j.chantier.date_fin));
      return cDates;
    });
    const min = startOfMonth(new Date(Math.min(...dates.map((d) => d.getTime()))));
    const max = endOfMonth(new Date(Math.max(...dates.map((d) => d.getTime()))));
    return { minDate: min, maxDate: max, range: Math.max(differenceInDays(max, min), 1) };
  }, [filtered]);

  // Build ticks
  const ticks = useMemo(() => {
    const result: { label: string; start: Date; end: Date }[] = [];
    let current = startOfMonth(minDate);
    while (current <= maxDate) {
      if (zoom === "month") {
        result.push({
          label: format(current, "MMM yy", { locale: fr }),
          start: current,
          end: endOfMonth(current),
        });
        current = addMonths(current, 1);
      } else {
        const qMonth = Math.floor(current.getMonth() / 3) * 3;
        const qStart = new Date(current.getFullYear(), qMonth, 1);
        const qEnd = endOfMonth(addMonths(qStart, 2));
        const qLabel = `T${Math.floor(qMonth / 3) + 1} ${format(qStart, "yy")}`;
        if (result.length === 0 || result[result.length - 1].label !== qLabel) {
          result.push({ label: qLabel, start: qStart, end: qEnd });
        }
        current = addMonths(qStart, 3);
      }
    }
    return result;
  }, [minDate, maxDate, zoom]);

  const tickWidth = zoom === "month" ? 80 : 120;
  const totalWidth = ticks.length * tickWidth;

  function getLeftPct(date: Date) {
    return (differenceInDays(new Date(date), minDate) / range) * 100;
  }

  const todayPct = getLeftPct(now);

  function ecartLabel(j: JalonWithChantier): { label: string; color: string } | null {
    if (j.date_reelle) {
      const days = differenceInDays(new Date(j.date_reelle), new Date(j.date_cible));
      if (days === 0) return { label: "0j", color: "#22c55e" };
      if (days > 0) return { label: `+${days}j`, color: "#ef4444" };
      return { label: `${days}j`, color: "#22c55e" };
    }
    if (new Date(j.date_cible) < now && !["Atteint", "Annulé"].includes(j.statut)) {
      const days = differenceInDays(now, new Date(j.date_cible));
      return { label: `+${days}j`, color: "#ef4444" };
    }
    return null;
  }

  return (
    <div className="space-y-4">
      {/* KPI Summary */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Total jalons" value={stats.total} icon={Milestone} color="#6366f1" />
        <KpiCard label="Atteints" value={stats.atteints} icon={CheckCircle2} color="#22c55e" />
        <KpiCard label="En retard" value={stats.enRetard} icon={AlertTriangle} color="#ef4444" />
        <KpiCard label="À venir (30j)" value={stats.aVenir} icon={Clock} color="#3b82f6" />
        <KpiCard
          label="Taux de réalisation"
          value={stats.tauxRealisation}
          suffix="%"
          icon={TrendingUp}
          color="#8b5cf6"
        />
      </div>

      {/* Filters + View toggle */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <Filter className="size-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher jalon ou chantier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-52 h-8 text-xs"
        />
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes phases</SelectItem>
            {PHASES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUT_JALON_LIST.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={domaineFilter} onValueChange={setDomaineFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Domaine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous domaines</SelectItem>
            {domaines.map((d) => (
              <SelectItem key={d} value={d}>
                {DOMAINE_LABELS[d] ?? d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={overdueOnly ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setOverdueOnly(!overdueOnly)}
        >
          <AlertTriangle className="size-3" />
          En retard
        </Button>
        <div className="ml-auto flex items-center gap-1">
          {view === "timeline" && (
            <Select value={zoom} onValueChange={(v) => setZoom(v as ZoomLevel)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            variant={view === "timeline" ? "default" : "outline"}
            className="h-8"
            onClick={() => setView("timeline")}
          >
            <GanttChart className="size-4" />
          </Button>
          <Button
            size="sm"
            variant={view === "table" ? "default" : "outline"}
            className="h-8"
            onClick={() => setView("table")}
          >
            <LayoutList className="size-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} jalon(s) affiché(s) sur {jalons.length}
      </p>

      {/* Timeline View */}
      {view === "timeline" && (
        <div
          ref={containerRef}
          className="border rounded-lg overflow-hidden relative"
        >
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun jalon à afficher
            </p>
          ) : (
            <div className="flex">
              {/* Fixed left panel */}
              <div className="w-52 shrink-0 border-r bg-background z-20">
                <div className="h-9 flex items-center px-3 border-b bg-muted/30">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Chantier
                  </span>
                </div>
                {chantierGroups.map((group) => (
                  <div
                    key={group.chantier.id}
                    className="h-10 flex items-center px-3 border-b hover:bg-muted/10 cursor-pointer"
                    onClick={() => router.push(`/chantiers/${group.chantier.id}`)}
                  >
                    <span className="text-[11px] font-mono text-muted-foreground mr-2 shrink-0">
                      {group.chantier.code}
                    </span>
                    <span className="text-[11px] truncate">{group.chantier.nom}</span>
                    <Badge variant="secondary" className="ml-auto text-[9px] px-1 py-0 shrink-0">
                      {group.jalons.length}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Scrollable timeline */}
              <div className="flex-1 overflow-x-auto">
                <div style={{ minWidth: `${totalWidth}px` }}>
                  {/* Header ticks */}
                  <div className="h-9 flex items-center border-b bg-muted/30">
                    {ticks.map((tick, i) => (
                      <div
                        key={tick.label + i}
                        className="shrink-0 text-center text-[11px] font-medium text-muted-foreground border-r"
                        style={{ width: `${tickWidth}px` }}
                      >
                        {tick.label}
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  {chantierGroups.map((group) => (
                    <div key={group.chantier.id} className="h-10 border-b relative">
                      {/* Grid lines */}
                      {ticks.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-r border-dashed border-muted-foreground/10"
                          style={{ left: `${(i + 1) * tickWidth}px` }}
                        />
                      ))}

                      {/* Today marker */}
                      {todayPct >= 0 && todayPct <= 100 && (
                        <div
                          className="absolute top-0 bottom-0 border-l-2 border-red-500 border-dashed z-10 pointer-events-none"
                          style={{ left: `${todayPct}%` }}
                        />
                      )}

                      {/* Chantier bar (subtle) */}
                      {(() => {
                        const barLeft = getLeftPct(group.chantier.date_debut);
                        const barRight = getLeftPct(group.chantier.date_fin);
                        const barWidth = barRight - barLeft;
                        return (
                          <div
                            className="absolute top-3 h-4 rounded-sm"
                            style={{
                              left: `${barLeft}%`,
                              width: `${barWidth}%`,
                              backgroundColor: "#e5e7eb",
                              minWidth: "4px",
                            }}
                          />
                        );
                      })()}

                      {/* Milestone diamonds */}
                      {group.jalons.map((j) => {
                        const leftPct = getLeftPct(j.date_cible);
                        if (leftPct < -2 || leftPct > 102) return null;
                        const color = STATUT_JALON_COLORS[j.statut] ?? "#94a3b8";
                        return (
                          <div
                            key={j.id}
                            className="absolute z-20 cursor-pointer"
                            style={{
                              left: `${leftPct}%`,
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                            }}
                            onMouseEnter={(e) => {
                              const rect = containerRef.current?.getBoundingClientRect();
                              if (rect) {
                                setTooltip({
                                  jalon: j,
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top,
                                });
                              }
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <div
                              className="size-3.5 rotate-45 rounded-sm border-2 border-white shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-50 pointer-events-none bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-xs space-y-1"
              style={{
                left: `${Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 400) - 260)}px`,
                top: `${tooltip.y + 12}px`,
                maxWidth: "260px",
              }}
            >
              <p className="font-semibold">{tooltip.jalon.nom}</p>
              <p className="text-muted-foreground">
                {tooltip.jalon.chantier.code} — {tooltip.jalon.chantier.nom}
              </p>
              <div className="flex gap-2">
                <Badge
                  variant="secondary"
                  className="text-[10px]"
                  style={{
                    backgroundColor: (PHASE_COLORS[tooltip.jalon.phase] ?? "#6b7280") + "20",
                    color: PHASE_COLORS[tooltip.jalon.phase] ?? "#6b7280",
                  }}
                >
                  {tooltip.jalon.phase}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px]"
                  style={{
                    backgroundColor: (STATUT_JALON_COLORS[tooltip.jalon.statut] ?? "#94a3b8") + "20",
                    color: STATUT_JALON_COLORS[tooltip.jalon.statut] ?? "#94a3b8",
                  }}
                >
                  {tooltip.jalon.statut}
                </Badge>
              </div>
              <div className="flex gap-2 text-muted-foreground">
                <span>
                  Cible: {format(new Date(tooltip.jalon.date_cible), "dd MMM yyyy", { locale: fr })}
                </span>
                {tooltip.jalon.date_reelle && (
                  <>
                    <span>•</span>
                    <span>
                      Réelle: {format(new Date(tooltip.jalon.date_reelle), "dd MMM yyyy", { locale: fr })}
                    </span>
                  </>
                )}
              </div>
              {(() => {
                const e = ecartLabel(tooltip.jalon);
                if (!e) return null;
                return (
                  <p style={{ color: e.color }} className="font-semibold">
                    Écart: {e.label}
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {view === "timeline" && (
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          {Object.entries(STATUT_JALON_COLORS).map(([statut, color]) => (
            <span key={statut} className="flex items-center gap-1">
              <span
                className="inline-block size-2.5 rotate-45 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {statut}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-red-500" />
            Aujourd&apos;hui
          </span>
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chantier</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Jalon</TableHead>
                <TableHead>Date cible</TableHead>
                <TableHead>Date réelle</TableHead>
                <TableHead className="text-center">Écart</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun jalon correspondant aux filtres
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((j) => {
                  const e = ecartLabel(j);
                  return (
                    <TableRow
                      key={j.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/chantiers/${j.chantier.id}`)}
                    >
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground mr-1">
                          {j.chantier.code}
                        </span>
                        <span className="text-xs">{j.chantier.nom}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          style={{
                            backgroundColor: (PHASE_COLORS[j.phase] ?? "#6b7280") + "20",
                            color: PHASE_COLORS[j.phase] ?? "#6b7280",
                          }}
                        >
                          {j.phase}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{j.nom}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(j.date_cible), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {j.date_reelle
                          ? format(new Date(j.date_reelle), "dd MMM yyyy", { locale: fr })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {e ? (
                          <span className="text-xs font-semibold" style={{ color: e.color }}>
                            {e.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: (STATUT_JALON_COLORS[j.statut] ?? "#94a3b8") + "20",
                            color: STATUT_JALON_COLORS[j.statut] ?? "#94a3b8",
                          }}
                        >
                          {j.statut}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
