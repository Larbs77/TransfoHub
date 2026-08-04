"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  format,
  differenceInCalendarDays,
  addDays,
  addMonths,
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  eachMonthOfInterval,
  min as minDate,
  max as maxDate,
  isValid,
  isAfter,
  getISOWeek,
  getISOWeekYear,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileCode2,
  GanttChart,
  Loader2,
  AlertTriangle,
  MapPin,
  Maximize2,
  Minimize2,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  PHASES,
  PHASE_COLORS,
  STATUT_JALON_COLORS,
} from "@/lib/jalon-labels";
import { collectJalonCoherenceIssues } from "@/lib/planning-coherence";

// ── Types ─────────────────────────────────────────────

export type GanttActivite = {
  id: string;
  nom: string;
  ordre: number;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
  statut: string;
};

export type GanttWorkstream = {
  id: string;
  nom: string;
  ordre: number;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
  statut: string;
  activites: GanttActivite[];
};

export type GanttJalon = {
  id: string;
  phase: string;
  nom: string;
  ordre: number;
  date_debut: Date | string | null;
  date_cible: Date | string;
  date_reelle: Date | string | null;
  statut: string;
  workstreams?: GanttWorkstream[];
};

export type GanttChantier = {
  id: string;
  code: string;
  nom: string;
  date_debut: Date | string;
  date_fin: Date | string;
  jalons: GanttJalon[];
};

type Scale = "week" | "month" | "quarter";
type PeriodContentMode = "all" | "intersect";

type RowKind = "phase" | "jalon" | "workstream" | "activite";

/** Quarter starts (T1–T4) covering [start, end]. */
function eachQuarterOfInterval(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const qMonth = Math.floor(start.getMonth() / 3) * 3;
  let d = new Date(start.getFullYear(), qMonth, 1);
  while (d <= end) {
    out.push(d);
    d = addMonths(d, 3);
  }
  return out;
}

type GanttRow = {
  key: string;
  kind: RowKind;
  label: string;
  depth: number;
  phase?: string;
  statut?: string;
  start: Date | null;
  end: Date | null;
  milestone?: Date | null;
  entityId?: string;
  hasAlert?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
};

const BOA_NAVY = "#0A3C74";
const BOA_TEAL = "#00BDBB";
const LABEL_W = 420;
const ROW_H = 36;
/** Largeur min. d’une graduation pour lisibilité (scroll horizontal OK). */
const SLOT_MIN_PX: Record<Scale, number> = {
  week: 52,
  month: 76,
  quarter: 96,
};

type TimelineTick = {
  date: Date;
  primary: string;
  secondary: string;
  leftPct: number;
  widthPct: number;
};

function parseDate(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isValid(d) ? startOfDay(d) : null;
}

// ── Component ─────────────────────────────────────────

