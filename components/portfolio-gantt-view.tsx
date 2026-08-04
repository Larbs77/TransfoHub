"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  isValid,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  FileCode2,
  GanttChart,
  ListFilter,
  Maximize2,
  Minimize2,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PHASES, PHASE_COLORS, STATUT_JALON_COLORS } from "@/lib/jalon-labels";

type D = Date | string | null;
type Activite = { id: string; nom: string; ordre: number; date_debut: D; date_fin: D; statut: string };
type Workstream = { id: string; nom: string; ordre: number; date_debut: D; date_fin: D; statut: string; activites: Activite[] };
type Jalon = { id: string; phase: string; nom: string; ordre: number; date_debut: D; date_cible: Date | string; statut: string; workstreams: Workstream[] };
type Chantier = { id: string; code: string; nom: string; domaine: string; date_debut: Date | string; date_fin: Date | string; jalons: Jalon[] };
type Scale = "week" | "month" | "quarter";
type Row = { key: string; kind: "phase" | "jalon" | "workstream" | "activite"; label: string; depth: number; phase: string; start: Date | null; end: Date | null; milestone?: Date | null; statut?: string };

const LABEL_W = 460;
const ROW_H = 34;
const BOA_NAVY = "#0A3C74";
const BOA_TEAL = "#00BDBB";
const SLOT_WIDTH: Record<Scale, number> = { week: 48, month: 72, quarter: 104 };

function parseDate(value: D): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? startOfDay(date) : null;
}

function quarters(start: Date, end: Date) {
  const values: Date[] = [];
  let date = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
  while (date <= end) {
    values.push(date);
    date = addMonths(date, 3);
  }
  return values;
}

function allPlanningDates(chantier: Chantier) {
  const dates: Date[] = [];
  const add = (value: D) => {
    const date = parseDate(value);
    if (date) dates.push(date);
  };
  add(chantier.date_debut);
  add(chantier.date_fin);
  for (const jalon of chantier.jalons) {
    add(jalon.date_debut);
    add(jalon.date_cible);
    for (const ws of jalon.workstreams) {
      add(ws.date_debut);
      add(ws.date_fin);
      for (const act of ws.activites) {
        add(act.date_debut);
        add(act.date_fin);
      }
    }
  }
  return dates;
}

function buildRows(
  chantier: Chantier,
  levels: { jalons: boolean; workstreams: boolean; activites: boolean },
  filter: { start: Date | null; end: Date | null; intersectOnly: boolean }
) {
  const rows: Row[] = [];
  for (const phase of PHASES) {
    const phaseJalons = chantier.jalons.filter((jalon) => jalon.phase === phase);
    if (!phaseJalons.length) continue;
    const phaseDates = phaseJalons.flatMap((jalon) => {
      const values: Date[] = [];
      for (const value of [jalon.date_debut, jalon.date_cible]) {
        const date = parseDate(value);
        if (date) values.push(date);
      }
      for (const ws of jalon.workstreams) {
        for (const value of [ws.date_debut, ws.date_fin]) {
          const date = parseDate(value);
          if (date) values.push(date);
        }
        for (const act of ws.activites) {
          for (const value of [act.date_debut, act.date_fin]) {
            const date = parseDate(value);
            if (date) values.push(date);
          }
        }
      }
      return values;
    });
    rows.push({ key: `phase:${phase}`, kind: "phase", label: phase, depth: 0, phase, start: phaseDates.length ? minDate(phaseDates) : null, end: phaseDates.length ? maxDate(phaseDates) : null });
    for (const jalon of phaseJalons) {
      const target = parseDate(jalon.date_cible);
      if (levels.jalons) rows.push({ key: `jalon:${jalon.id}`, kind: "jalon", label: jalon.nom, depth: 1, phase, start: parseDate(jalon.date_debut) ?? target, end: target, milestone: target, statut: jalon.statut });
      for (const ws of jalon.workstreams) {
        if (levels.workstreams) rows.push({ key: `ws:${ws.id}`, kind: "workstream", label: ws.nom, depth: levels.jalons ? 2 : 1, phase, start: parseDate(ws.date_debut), end: parseDate(ws.date_fin) ?? parseDate(ws.date_debut), statut: ws.statut });
        if (levels.activites) for (const act of ws.activites) rows.push({ key: `act:${act.id}`, kind: "activite", label: act.nom, depth: (levels.jalons ? 2 : 1) + (levels.workstreams ? 1 : 0), phase, start: parseDate(act.date_debut), end: parseDate(act.date_fin) ?? parseDate(act.date_debut), statut: act.statut });
      }
    }
  }
  if (!filter.intersectOnly || (!filter.start && !filter.end)) return rows;
  const start = filter.start ?? new Date(-8640000000000000);
  const end = filter.end ?? new Date(8640000000000000);
  const intersects = (row: Row) => !!row.start && !!row.end && row.start <= end && row.end >= start;
  return rows.filter((row, index) => {
    if (intersects(row)) return true;
    for (let next = index + 1; next < rows.length; next += 1) {
      if (rows[next].depth <= row.depth) break;
      if (intersects(rows[next])) return true;
    }
    return false;
  });
}

