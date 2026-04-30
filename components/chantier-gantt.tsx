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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PRIORITE_CHANTIER_COLORS,
  PRIORITE_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
  DOMAINE_COLORS,
} from "@/lib/chantier-labels";
import { STATUT_JALON_COLORS } from "@/lib/jalon-labels";

type ZoomLevel = "month" | "quarter" | "year";
type GroupBy = "priorite" | "domaine" | "none";

interface JalonMarker {
  id: string;
  nom: string;
  phase: string;
  statut: string;
  date_cible: Date;
  date_reelle: Date | null;
}

interface ChantierGanttItem {
  id: string;
  code: string;
  nom: string;
  domaine: string;
  priorite: string;
  statut: string;
  date_debut: Date;
  date_fin: Date;
  avancement: number;
  jalons?: JalonMarker[];
}

interface Props {
  chantiers: ChantierGanttItem[];
}

const PRIORITE_ORDER: Record<string, number> = {
  "Fondations techniques": 1,
  "Briques transverses EI": 2,
  "Briques Satellite EI": 3,
  "Dépendante de EI": 4,
  "Indépendante de EI": 5,
  "Pilotage Transformation": 6,
};

interface Tick {
  label: string;
  start: Date;
  end: Date;
}

function buildTicks(minDate: Date, maxDate: Date, zoom: ZoomLevel): Tick[] {
  const ticks: Tick[] = [];
  let current = startOfMonth(minDate);

  while (current <= maxDate) {
    if (zoom === "month") {
      ticks.push({
        label: format(current, "MMM yy", { locale: fr }),
        start: current,
        end: endOfMonth(current),
      });
      current = addMonths(current, 1);
    } else if (zoom === "quarter") {
      const qMonth = Math.floor(current.getMonth() / 3) * 3;
      const qStart = new Date(current.getFullYear(), qMonth, 1);
      const qEnd = endOfMonth(addMonths(qStart, 2));
      const qLabel = `T${Math.floor(qMonth / 3) + 1} ${format(qStart, "yy")}`;
      // Avoid duplicates
      if (ticks.length === 0 || ticks[ticks.length - 1].label !== qLabel) {
        ticks.push({ label: qLabel, start: qStart, end: qEnd });
      }
      current = addMonths(qStart, 3);
    } else {
      // year
      const yStart = new Date(current.getFullYear(), 0, 1);
      const yEnd = new Date(current.getFullYear(), 11, 31);
      const yLabel = String(current.getFullYear());
      if (ticks.length === 0 || ticks[ticks.length - 1].label !== yLabel) {
        ticks.push({ label: yLabel, start: yStart, end: yEnd });
      }
      current = new Date(current.getFullYear() + 1, 0, 1);
    }
  }
  return ticks;
}