export function ChantierGanttView({
  chantier,
  nowMs,
  backHref,
  backLabel,
}: {
  chantier: GanttChantier;
  nowMs: number;
  backHref?: string;
  backLabel?: string;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<Scale>("week");
  const [showJalons, setShowJalons] = useState(true);
  const [showWs, setShowWs] = useState(true);
  const [showAct, setShowAct] = useState(false);
  /** Filtre période affichée (YYYY-MM-DD), vide = auto */
  const [filterDu, setFilterDu] = useState("");
  const [filterAu, setFilterAu] = useState("");
  const [periodContentMode, setPeriodContentMode] =
    useState<PeriodContentMode>("all");
  const [timelineScope, setTimelineScope] =
    useState<"period" | "trajectories">("period");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");
  const now = useMemo(() => startOfDay(new Date(nowMs)), [nowMs]);
  const generatedAt = useMemo(() => new Date(nowMs), [nowMs]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const jalons = chantier.jalons ?? [];

  const alertIds = useMemo(() => {
    const set = new Set<string>();
    for (const j of jalons) {
      for (const issue of collectJalonCoherenceIssues({
        id: j.id,
        nom: j.nom,
        date_cible: j.date_cible,
        workstreams: j.workstreams,
      })) {
        set.add(issue.entityId);
      }
    }
    return set;
  }, [jalons]);

  const rows = useMemo(() => {
    const out: GanttRow[] = [];
    for (const phase of PHASES) {
      const phaseJalons = jalons
        .filter((j) => j.phase === phase)
        .sort((a, b) => a.ordre - b.ordre);
      if (phaseJalons.length === 0) continue;

      const phaseKey = `phase:${phase}`;
      const phaseCollapsed = !!collapsed[phaseKey];
      const phaseDates: Date[] = [];
      for (const jalon of phaseJalons) {
        const jalonStart = parseDate(jalon.date_debut);
        const jalonTarget = parseDate(jalon.date_cible);
        if (jalonStart) phaseDates.push(jalonStart);
        if (jalonTarget) phaseDates.push(jalonTarget);
        for (const ws of jalon.workstreams ?? []) {
          const wsStart = parseDate(ws.date_debut);
          const wsEnd = parseDate(ws.date_fin);
          if (wsStart) phaseDates.push(wsStart);
          if (wsEnd) phaseDates.push(wsEnd);
          for (const act of ws.activites ?? []) {
            const actStart = parseDate(act.date_debut);
            const actEnd = parseDate(act.date_fin);
            if (actStart) phaseDates.push(actStart);
            if (actEnd) phaseDates.push(actEnd);
          }
        }
      }
      out.push({
        key: phaseKey,
        kind: "phase",
        label: phase,
        depth: 0,
        phase,
        start: phaseDates.length ? minDate(phaseDates) : null,
        end: phaseDates.length ? maxDate(phaseDates) : null,
        collapsible: true,
        collapsed: phaseCollapsed,
      });
      if (phaseCollapsed) continue;

      for (const j of phaseJalons) {
        const jKey = `jalon:${j.id}`;
        const jCollapsed = !!collapsed[jKey];
        const debut = parseDate(j.date_debut);
        const cible = parseDate(j.date_cible);
        if (showJalons) {
          out.push({
            key: jKey,
            kind: "jalon",
            label: j.nom,
            depth: 1,
            phase,
            statut: j.statut,
            start: debut ?? cible,
            end: cible,
            milestone: cible,
            entityId: j.id,
            collapsible: (j.workstreams?.length ?? 0) > 0,
            collapsed: jCollapsed,
          });
          if (jCollapsed) continue;
        }

        const streams = [...(j.workstreams ?? [])].sort(
          (a, b) => a.ordre - b.ordre
        );
        for (const ws of streams) {
          const wsKey = `ws:${ws.id}`;
          const wsCollapsed = !!collapsed[wsKey];
          if (showWs) {
            out.push({
              key: wsKey,
              kind: "workstream",
              label: ws.nom,
              depth: showJalons ? 2 : 1,
              phase,
              statut: ws.statut,
              start: parseDate(ws.date_debut),
              end: parseDate(ws.date_fin) ?? parseDate(ws.date_debut),
              entityId: ws.id,
              hasAlert: alertIds.has(ws.id),
              collapsible: (ws.activites?.length ?? 0) > 0,
              collapsed: wsCollapsed,
            });
          }
          if (showWs && wsCollapsed) continue;

          if (showAct) {
            for (const act of [...(ws.activites ?? [])].sort(
              (a, b) => a.ordre - b.ordre
            )) {
              out.push({
                key: `act:${act.id}`,
                kind: "activite",
                label: act.nom,
                depth: (showJalons ? 2 : 1) + (showWs ? 1 : 0),
                phase,
                statut: act.statut,
                start: parseDate(act.date_debut),
                end: parseDate(act.date_fin) ?? parseDate(act.date_debut),
                entityId: act.id,
                hasAlert: alertIds.has(act.id),
              });
            }
          }
        }
      }
    }
    if (periodContentMode === "all" || (!filterDu && !filterAu)) return out;

    const filterStart = parseDate(filterDu || null) ?? new Date(-8640000000000000);
    const filterEnd = parseDate(filterAu || null) ?? new Date(8640000000000000);
    const intersects = (row: GanttRow) => {
      const start = row.start ?? row.milestone;
      const end = row.end ?? row.milestone ?? start;
      return !!start && !!end && start <= filterEnd && end >= filterStart;
    };

    return out.filter((row, index) => {
      if (intersects(row)) return true;
      if (!row.collapsible) return false;
      for (let cursor = index + 1; cursor < out.length; cursor += 1) {
        const descendant = out[cursor];
        if (descendant.depth <= row.depth) break;
        if (intersects(descendant)) return true;
      }
      return false;
    });
  }, [
    jalons,
    collapsed,
    showJalons,
    showWs,
    showAct,
    alertIds,
    periodContentMode,
    filterDu,
    filterAu,
  ]);

  const range = useMemo(() => {
    const dates: Date[] = [];
    const d0 = parseDate(chantier.date_debut);
    const d1 = parseDate(chantier.date_fin);
    if (d0) dates.push(d0);
    if (d1) dates.push(d1);
    for (const j of jalons) {
      const s = parseDate(j.date_debut);
      const c = parseDate(j.date_cible);
      if (s) dates.push(s);
      if (c) dates.push(c);
      for (const ws of j.workstreams ?? []) {
        const a = parseDate(ws.date_debut);
        const b = parseDate(ws.date_fin);
        if (a) dates.push(a);
        if (b) dates.push(b);
        for (const act of ws.activites ?? []) {
          const x = parseDate(act.date_debut);
          const y = parseDate(act.date_fin);
          if (x) dates.push(x);
          if (y) dates.push(y);
        }
      }
    }

    const filterStart = parseDate(filterDu || null);
    const filterEnd = parseDate(filterAu || null);

    if (
      (filterStart || filterEnd) &&
      periodContentMode === "intersect" &&
      timelineScope === "trajectories"
    ) {
      const selectedDates = rows.flatMap((row) =>
        [row.start, row.end, row.milestone].filter(
          (date): date is Date => Boolean(date)
        )
      );
      if (selectedDates.length) {
        return {
          start: minDate(selectedDates),
          end: maxDate(selectedDates),
          filtered: true as const,
        };
      }
    }

    // Si filtre Du/Au renseigné : la période affichée suit le filtre
    if (filterStart || filterEnd) {
      let start =
        filterStart ??
        (dates.length ? minDate(dates) : addDays(startOfDay(new Date()), -30));
      let end =
        filterEnd ??
        (dates.length ? maxDate(dates) : addDays(startOfDay(new Date()), 90));
      if (isAfter(start, end)) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      if (differenceInCalendarDays(end, start) < 1) {
        end = addDays(start, 1);
      }
      return { start, end, filtered: true as const };
    }

    if (dates.length === 0) {
      const today = startOfDay(new Date());
      return {
        start: addDays(today, -30),
        end: addDays(today, 90),
        filtered: false as const,
      };
    }
    let start = minDate(dates);
    let end = maxDate(dates);
    if (scale === "week") {
      start = startOfWeek(addDays(start, -7), { weekStartsOn: 1 });
      end = endOfWeek(addDays(end, 14), { weekStartsOn: 1 });
    } else if (scale === "month") {
      start = startOfMonth(addDays(start, -15));
      end = endOfMonth(addDays(end, 30));
    } else {
      // quarter: align + 1 quarter padding
      const q0 = Math.floor(start.getMonth() / 3) * 3;
      start = new Date(start.getFullYear(), q0 - 3, 1);
      const q1 = Math.floor(end.getMonth() / 3) * 3;
      end = endOfMonth(new Date(end.getFullYear(), q1 + 5, 1));
    }
    if (differenceInCalendarDays(end, start) < 14) {
      end = addDays(start, 30);
    }
    return { start, end, filtered: false as const };
  }, [
    chantier,
    jalons,
    scale,
    filterDu,
    filterAu,
    periodContentMode,
    timelineScope,
    rows,
  ]);

  const totalDays = Math.max(
    differenceInCalendarDays(range.end, range.start),
    1
  );

  const ticks = useMemo((): TimelineTick[] => {
    let dates: Date[] = [];
    if (scale === "week") {
      dates = eachWeekOfInterval(
        { start: range.start, end: range.end },
        { weekStartsOn: 1 }
      );
    } else if (scale === "month") {
      dates = eachMonthOfInterval({ start: range.start, end: range.end });
    } else {
      dates = eachQuarterOfInterval(range.start, range.end);
    }

    const raw = dates.map((d) => {
      let primary: string;
      let secondary: string;
      if (scale === "week") {
        primary = `S${getISOWeek(d)}`;
        secondary = String(getISOWeekYear(d));
      } else if (scale === "month") {
        const m = format(d, "MMM", { locale: fr });
        primary = m.charAt(0).toUpperCase() + m.slice(1);
        secondary = format(d, "yyyy");
      } else {
        const t = Math.floor(d.getMonth() / 3) + 1;
        primary = `T${t}`;
        secondary = String(d.getFullYear());
      }
      const leftPct =
        (differenceInCalendarDays(d, range.start) / totalDays) * 100;
      return { date: d, primary, secondary, leftPct };
    });

    return raw.map((t, i) => {
      const nextLeft = raw[i + 1]?.leftPct ?? 100;
      const widthPct = Math.max(0.5, nextLeft - t.leftPct);
      return { ...t, widthPct };
    });
  }, [scale, range, totalDays]);

  const timelineMinWidth = Math.max(
    640,
    ticks.length * SLOT_MIN_PX[scale]
  );

  const dayPct = (d: Date) =>
    (differenceInCalendarDays(d, range.start) / totalDays) * 100;

  const chantierStart = parseDate(chantier.date_debut);
  const chantierEnd = parseDate(chantier.date_fin);
  const todayPct =
    now >= range.start && now <= range.end ? dayPct(now) : null;

  const scrollToToday = useCallback(() => {
    const scroller = exportRef.current;
    if (!scroller || todayPct == null) {
      setToast("La date d'aujourd'hui est hors de la période affichée.");
      return;
    }
    const target = LABEL_W + (todayPct / 100) * timelineMinWidth;
    scroller.scrollTo({
      left: Math.max(0, target - scroller.clientWidth / 2),
      behavior: "smooth",
    });
  }, [todayPct, timelineMinWidth]);

  const fitPlanning = useCallback(() => {
    setFilterDu("");
    setFilterAu("");
    setPeriodContentMode("all");
    setScale("quarter");
    setToast("");
  }, []);

  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const stamp = format(new Date(), "yyyy-MM-dd");
  const baseName = `GANTT_${chantier.code}_${stamp}`;

  const runExport = useCallback(
    async () => {
      setExporting(true);
      setToast("");
      try {
        const { buildGanttStandaloneHtml, downloadTextFile } = await import(
          "@/lib/gantt-export-html"
        );
        const html = buildGanttStandaloneHtml(
          {
            code: chantier.code,
            nom: chantier.nom,
            date_debut: chantier.date_debut,
            date_fin: chantier.date_fin,
            jalons,
          },
          {
            scale,
            showJalons,
            showWorkstreams: showWs,
            showActivites: showAct,
            filterDu: filterDu || undefined,
            filterAu: filterAu || undefined,
          }
        );
        downloadTextFile(html, `${baseName}.html`);
        setToast(
          "Fichier HTML téléchargé — ouvrez-le dans un navigateur (comité / hors ligne)."
        );
      } catch (e) {
        setToast(
          e instanceof Error
            ? e.message
            : "Échec de l'export HTML. Réessayez."
        );
      } finally {
        setExporting(false);
      }
    },
    [
      baseName,
      chantier.code,
      chantier.nom,
      chantier.date_debut,
      chantier.date_fin,
      jalons,
      scale,
      showJalons,
      showWs,
      showAct,
      filterDu,
      filterAu,
    ]
  );

  const totalWs = jalons.reduce(
    (n, j) => n + (j.workstreams?.length ?? 0),
    0
  );
  const totalAct = jalons.reduce(
    (n, j) =>
      n +
      (j.workstreams?.reduce((m, w) => m + (w.activites?.length ?? 0), 0) ??
        0),
    0
  );

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[60] overflow-y-auto bg-background"
          : "min-h-screen bg-background"
      }
    >
      <div
        className={`mx-auto space-y-4 p-4 md:p-6 ${
          isFullscreen ? "max-w-none" : "max-w-[1600px]"
        }`}
      >
        {/* App chrome (not in export) */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref ?? `/chantiers/${chantier.id}`}>
              <ArrowLeft className="size-4" />
              {backLabel ?? "Fiche chantier"}
            </Link>
          </Button>
          <Badge variant="outline" className="text-sm font-semibold">
            {chantier.code}
          </Badge>
          <Button
            type="button"
            variant={isFullscreen ? "default" : "outline"}
            size="sm"
            className="ml-auto"
            onClick={() => setIsFullscreen((value) => !value)}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
            {isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle
              className="flex items-center gap-2 text-xl"
              style={{ color: BOA_NAVY }}
            >
              <GanttChart className="size-5" style={{ color: BOA_TEAL }} />
              Planning GANTT
            </CardTitle>
            <CardDescription className="text-sm">
              {chantier.nom}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                {jalons.length} jalon(s) · {totalWs} WS · {totalAct} act.
              </span>
              <span>·</span>
              <span>
                Chantier :{" "}
                {chantierStart
                  ? format(chantierStart, "dd MMM yyyy", { locale: fr })
                  : "—"}{" "}
                →{" "}
                {chantierEnd
                  ? format(chantierEnd, "dd MMM yyyy", { locale: fr })
                  : "—"}
              </span>
            </div>

            <div className="relative flex flex-wrap items-center gap-2 border-t pt-4">
              <div className="flex rounded-md border p-0.5">
                {(
                  [
                    ["week", "Semaine"],
                    ["month", "Mois"],
                    ["quarter", "Trimestre"],
                  ] as const
                ).map(([k, lab]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setScale(k)}
                    aria-pressed={scale === k}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      scale === k
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {lab}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground font-medium">Du</span>
                <Input
                  type="date"
                  value={filterDu}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilterDu(value);
                    setPeriodContentMode(value || filterAu ? "intersect" : "all");
                  }}
                  className="h-8 w-[9.5rem] text-xs"
                  title="Date de début du filtre"
                />
                <span className="text-muted-foreground font-medium">Au</span>
                <Input
                  type="date"
                  value={filterAu}
                  min={filterDu || undefined}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilterAu(value);
                    setPeriodContentMode(value || filterDu ? "intersect" : "all");
                  }}
                  className="h-8 w-[9.5rem] text-xs"
                  title="Date de fin du filtre"
                />
                {(filterDu || filterAu) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setFilterDu("");
                      setFilterAu("");
                      setPeriodContentMode("all");
                      setTimelineScope("period");
                    }}
                  >
                    Réinit.
                  </Button>
                )}
              </div>

              <div
                className="flex rounded-md border p-0.5"
                aria-label="Contenu affiché pour la période"
              >
                {(
                  [
                    ["all", "Tous les éléments"],
                    ["intersect", "Planifiés sur la période"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPeriodContentMode(mode)}
                    aria-pressed={periodContentMode === mode}
                    disabled={mode === "intersect" && !filterDu && !filterAu}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      periodContentMode === mode
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(filterDu || filterAu) && periodContentMode === "intersect" && (
                <div
                  className="flex rounded-md border border-[#00BDBB]/30 bg-[#00BDBB]/5 p-0.5"
                  aria-label="Étendue de la frise"
                >
                  {(
                    [
                      ["period", "Fenêtre filtrée"],
                      ["trajectories", "Trajectoires complètes"],
                    ] as const
                  ).map(([scope, label]) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setTimelineScope(scope)}
                      aria-pressed={timelineScope === scope}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        timelineScope === scope
                          ? "bg-[#0A3C74] text-white shadow-sm"
                          : "text-[#0A3C74] hover:bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={showJalons}
                  onChange={(e) => setShowJalons(e.target.checked)}
                />
                Jalons
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={showWs}
                  onChange={(e) => setShowWs(e.target.checked)}
                />
                Workstreams
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={showAct}
                  onChange={(e) => setShowAct(e.target.checked)}
                />
                Activités
              </label>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={scrollToToday}
                disabled={todayPct == null}
                title="Centrer le planning sur aujourd'hui"
              >
                <MapPin className="size-3.5 text-rose-500" />
                Aujourd&apos;hui
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={fitPlanning}
                title="Afficher l'ensemble de la période du chantier"
              >
                <ScanLine className="size-3.5" />
                Ajuster
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={exporting || jalons.length === 0}
                onClick={runExport}
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileCode2 className="size-4" />
                )}
                Exporter HTML
              </Button>
            </div>
          </CardContent>
        </Card>

        {toast && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
            {toast}
          </div>
        )}

        {jalons.length === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
            Aucun jalon sur ce chantier. Créez des jalons sur la fiche pour
            afficher le Gantt.
          </div>
        ) : (
          <div
            ref={exportRef}
            className={`rounded-lg border bg-white text-slate-900 shadow-sm ${
              isFullscreen
                ? "max-h-[calc(100vh-11rem)] overflow-auto"
                : "max-h-[72vh] overflow-auto"
            }`}
            data-gantt-export-root
          >
            {/* Export header (always visible, clean for capture) */}
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: BOA_TEAL }}
                  >
                    Bank of Africa · TransfoHub
                  </p>
                  <p className="text-base font-bold" style={{ color: BOA_NAVY }}>
                    Planning GANTT — {chantier.code}
                  </p>
                  <p className="text-sm text-slate-600">{chantier.nom}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>
                    Échelle :{" "}
                    {scale === "week"
                      ? "Semaine"
                      : scale === "month"
                        ? "Mois"
                        : "Trimestre"}
                  </p>
                  <p>
                    Généré le{" "}
                    {format(generatedAt, "dd/MM/yyyy HH:mm", { locale: fr })}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="flex min-w-full"
              style={{ width: LABEL_W + timelineMinWidth }}
            >
              {/* Colonne structure sticky */}
              <div
                className="sticky left-0 z-30 shrink-0 border-r border-slate-200 bg-white shadow-[2px_0_4px_rgba(15,23,42,0.06)]"
                style={{ width: LABEL_W }}
              >
                <div className="sticky top-0 z-20 flex h-12 items-end border-b border-slate-200 bg-slate-50 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.25)]">
                  Structure
                </div>
                {rows.map((row) => {
                  const phaseColor =
                    (row.phase && PHASE_COLORS[row.phase]) || BOA_NAVY;
                  return (
                    <div
                      key={`lab-${row.key}`}
                      className={`relative flex items-center gap-1 border-b border-slate-100 px-2 text-xs ${
                        row.kind === "phase" ? "bg-slate-50" : "bg-white"
                      }`}
                      style={{
                        minHeight: ROW_H,
                        paddingLeft: 8 + row.depth * 14,
                      }}
                    >
                      {row.depth > 0 && (
                        <span
                          className="pointer-events-none absolute inset-y-0 border-l border-slate-200"
                          style={{ left: 13 + (row.depth - 1) * 14 }}
                        />
                      )}
                      {row.collapsible ? (
                        <button
                          type="button"
                          className="size-5 shrink-0 rounded hover:bg-slate-200"
                          onClick={() => toggle(row.key)}
                        >
                          {row.collapsed ? (
                            <ChevronRight className="mx-auto size-3.5" />
                          ) : (
                            <ChevronDown className="mx-auto size-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="inline-block size-5 shrink-0" />
                      )}
                      {row.kind === "phase" && (
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: phaseColor }}
                        />
                      )}
                      <span
                        className={`truncate ${
                          row.kind === "phase"
                            ? "font-semibold"
                            : row.kind === "jalon"
                              ? "font-medium"
                              : ""
                        }`}
                        style={
                          row.kind === "phase"
                            ? { color: phaseColor }
                            : undefined
                        }
                        title={row.label}
                      >
                        {row.label}
                      </span>
                      {(row.start || row.end || row.milestone) && (
                        <span
                          className="ml-auto flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums text-slate-500"
                          title="Date de début → date de fin"
                        >
                          <span>
                            {format(row.start ?? row.milestone!, "dd/MM/yy")}
                          </span>
                          <span className="text-[#00BDBB]">→</span>
                          <span>
                            {format(
                              row.end ?? row.milestone ?? row.start!,
                              "dd/MM/yy"
                            )}
                          </span>
                        </span>
                      )}
                      {row.hasAlert && (
                        <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                      )}
                      {row.kind !== "phase" && (
                        <span className="shrink-0 text-[9px] uppercase text-slate-400">
                          {row.kind === "jalon"
                            ? "J"
                            : row.kind === "workstream"
                              ? "WS"
                              : "Act"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Timeline scrollable */}
              <div className="min-w-0 flex-1">
                <div style={{ minWidth: timelineMinWidth }}>
                  {/* Header 2 lignes */}
                  <div className="sticky top-0 z-20 h-12 border-b border-slate-200 bg-slate-50 shadow-[0_1px_0_rgba(148,163,184,0.25)]">
                    {ticks.map((t, i) => (
                      <div
                        key={i}
                        className="absolute top-0 flex h-full flex-col items-center justify-center border-l border-slate-200/90 px-0.5"
                        style={{
                          left: `${t.leftPct}%`,
                          width: `${t.widthPct}%`,
                        }}
                        title={
                          scale === "week"
                            ? `Semaine ${t.primary.replace("S", "")} · ${t.secondary}`
                            : `${t.primary} ${t.secondary}`
                        }
                      >
                        <span className="text-[11px] font-semibold leading-tight text-slate-700">
                          {t.primary}
                        </span>
                        <span className="text-[10px] font-medium leading-tight text-slate-400">
                          {t.secondary}
                        </span>
                      </div>
                    ))}
                    {todayPct != null && (
                      <div
                        className="absolute top-0 z-[2] flex -translate-x-1/2 flex-col items-center"
                        style={{ left: `${todayPct}%` }}
                      >
                        <MapPin className="size-3.5 fill-rose-500 text-white drop-shadow" />
                        <span className="text-[9px] font-semibold text-rose-600">
                          Auj.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bars */}
                  {rows.map((row) => {
                    const phaseColor =
                      (row.phase && PHASE_COLORS[row.phase]) || BOA_NAVY;
                    const statutColor =
                      (row.statut && STATUT_JALON_COLORS[row.statut]) ||
                      "#94a3b8";

                    let barLeft = 0;
                    let barWidth = 0;
                    let hasBar = false;
                    if (row.start && row.end) {
                      const l = dayPct(row.start);
                      const r = dayPct(addDays(row.end, 1));
                      barLeft = Math.max(0, Math.min(100, l));
                      barWidth = Math.max(
                        0.4,
                        Math.min(100 - barLeft, r - l)
                      );
                      hasBar = true;
                    }
                    let msLeft: number | null = null;
                    if (row.milestone) {
                      msLeft = Math.max(
                        0,
                        Math.min(100, dayPct(row.milestone))
                      );
                    }

                    return (
                      <div
                        key={`tl-${row.key}`}
                        className={`relative border-b border-slate-100 ${
                          row.kind === "phase" ? "bg-slate-50/80" : "bg-white"
                        }`}
                        style={{ minHeight: ROW_H }}
                      >
                        {chantierStart &&
                          chantierEnd &&
                          (() => {
                            const l = dayPct(chantierStart);
                            const r = dayPct(chantierEnd);
                            return (
                              <div
                                className="pointer-events-none absolute inset-y-1 rounded-sm border border-dashed border-sky-400/40 bg-sky-50/50"
                                style={{
                                  left: `${Math.max(0, l)}%`,
                                  width: `${Math.max(1, r - l)}%`,
                                }}
                              />
                            );
                          })()}

                        {row.kind === "phase" && (
                          <div
                            className="absolute inset-0 opacity-10"
                            style={{ backgroundColor: phaseColor }}
                          />
                        )}

                        {/* vertical grid lines under ticks */}
                        {ticks.map((t, i) => (
                          <div
                            key={i}
                            className="pointer-events-none absolute inset-y-0 border-l border-slate-100"
                            style={{ left: `${t.leftPct}%` }}
                          />
                        ))}

                        {hasBar && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 rounded-md shadow-sm"
                            style={{
                              left: `${barLeft}%`,
                              width: `${barWidth}%`,
                              height:
                                row.kind === "phase"
                                  ? 20
                                  : row.kind === "workstream"
                                    ? 16
                                    : row.kind === "jalon"
                                      ? 12
                                      : 10,
                              backgroundColor:
                                row.kind === "phase"
                                  ? phaseColor
                                  : row.kind === "workstream"
                                    ? BOA_NAVY
                                    : row.kind === "jalon"
                                      ? statutColor
                                      : BOA_TEAL,
                              opacity:
                                row.kind === "phase"
                                  ? 0.32
                                  : row.kind === "activite"
                                    ? 0.85
                                    : 0.9,
                            }}
                            title={`${row.label}${
                              row.start
                                ? ` · ${format(row.start, "dd/MM/yyyy")}`
                                : ""
                            }${
                              row.end
                                ? ` → ${format(row.end, "dd/MM/yyyy")}`
                                : ""
                            }`}
                          />
                        )}

                        {msLeft != null && (
                          <div
                            className="absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${msLeft}%` }}
                            title={`Jalon · ${
                              row.milestone
                                ? format(row.milestone, "dd/MM/yyyy")
                                : ""
                            } · ${row.statut ?? ""}`}
                          >
                            <div
                              className="size-3 rotate-45 rounded-[2px] border-2 border-white shadow"
                              style={{ backgroundColor: statutColor }}
                            />
                          </div>
                        )}

                        {todayPct != null && (
                          <div
                            className="pointer-events-none absolute inset-y-0 z-[2] w-px bg-rose-500/80"
                            style={{ left: `${todayPct}%` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm bg-slate-500/35" />
                Phase calculée
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rotate-45 rounded-[1px] bg-blue-500" />
                Jalon (période + date cible)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-5 rounded-sm"
                  style={{ backgroundColor: BOA_NAVY }}
                />
                Workstream
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-5 rounded-sm"
                  style={{ backgroundColor: BOA_TEAL }}
                />
                Activité
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-0 border-l border-dashed border-sky-400" />
                Plage chantier
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3 text-rose-500" />
                Aujourd&apos;hui
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="size-3 text-amber-500" />
                Alerte cohérence dates
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