export function PortfolioGanttView({ chantiers, nowMs }: { chantiers: Chantier[]; nowMs: number }) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<Scale>("month");
  const [filterDu, setFilterDu] = useState("");
  const [filterAu, setFilterAu] = useState("");
  const [intersectOnly, setIntersectOnly] = useState(false);
  const [timelineScope, setTimelineScope] =
    useState<"period" | "trajectories">("period");
  const [showJalons, setShowJalons] = useState(true);
  const [showWs, setShowWs] = useState(true);
  const [showAct, setShowAct] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"all" | "custom">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    chantiers.map((chantier) => chantier.id)
  );
  const [collapsedChantiers, setCollapsedChantiers] = useState<
    Record<string, boolean>
  >({});
  const now = useMemo(() => startOfDay(new Date(nowMs)), [nowMs]);
  const displayedChantiers = useMemo(
    () =>
      selectionMode === "all"
        ? chantiers
        : chantiers.filter((chantier) => selectedIds.includes(chantier.id)),
    [chantiers, selectionMode, selectedIds]
  );

  const range = useMemo(() => {
    let dates = displayedChantiers.flatMap(allPlanningDates);
    if (
      (filterDu || filterAu) &&
      intersectOnly &&
      timelineScope === "trajectories"
    ) {
      const trajectoryDates = displayedChantiers.flatMap((chantier) =>
        buildRows(
          chantier,
          { jalons: showJalons, workstreams: showWs, activites: showAct },
          {
            start: parseDate(filterDu),
            end: parseDate(filterAu),
            intersectOnly: true,
          }
        ).flatMap((row) =>
          [row.start, row.end, row.milestone].filter(
            (date): date is Date => Boolean(date)
          )
        )
      );
      if (trajectoryDates.length) dates = trajectoryDates;
    }
    const useFilterWindow = timelineScope === "period" || !intersectOnly;
    let start = (useFilterWindow ? parseDate(filterDu) : null) ?? (dates.length ? minDate(dates) : addDays(now, -30));
    let end = (useFilterWindow ? parseDate(filterAu) : null) ?? (dates.length ? maxDate(dates) : addDays(now, 90));
    if (start > end) [start, end] = [end, start];
    if (!filterDu && !filterAu) {
      if (scale === "week") { start = startOfWeek(addDays(start, -7), { weekStartsOn: 1 }); end = endOfWeek(addDays(end, 7), { weekStartsOn: 1 }); }
      else if (scale === "month") { start = startOfMonth(start); end = endOfMonth(end); }
      else { start = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1); end = endOfMonth(new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3 + 2, 1)); }
    }
    return { start, end };
  }, [
    displayedChantiers,
    filterDu,
    filterAu,
    now,
    scale,
    intersectOnly,
    timelineScope,
    showJalons,
    showWs,
    showAct,
  ]);

  const totalDays = Math.max(1, differenceInCalendarDays(range.end, range.start));
  const tickDates = scale === "week" ? eachWeekOfInterval(range, { weekStartsOn: 1 }) : scale === "month" ? eachMonthOfInterval(range) : quarters(range.start, range.end);
  const timelineWidth = Math.max(720, tickDates.length * SLOT_WIDTH[scale]);
  const totalWidth = LABEL_W + timelineWidth;
  const pct = (date: Date) => (differenceInCalendarDays(date, range.start) / totalDays) * 100;
  const todayPct = now >= range.start && now <= range.end ? pct(now) : null;
  const rowsByChantier = useMemo(() => displayedChantiers.map((chantier) => ({ chantier, rows: buildRows(chantier, { jalons: showJalons, workstreams: showWs, activites: showAct }, { start: parseDate(filterDu), end: parseDate(filterAu), intersectOnly }) })).filter((item) => item.rows.length), [displayedChantiers, showJalons, showWs, showAct, filterDu, filterAu, intersectOnly]);

  const exportHtml = () => {
    const root = exportRef.current;
    if (!root) return;
    const css = Array.from(document.styleSheets).flatMap((sheet) => { try { return Array.from(sheet.cssRules).map((rule) => rule.cssText); } catch { return []; } }).join("\n");
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Gantt portefeuille</title><style>${css}body{margin:24px;background:#fff}</style></head><body>${root.outerHTML}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `GANTT_PORTEFEUILLE_${format(now, "yyyy-MM-dd")}.html`; link.click(); URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSelectionMode("all");
    setSelectedIds(chantiers.map((chantier) => chantier.id));
    setScale("month");
    setFilterDu("");
    setFilterAu("");
    setIntersectOnly(false);
    setTimelineScope("period");
    setShowJalons(true);
    setShowWs(true);
    setShowAct(false);
    setCollapsedChantiers({});
  };

  return (
    <div className={fullscreen ? "fixed inset-0 z-[60] overflow-auto bg-background p-5" : "space-y-4"}>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={resetFilters}><RotateCcw className="size-4" />Réinitialiser les filtres</Button>
        <Badge variant="outline">
          {displayedChantiers.length} affiché{displayedChantiers.length > 1 ? "s" : ""} / {chantiers.length}
        </Badge>
        <Button className="ml-auto" variant={fullscreen ? "default" : "outline"} size="sm" onClick={() => setFullscreen((value) => !value)}>{fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}{fullscreen ? "Quitter le plein écran" : "Plein écran"}</Button>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h1 className="flex items-center gap-2 text-xl font-bold text-[#0A3C74]"><GanttChart className="size-5 text-[#00BDBB]" />Gantt portefeuille — Chantiers en cours</h1><p className="mt-1 text-sm text-muted-foreground">Vue consolidée et comparative des trajectoires du programme</p></div>
          <Button variant="outline" size="sm" onClick={exportHtml}><FileCode2 className="size-4" />Exporter HTML</Button>
        </div>
        <div className="space-y-3 border-t pt-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => setSelectionMode("all")}
              className={`rounded px-2.5 py-1 font-medium ${
                selectionMode === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Tous les chantiers
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode("custom")}
              className={`rounded px-2.5 py-1 font-medium ${
                selectionMode === "custom"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Sélection personnalisée
            </button>
          </div>
          {selectionMode === "custom" && (
            <details className="relative">
              <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md border bg-background px-3 font-medium text-foreground shadow-xs hover:bg-muted/50">
                <ListFilter className="size-3.5 text-[#00BDBB]" />
                {selectedIds.length} chantier{selectedIds.length > 1 ? "s" : ""} sélectionné{selectedIds.length > 1 ? "s" : ""}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </summary>
              <div className="absolute left-0 top-10 z-50 w-[360px] rounded-lg border bg-card p-2 shadow-xl">
                <div className="mb-2 flex items-center justify-between border-b px-2 pb-2">
                  <p className="text-xs font-semibold">Choisir les chantiers</p>
                  <div className="flex gap-1">
                    <button type="button" className="rounded px-2 py-1 text-[10px] text-primary hover:bg-muted" onClick={() => setSelectedIds(chantiers.map((chantier) => chantier.id))}>Tout</button>
                    <button type="button" className="rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted" onClick={() => setSelectedIds([])}>Aucun</button>
                  </div>
                </div>
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {chantiers.map((chantier) => {
                    const checked = selectedIds.includes(chantier.id);
                    return (
                      <label key={chantier.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/60">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, chantier.id]
                                : current.filter((id) => id !== chantier.id)
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="mr-2 font-mono text-[10px] font-semibold text-[#0A3C74]">{chantier.code}</span>
                          <span className="text-[11px] leading-tight text-foreground">{chantier.nom}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </details>
          )}
          <div className="flex rounded-md border p-0.5">{([['week','Semaine'],['month','Mois'],['quarter','Trimestre']] as const).map(([value,label]) => <button key={value} onClick={() => setScale(value)} className={`rounded px-2.5 py-1 font-medium ${scale === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{label}</button>)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-3">
          <CalendarRange className="ml-1 size-4 text-muted-foreground" /><span>Du</span><Input type="date" value={filterDu} onChange={(event) => { const value = event.target.value; setFilterDu(value); setIntersectOnly(Boolean(value || filterAu)); }} className="h-8 w-36 text-xs" /><span>au</span><Input type="date" value={filterAu} min={filterDu || undefined} onChange={(event) => { const value = event.target.value; setFilterAu(value); setIntersectOnly(Boolean(value || filterDu)); }} className="h-8 w-36 text-xs" />
          <div className="flex rounded-md border p-0.5"><button onClick={() => setIntersectOnly(false)} className={`rounded px-2.5 py-1 font-medium ${!intersectOnly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Tous les éléments</button><button disabled={!filterDu && !filterAu} onClick={() => setIntersectOnly(true)} className={`rounded px-2.5 py-1 font-medium disabled:opacity-40 ${intersectOnly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Planifiés sur la période</button></div>
          {(filterDu || filterAu) && intersectOnly && <div className="flex rounded-md border border-[#00BDBB]/30 bg-[#00BDBB]/5 p-0.5" aria-label="Étendue de la frise">{([['period','Fenêtre filtrée'],['trajectories','Trajectoires complètes']] as const).map(([scope,label]) => <button key={scope} type="button" onClick={() => setTimelineScope(scope)} aria-pressed={timelineScope === scope} className={`rounded px-2.5 py-1 font-medium transition-colors ${timelineScope === scope ? 'bg-[#0A3C74] text-white shadow-sm' : 'text-[#0A3C74] hover:bg-white'}`}>{label}</button>)}</div>}
          {([['Jalons',showJalons,setShowJalons],['Workstreams',showWs,setShowWs],['Activités',showAct,setShowAct]] as const).map(([label,checked,setter]) => <label key={label} className="flex items-center gap-1"><input type="checkbox" checked={checked} onChange={(event) => setter(event.target.checked)} />{label}</label>)}
          <Button variant="ghost" size="sm" className="h-8" onClick={() => { setFilterDu(''); setFilterAu(''); setIntersectOnly(false); setTimelineScope('period'); }}><ScanLine className="size-4" />Ajuster</Button>
          </div>
        </div>
      </div>

      <div ref={exportRef} className={fullscreen ? "max-h-[calc(100vh-13rem)] overflow-auto rounded-xl border bg-white" : "max-h-[72vh] overflow-auto rounded-xl border bg-white shadow-sm"}>
        <div className="relative" style={{ width: totalWidth }}>
          <div className="sticky top-0 z-40 flex h-12 border-b bg-slate-50 shadow-sm">
            <div className="sticky left-0 z-50 flex w-[460px] shrink-0 items-center border-r bg-slate-50 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Portefeuille / structure <span className="ml-auto normal-case tracking-normal text-slate-400">Début → Fin</span></div>
            <div className="relative" style={{ width: timelineWidth }}>{tickDates.map((date, index) => { const left = pct(date); const next = tickDates[index + 1]; const width = next ? pct(next) - left : 100 - left; const primary = scale === 'week' ? `S${getISOWeek(date)}` : scale === 'month' ? format(date, 'MMM', { locale: fr }) : `T${Math.floor(date.getMonth()/3)+1}`; const secondary = scale === 'week' ? getISOWeekYear(date) : date.getFullYear(); return <div key={date.toISOString()} className="absolute inset-y-0 flex flex-col items-center justify-center border-l text-[10px] text-slate-500" style={{ left:`${left}%`, width:`${width}%` }}><strong className="text-slate-700">{primary}</strong><span>{secondary}</span></div>; })}{todayPct != null && <div className="absolute inset-y-0 z-20 w-px bg-rose-500" style={{ left:`${todayPct}%` }} />}</div>
          </div>
          {rowsByChantier.map(({ chantier, rows }) => {
            const isCollapsed = Boolean(collapsedChantiers[chantier.id]);
            return <section key={chantier.id}>
            <div className="sticky left-0 z-30 flex h-14 items-center border-y border-[#0A3C74]/15 bg-[#0A3C74]/[0.045]" style={{ width: totalWidth }}><div className="sticky left-0 flex w-[460px] shrink-0 items-center gap-3 border-r bg-[#f4f7fb] px-4"><button type="button" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#0A3C74]/15 bg-white text-[#0A3C74] shadow-sm transition hover:border-[#00BDBB] hover:bg-[#00BDBB]/10" onClick={() => setCollapsedChantiers((current) => ({ ...current, [chantier.id]: !isCollapsed }))} aria-label={`${isCollapsed ? "Déployer" : "Réduire"} ${chantier.code}`} title={`${isCollapsed ? "Déployer" : "Réduire"} l'arborescence`}>{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button><Badge className="bg-[#0A3C74]">{chantier.code}</Badge><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#0A3C74]" title={chantier.nom}>{chantier.nom}</p><p className="text-[10px] text-slate-500">{isCollapsed ? "Arborescence masquée" : `${rows.length} lignes affichées`}</p></div><Button asChild variant="outline" size="sm" className="h-7 border-[#00BDBB]/50 text-[10px]"><Link href={`/chantiers/${chantier.id}/gantt?from=jalons`}>Détail</Link></Button></div></div>
            {!isCollapsed && rows.map((row) => { const phaseColor = PHASE_COLORS[row.phase] ?? BOA_NAVY; const start = row.start; const end = row.end; const left = start ? Math.max(0,pct(start)) : 0; const right = end ? Math.min(100,pct(addDays(end,1))) : left; const milestone = row.milestone ? pct(row.milestone) : null; const dateStart = start ?? row.milestone; const dateEnd = end ?? row.milestone ?? start; return <div key={`${chantier.id}:${row.key}`} className="flex border-b border-slate-100" style={{ height: ROW_H }}><div className={`sticky left-0 z-20 flex w-[460px] shrink-0 items-center border-r px-3 text-[11px] ${row.kind === 'phase' ? 'bg-slate-50 font-bold' : 'bg-white'}`} style={{ paddingLeft: 12 + row.depth*16, color: row.kind === 'phase' ? phaseColor : undefined }}><span className="mr-2 text-slate-300">{row.depth ? '└' : '●'}</span><span className="min-w-0 flex-1 truncate" title={row.label}>{row.label}</span>{dateStart && dateEnd && <span className="ml-2 flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums text-slate-500" title="Date de début → date de fin"><span>{format(dateStart,'dd/MM/yy')}</span><span className="text-[#00BDBB]">→</span><span>{format(dateEnd,'dd/MM/yy')}</span></span>}<span className="ml-2 shrink-0 text-[9px] uppercase text-slate-400">{row.kind === 'jalon' ? 'J' : row.kind === 'workstream' ? 'WS' : row.kind === 'activite' ? 'Act' : ''}</span></div><div className="relative" style={{ width: timelineWidth }}>{tickDates.map((date) => <span key={date.toISOString()} className="absolute inset-y-0 border-l border-slate-100" style={{ left:`${pct(date)}%` }} />)}{start && end && <span className="absolute top-1/2 -translate-y-1/2 rounded shadow-sm" style={{ left:`${left}%`, width:`${Math.max(.35,right-left)}%`, height: row.kind === 'phase' ? 18 : row.kind === 'workstream' ? 14 : row.kind === 'jalon' ? 11 : 8, backgroundColor: row.kind === 'phase' ? phaseColor : row.kind === 'workstream' ? BOA_NAVY : row.kind === 'jalon' ? (STATUT_JALON_COLORS[row.statut ?? ''] ?? '#64748b') : BOA_TEAL, opacity: row.kind === 'phase' ? .3 : .9 }} />}{milestone != null && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-white shadow" style={{ left:`${milestone}%`, backgroundColor: STATUT_JALON_COLORS[row.statut ?? ''] ?? '#64748b' }} />}{todayPct != null && <span className="absolute inset-y-0 z-10 w-px bg-rose-500/70" style={{ left:`${todayPct}%` }} />}</div></div>; })}
            </section>;
          })}
        </div>
      </div>
    </div>
  );
}