export function ChantierGantt({ chantiers }: Props) {
  const router = useRouter();
  const [zoom, setZoom] = useState<ZoomLevel>("quarter");
  const [groupBy, setGroupBy] = useState<GroupBy>("priorite");
  const [now] = useState(() => new Date());
  const [tooltip, setTooltip] = useState<{
    item: ChantierGanttItem;
    x: number;
    y: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute date range
  const { minDate, maxDate, range } = useMemo(() => {
    if (chantiers.length === 0) {
      const d = new Date();
      return { minDate: d, maxDate: d, range: 1 };
    }
    const dates = chantiers.flatMap((c) => [
      new Date(c.date_debut),
      new Date(c.date_fin),
    ]);
    const min = startOfMonth(new Date(Math.min(...dates.map((d) => d.getTime()))));
    const max = endOfMonth(new Date(Math.max(...dates.map((d) => d.getTime()))));
    return {
      minDate: min,
      maxDate: max,
      range: Math.max(differenceInDays(max, min), 1),
    };
  }, [chantiers]);

  // Build time ticks
  const ticks = useMemo(
    () => buildTicks(minDate, maxDate, zoom),
    [minDate, maxDate, zoom]
  );

  // Tick width in px
  const tickWidth = zoom === "month" ? 80 : zoom === "quarter" ? 120 : 200;
  const totalWidth = ticks.length * tickWidth;

  // Group chantiers
  const groups = useMemo(() => {
    if (groupBy === "none") {
      return [
        {
          label: "Tous",
          color: "#6b7280",
          items: [...chantiers].sort((a, b) => a.code.localeCompare(b.code)),
        },
      ];
    }
    if (groupBy === "priorite") {
      const map = new Map<string, ChantierGanttItem[]>();
      for (const c of chantiers) {
        const list = map.get(c.priorite) ?? [];
        list.push(c);
        map.set(c.priorite, list);
      }
      return Object.keys(PRIORITE_CHANTIER_LABELS)
        .filter((p) => map.has(p))
        .map((p) => ({
          label: p,
          color: PRIORITE_CHANTIER_COLORS[p] ?? "#6b7280",
          items: (map.get(p) ?? []).sort((a, b) =>
            a.code.localeCompare(b.code)
          ),
        }));
    }
    // domaine
    const map = new Map<string, ChantierGanttItem[]>();
    for (const c of chantiers) {
      const list = map.get(c.domaine) ?? [];
      list.push(c);
      map.set(c.domaine, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dom, items]) => ({
        label: dom,
        color: DOMAINE_COLORS[dom] ?? "#6b7280",
        items: items.sort((a, b) => a.code.localeCompare(b.code)),
      }));
  }, [chantiers, groupBy]);

  // Position helpers
  function getLeftPct(date: Date) {
    return (differenceInDays(new Date(date), minDate) / range) * 100;
  }
  function getWidthPct(start: Date, end: Date) {
    return (
      (Math.max(differenceInDays(new Date(end), new Date(start)), 1) / range) *
      100
    );
  }

  const todayPct = getLeftPct(now);

  if (chantiers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucun chantier à afficher
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <Select value={zoom} onValueChange={(v) => setZoom(v as ZoomLevel)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mois</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Année</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Grouper par</span>
          <Select
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as GroupBy)}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priorite">Priorité</SelectItem>
              <SelectItem value="domaine">Domaine</SelectItem>
              <SelectItem value="none">Sans groupement</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 border-t-2 border-dashed border-red-500" />
            Aujourd&apos;hui
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-5 h-2.5 rounded-sm bg-muted-foreground/30 relative overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-[60%] bg-muted-foreground/70 rounded-sm" />
            </span>
            Avancement
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rotate-45 rounded-[1px] bg-muted-foreground/60" />
            Jalons
          </span>
        </div>
      </div>

      {/* Gantt chart */}
      <div
        ref={containerRef}
        className="border rounded-lg overflow-hidden relative"
      >
        <div className="flex">
          {/* Fixed left panel */}
          <div className="w-52 shrink-0 border-r bg-background z-20">
            {/* Header */}
            <div className="h-9 flex items-center px-3 border-b bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground">
                Chantier
              </span>
            </div>
            {/* Rows */}
            {groups.map((group) => (
              <div key={group.label}>
                {groupBy !== "none" && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted/20 border-b">
                    <div
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <span
                      className="text-[11px] font-semibold truncate"
                      style={{ color: group.color }}
                    >
                      {group.label}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-[9px] px-1 py-0"
                    >
                      {group.items.length}
                    </Badge>
                  </div>
                )}
                {group.items.map((c) => (
                  <div
                    key={c.id}
                    className="h-8 flex items-center px-3 border-b hover:bg-muted/10 cursor-pointer"
                    onClick={() => router.push(`/chantiers/${c.id}`)}
                  >
                    <span className="text-[11px] font-mono text-muted-foreground mr-2 shrink-0">
                      {c.code}
                    </span>
                    <span className="text-[11px] truncate">{c.nom}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Scrollable timeline */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ minWidth: `${totalWidth}px` }}>
              {/* Header ticks */}
              <div className="h-9 flex items-center border-b bg-muted/30 relative">
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

              {/* Rows with bars */}
              {groups.map((group) => (
                <div key={group.label}>
                  {groupBy !== "none" && (
                    <div className="h-[26px] border-b bg-muted/20" />
                  )}
                  {group.items.map((c) => {
                    const leftPct = getLeftPct(c.date_debut);
                    const widthPct = getWidthPct(c.date_debut, c.date_fin);
                    const statusColor =
                      STATUT_CHANTIER_COLORS[c.statut] ?? "#6b7280";

                    return (
                      <div
                        key={c.id}
                        className="h-8 border-b relative"
                        onMouseEnter={(e) => {
                          const rect =
                            containerRef.current?.getBoundingClientRect();
                          if (rect) {
                            setTooltip({
                              item: c,
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top,
                            });
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {/* Grid lines */}
                        {ticks.map((tick, i) => (
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

                        {/* Bar */}
                        <div
                          className="absolute top-1 bottom-1 rounded overflow-hidden cursor-pointer transition-opacity hover:opacity-90"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: statusColor + "30",
                            minWidth: "4px",
                          }}
                          onClick={() => router.push(`/chantiers/${c.id}`)}
                        >
                          {/* Progress fill */}
                          <div
                            className="h-full rounded-l"
                            style={{
                              width: `${c.avancement}%`,
                              backgroundColor: statusColor,
                            }}
                          />
                        </div>

                        {/* Milestone markers */}
                        {c.jalons?.map((j) => {
                          const jLeftPct = getLeftPct(j.date_cible);
                          if (jLeftPct < -1 || jLeftPct > 101) return null;
                          const jColor = STATUT_JALON_COLORS[j.statut] ?? "#94a3b8";
                          return (
                            <div
                              key={j.id}
                              className="absolute z-20 pointer-events-none"
                              style={{
                                left: `${jLeftPct}%`,
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                              }}
                              title={`${j.nom} (${j.statut})`}
                            >
                              <div
                                className="size-2.5 rotate-45 rounded-[1px] border border-white"
                                style={{ backgroundColor: jColor }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-xs space-y-1"
            style={{
              left: `${Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 400) - 250)}px`,
              top: `${tooltip.y + 12}px`,
              maxWidth: "250px",
            }}
          >
            <p className="font-semibold">
              {tooltip.item.code} — {tooltip.item.nom}
            </p>
            <div className="flex gap-2 text-muted-foreground">
              <span>{tooltip.item.domaine}</span>
              <span>•</span>
              <span>{tooltip.item.statut}</span>
            </div>
            <div className="flex gap-2 text-muted-foreground">
              <span>
                {format(new Date(tooltip.item.date_debut), "dd MMM yyyy", {
                  locale: fr,
                })}
              </span>
              <span>→</span>
              <span>
                {format(new Date(tooltip.item.date_fin), "dd MMM yyyy", {
                  locale: fr,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Avancement:</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${tooltip.item.avancement}%`,
                    backgroundColor:
                      STATUT_CHANTIER_COLORS[tooltip.item.statut] ?? "#6b7280",
                  }}
                />
              </div>
              <span className="font-medium">{tooltip.item.avancement}%</span>
            </div>
            <p className="text-muted-foreground/70">Cliquer pour ouvrir</p>
          </div>
        )}
      </div>
    </div>
  );
}
