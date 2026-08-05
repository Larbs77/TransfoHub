/**
 * Single-file responsive HTML export of a chantier Gantt (comité / offline).
 * No external deps — open the .html in any browser.
 */

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
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  PHASES,
  PHASE_COLORS,
  STATUT_JALON_COLORS,
} from "@/lib/jalon-labels";

export type HtmlGanttActivite = {
  id: string;
  nom: string;
  ordre: number;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
  statut: string;
};

export type HtmlGanttWorkstream = {
  id: string;
  nom: string;
  ordre: number;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
  statut: string;
  activites: HtmlGanttActivite[];
};

export type HtmlGanttJalon = {
  id: string;
  phase: string;
  nom: string;
  ordre: number;
  date_debut?: Date | string | null;
  date_cible: Date | string;
  date_reelle?: Date | string | null;
  statut: string;
  workstreams?: HtmlGanttWorkstream[];
};

export type HtmlGanttChantier = {
  code: string;
  nom: string;
  /** Domaine métier (libellé stocké en base) */
  domaine?: string | null;
  date_debut: Date | string;
  date_fin: Date | string;
  jalons: HtmlGanttJalon[];
};

/** Row snapshot from the live Gantt view (WYSIWYG static export). */
export type HtmlGanttVisibleRow = {
  key: string;
  kind: "phase" | "jalon" | "workstream" | "activite";
  label: string;
  depth: number;
  phase?: string;
  statut?: string;
  start: Date | string | null;
  end: Date | string | null;
  milestone?: Date | string | null;
};

export type HtmlGanttExportOptions = {
  scale?: "week" | "month" | "quarter";
  showJalons?: boolean;
  showWorkstreams?: boolean;
  showActivites?: boolean;
  /** YYYY-MM-DD optional range filter */
  filterDu?: string;
  filterAu?: string;
  /**
   * all = toutes les lignes, fenêtre timeline éventuellement filtrée
   * intersect = uniquement les lignes qui intersectent la période Du/Au
   * (aligné sur le filtre « Planifiés sur la période » de l’UI)
   */
  periodContentMode?: "all" | "intersect";
  /**
   * Lignes déjà filtrées / repliées comme à l’écran.
   * Si fourni, l’export HTML figé reprend exactement cette vue (WYSIWYG).
   */
  visibleRows?: HtmlGanttVisibleRow[];
};

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



const BOA_NAVY = "#0A3C74";
const BOA_TEAL = "#00BDBB";

function parseDate(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isValid(d) ? startOfDay(d) : null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(d: Date | null, pattern = "dd/MM/yyyy"): string {
  if (!d) return "—";
  return format(d, pattern, { locale: fr });
}

type Row = {
  id: string;
  kind: "phase" | "jalon" | "workstream" | "activite";
  label: string;
  depth: number;
  phase?: string;
  statut?: string;
  start: Date | null;
  end: Date | null;
  milestone: Date | null;
  parentId?: string;
};

function buildRows(
  jalons: HtmlGanttJalon[],
  opts: {
    showJalons: boolean;
    showWorkstreams: boolean;
    showActivites: boolean;
  }
): Row[] {
  const out: Row[] = [];
  for (const phase of PHASES) {
    const phaseJalons = jalons
      .filter((j) => j.phase === phase)
      .sort((a, b) => a.ordre - b.ordre);
    if (!phaseJalons.length) continue;
    const phaseId = `phase-${phase}`;
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
      id: phaseId,
      kind: "phase",
      label: phase,
      depth: 0,
      phase,
      start: phaseDates.length ? minDate(phaseDates) : null,
      end: phaseDates.length ? maxDate(phaseDates) : null,
      milestone: null,
    });
    for (const j of phaseJalons) {
      const jalonId = `jalon-${j.id}`;
      if (opts.showJalons) {
        out.push({
          id: jalonId,
          kind: "jalon",
          label: j.nom,
          depth: 1,
          phase,
          statut: j.statut,
          start: parseDate(j.date_debut) ?? parseDate(j.date_cible),
          end: parseDate(j.date_cible),
          milestone: parseDate(j.date_cible),
          parentId: phaseId,
        });
      }
      const streams = [...(j.workstreams ?? [])].sort(
        (a, b) => a.ordre - b.ordre
      );
      for (const ws of streams) {
        const wsId = `ws-${ws.id}`;
        if (opts.showWorkstreams) {
          out.push({
            id: wsId,
            kind: "workstream",
            label: ws.nom,
            depth: opts.showJalons ? 2 : 1,
            phase,
            statut: ws.statut,
            start: parseDate(ws.date_debut),
            end: parseDate(ws.date_fin) ?? parseDate(ws.date_debut),
            milestone: null,
            parentId: opts.showJalons ? jalonId : phaseId,
          });
        }
        if (opts.showActivites) {
          for (const act of [...(ws.activites ?? [])].sort(
            (a, b) => a.ordre - b.ordre
          )) {
            out.push({
              id: `act-${act.id}`,
              kind: "activite",
              label: act.nom,
              depth:
                (opts.showJalons ? 2 : 1) + (opts.showWorkstreams ? 1 : 0),
              phase,
              statut: act.statut,
              start: parseDate(act.date_debut),
              end: parseDate(act.date_fin) ?? parseDate(act.date_debut),
              milestone: null,
              parentId: opts.showWorkstreams ? wsId : opts.showJalons ? jalonId : phaseId,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Filtre les lignes comme l’UI : garde une ligne si elle intersecte [Du, Au],
 * ou si c’est un parent dont un descendant visible intersecte la période.
 */
function filterRowsByPeriodIntersect(
  rows: Row[],
  filterDu?: string,
  filterAu?: string
): Row[] {
  if (!filterDu && !filterAu) return rows;
  const filterStart =
    parseDate(filterDu || null) ?? new Date(-8640000000000000);
  const filterEnd =
    parseDate(filterAu || null) ?? new Date(8640000000000000);
  const intersects = (row: Row) => {
    const start = row.start ?? row.milestone;
    const end = row.end ?? row.milestone ?? start;
    return !!start && !!end && start <= filterEnd && end >= filterStart;
  };
  return rows.filter((row, index) => {
    if (intersects(row)) return true;
    // Parent (phase / jalon / ws) : garder si un descendant intersecte
    if (row.kind === "activite") return false;
    for (let cursor = index + 1; cursor < rows.length; cursor += 1) {
      const descendant = rows[cursor];
      if (descendant.depth <= row.depth) break;
      if (intersects(descendant)) return true;
    }
    return false;
  });
}

function rowsFromVisible(
  visible: HtmlGanttVisibleRow[]
): Row[] {
  return visible.map((r) => ({
    id: r.key,
    kind: r.kind,
    label: r.label,
    depth: r.depth,
    phase: r.phase,
    statut: r.statut,
    start: parseDate(r.start),
    end: parseDate(r.end),
    milestone: parseDate(r.milestone ?? null),
  }));
}

function computeRange(
  chantier: HtmlGanttChantier,
  scale: "week" | "month" | "quarter",
  filterDu?: string,
  filterAu?: string
): { start: Date; end: Date } {
  const dates: Date[] = [];
  const d0 = parseDate(chantier.date_debut);
  const d1 = parseDate(chantier.date_fin);
  if (d0) dates.push(d0);
  if (d1) dates.push(d1);
  for (const j of chantier.jalons) {
    const c = parseDate(j.date_cible);
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
    if (differenceInCalendarDays(end, start) < 1) end = addDays(start, 1);
    return { start, end };
  }

  if (!dates.length) {
    const today = startOfDay(new Date());
    return { start: addDays(today, -30), end: addDays(today, 90) };
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
    const q0 = Math.floor(start.getMonth() / 3) * 3;
    start = new Date(start.getFullYear(), q0 - 3, 1);
    const q1 = Math.floor(end.getMonth() / 3) * 3;
    end = endOfMonth(new Date(end.getFullYear(), q1 + 5, 1));
  }
  if (differenceInCalendarDays(end, start) < 14) end = addDays(start, 30);
  return { start, end };
}

/** Build a standalone responsive HTML document (UTF-8). */
export function buildGanttStandaloneHtml(
  chantier: HtmlGanttChantier,
  options: HtmlGanttExportOptions = {}
): string {
  const opts = {
    scale: options.scale ?? ("week" as const),
    showJalons: options.showJalons ?? true,
    showWorkstreams: options.showWorkstreams ?? true,
    showActivites: options.showActivites ?? true,
    filterDu: options.filterDu,
    filterAu: options.filterAu,
    periodContentMode: options.periodContentMode ?? "all",
  };

  // WYSIWYG : lignes de la vue courante (filtres, niveaux, repli)
  let rows: Row[] =
    options.visibleRows && options.visibleRows.length > 0
      ? rowsFromVisible(options.visibleRows)
      : buildRows(chantier.jalons, opts);

  // Fallback sans visibleRows : appliquer le filtre « planifiés sur la période »
  if (
    !options.visibleRows?.length &&
    opts.periodContentMode === "intersect" &&
    (opts.filterDu || opts.filterAu)
  ) {
    rows = filterRowsByPeriodIntersect(rows, opts.filterDu, opts.filterAu);
  }

  const range = computeRange(
    chantier,
    opts.scale,
    opts.filterDu,
    opts.filterAu
  );
  const totalDays = Math.max(
    differenceInCalendarDays(range.end, range.start),
    1
  );
  const now = startOfDay(new Date());
  const dayPct = (d: Date) =>
    (differenceInCalendarDays(d, range.start) / totalDays) * 100;

  type Tick = {
    left: number;
    width: number;
    primary: string;
    secondary: string;
  };
  let dates: Date[] = [];
  if (opts.scale === "week") {
    dates = eachWeekOfInterval(
      { start: range.start, end: range.end },
      { weekStartsOn: 1 }
    );
  } else if (opts.scale === "month") {
    dates = eachMonthOfInterval({ start: range.start, end: range.end });
  } else {
    dates = eachQuarterOfInterval(range.start, range.end);
  }
  const rawTicks = dates.map((d) => {
    let primary: string;
    let secondary: string;
    if (opts.scale === "week") {
      // Haut : lundi de la semaine · Bas : n° de semaine (petit)
      primary = format(d, "dd/MM", { locale: fr });
      secondary = `S${getISOWeek(d)}`;
    } else if (opts.scale === "month") {
      const m = format(d, "MMM", { locale: fr });
      primary = m.charAt(0).toUpperCase() + m.slice(1);
      secondary = format(d, "yyyy");
    } else {
      primary = `T${Math.floor(d.getMonth() / 3) + 1}`;
      secondary = String(d.getFullYear());
    }
    return { left: dayPct(d), primary, secondary };
  });
  const ticks: Tick[] = rawTicks.map((t, i) => ({
    ...t,
    width: Math.max(0.5, (rawTicks[i + 1]?.left ?? 100) - t.left),
  }));
  const slotMin =
    opts.scale === "week" ? 52 : opts.scale === "month" ? 76 : 96;
  const timelineMinW = Math.max(640, ticks.length * slotMin);

  const chantierStart = parseDate(chantier.date_debut);
  const chantierEnd = parseDate(chantier.date_fin);
  const chLeftRaw =
    chantierStart != null ? dayPct(chantierStart) : null;
  const chRightRaw = chantierEnd != null ? dayPct(chantierEnd) : null;
  const chLeft =
    chLeftRaw != null ? Math.max(0, Math.min(100, chLeftRaw)) : null;
  const chRight =
    chRightRaw != null ? Math.max(0, Math.min(100, chRightRaw)) : null;
  const chWidth =
    chLeft != null && chRight != null && chRight > chLeft
      ? Math.max(1, chRight - chLeft)
      : null;
  const todayPct =
    now >= range.start && now <= range.end ? dayPct(now) : null;

  const scaleLabel =
    opts.scale === "week"
      ? "Semaine"
      : opts.scale === "month"
        ? "Mois"
        : "Trimestre";

  // Compteurs sur la vue exportée (pas le planning complet)
  const totalJalonsShown = rows.filter((r) => r.kind === "jalon").length;
  const totalWsShown = rows.filter((r) => r.kind === "workstream").length;
  const totalActShown = rows.filter((r) => r.kind === "activite").length;
  const periodLabel =
    opts.filterDu || opts.filterAu
      ? `${opts.filterDu ? fmt(parseDate(opts.filterDu)) : "…"} → ${
          opts.filterAu ? fmt(parseDate(opts.filterAu)) : "…"
        }${
          opts.periodContentMode === "intersect"
            ? " · planifiés sur la période"
            : " · fenêtre timeline"
        }`
      : "Période complète du planning";

  const tickHtml = ticks
    .map(
      (t) =>
        `<div class="tick" style="left:${t.left.toFixed(3)}%;width:${t.width.toFixed(3)}%">
          <span class="t-pri">${esc(t.primary)}</span>
          <span class="t-sec">${esc(t.secondary)}</span>
        </div>`
    )
    .join("");

  const rowsHtml = rows
    .map((row) => {
      const phaseColor =
        (row.phase && PHASE_COLORS[row.phase]) || BOA_NAVY;
      const statutColor =
        (row.statut && STATUT_JALON_COLORS[row.statut]) || "#94a3b8";
      const pad = 8 + row.depth * 14;

      let barHtml = "";
      if (row.start && row.end) {
        // Clipper à la fenêtre : left/right bornés puis width = right - left
        // (jalons inclus — même rendu que l’écran app)
        const l = Math.max(0, Math.min(100, dayPct(row.start)));
        const r = Math.max(0, Math.min(100, dayPct(addDays(row.end, 1))));
        if (r > l) {
          const w = Math.max(0.4, r - l);
          const h =
            row.kind === "phase"
              ? 18
              : row.kind === "workstream"
                ? 16
                : row.kind === "jalon"
                  ? 12
                  : 10;
          const bg =
            row.kind === "phase"
              ? phaseColor
              : row.kind === "workstream"
                ? BOA_NAVY
                : row.kind === "jalon"
                  ? statutColor
                  : BOA_TEAL;
          const opacity =
            row.kind === "phase" ? "0.35" : row.kind === "activite" ? "0.9" : "0.95";
          const title = `${row.label} · ${fmt(row.start)} → ${fmt(row.end)}`;
          barHtml = `<div class="bar" title="${esc(title)}" style="left:${l.toFixed(3)}%;width:${w.toFixed(3)}%;height:${h}px;background:${bg};opacity:${opacity}"></div>`;
        }
      }
      let msHtml = "";
      if (row.milestone) {
        const l = Math.max(0, Math.min(100, dayPct(row.milestone)));
        msHtml = `<div class="ms" title="${esc(row.label)} · ${fmt(row.milestone)} · ${esc(row.statut ?? "")}" style="left:${l.toFixed(3)}%;background:${statutColor}"></div>`;
      }

      const kindTag =
        row.kind === "phase"
          ? ""
          : row.kind === "jalon"
            ? "J"
            : row.kind === "workstream"
              ? "WS"
              : "Act";

      const labelStyle =
        row.kind === "phase"
          ? `font-weight:700;color:${phaseColor}`
          : row.kind === "jalon"
            ? "font-weight:600"
            : "";

      const rowBg =
        row.kind === "phase" ? "background:#f8fafc" : "background:#fff";

      const phaseDot =
        row.kind === "phase"
          ? `<span class="dot" style="background:${phaseColor}"></span>`
          : "";

      const dateStart = row.start ?? row.milestone;
      const dateEnd = row.end ?? row.milestone ?? row.start;
      const datesHtml =
        dateStart || dateEnd
          ? `<span class="dates" title="Date de début → date de fin">${
              dateStart ? esc(fmt(dateStart, "dd/MM/yy")) : "—"
            }<span class="dates-arrow">→</span>${
              dateEnd ? esc(fmt(dateEnd, "dd/MM/yy")) : "—"
            }</span>`
          : "";

      const chBand =
        chLeft != null && chWidth != null
          ? `<div class="ch-band" style="left:${chLeft.toFixed(3)}%;width:${chWidth.toFixed(3)}%"></div>`
          : "";

      const todayLine =
        todayPct != null
          ? `<div class="today-line" style="left:${todayPct.toFixed(3)}%"></div>`
          : "";

      return `<div class="row" data-kind="${row.kind}" style="${rowBg}">
  <div class="lab" style="padding-left:${pad}px">
    ${phaseDot}
    <span class="lab-text" style="${labelStyle}" title="${esc(row.label)}">${esc(row.label)}</span>
    ${datesHtml}
    ${kindTag ? `<span class="tag">${kindTag}</span>` : ""}
  </div>
  <div class="tl">
    ${chBand}
    ${barHtml}
    ${msHtml}
    ${todayLine}
  </div>
</div>`;
    })
    .join("\n");

  const exportedAt = format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GANTT · ${esc(chantier.code)} — ${esc(chantier.nom)}</title>
<style>
  :root {
    --navy: ${BOA_NAVY};
    --teal: ${BOA_TEAL};
    --label-w: min(48vw, 360px);
    --row-h: 36px;
    --border: #e2e8f0;
    --muted: #64748b;
    --bg: #f1f5f9;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--bg);
    color: #0f172a;
    line-height: 1.4;
  }
  .wrap {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px;
  }
  header.hero {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 12px;
    box-shadow: 0 1px 2px rgba(15,23,42,.04);
  }
  .brand {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--teal);
    margin: 0 0 4px;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.1rem, 2.5vw, 1.35rem);
    color: var(--navy);
  }
  .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .recap {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px 14px;
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #dbe4f0;
    background: linear-gradient(180deg, #f7fafc 0%, #f1f5f9 100%);
  }
  .recap-item {
    min-width: 0;
  }
  .recap-item .lbl {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .05em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 3px;
  }
  .recap-item .val {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--navy);
    word-break: break-word;
  }
  .recap-item .val.badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(10, 60, 116, .08);
    border: 1px solid rgba(10, 60, 116, .14);
    font-size: 12px;
  }
  .recap-item.wide {
    grid-column: 1 / -1;
  }
  @media (min-width: 721px) {
    .recap-item.wide {
      grid-column: span 2;
    }
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-top: 12px;
    font-size: 12px;
    color: var(--muted);
  }
  .meta strong { color: var(--navy); }
  .card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15,23,42,.04);
    display: flex;
    flex-direction: column;
  }
  /* Viewport unique : sticky en-tête (Y) + colonne Structure (X) */
  .scroll {
    overflow: auto;
    max-height: min(72vh, 760px);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  .gantt {
    min-width: calc(var(--label-w) + ${timelineMinW}px);
  }
  .head {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: #f8fafc;
    position: sticky;
    top: 0;
    z-index: 6;
    box-shadow: 0 1px 0 rgba(226, 232, 240, .95);
  }
  .lab-h {
    width: var(--label-w);
    min-width: var(--label-w);
    flex-shrink: 0;
    height: 48px;
    display: flex;
    align-items: flex-end;
    padding: 0 12px 8px;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .04em;
    border-right: 1px solid var(--border);
    background: #f8fafc;
    /* Coin : figé en X et Y */
    position: sticky;
    left: 0;
    top: 0;
    z-index: 8;
    box-shadow: 2px 0 0 rgba(226, 232, 240, .95);
  }
  .tl-h {
    position: relative;
    flex: 1;
    height: 48px;
    min-width: ${timelineMinW}px;
  }
  .tick {
    position: absolute;
    top: 0;
    height: 100%;
    border-left: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow: hidden;
    padding: 0 1px;
  }
  .t-pri {
    font-size: 11px;
    font-weight: 700;
    color: #334155;
    line-height: 1.1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
  }
  .t-sec {
    font-size: 10px;
    font-weight: 500;
    color: #94a3b8;
    line-height: 1.1;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
  }
  /* Échelle semaine : date lundi en haut, n° semaine petit en bas */
  .gantt[data-scale="week"] .t-pri {
    font-size: 9px;
    letter-spacing: -0.02em;
  }
  .gantt[data-scale="week"] .t-sec {
    font-size: 8px;
    font-weight: 600;
    opacity: 0.9;
  }
  .today-head {
    position: absolute;
    top: 2px;
    transform: translateX(-50%);
    color: #e11d48;
    font-size: 10px;
    font-weight: 700;
    z-index: 2;
  }
  .row {
    display: flex;
    min-height: var(--row-h);
    border-bottom: 1px solid #f1f5f9;
  }
  .lab {
    width: var(--label-w);
    min-width: var(--label-w);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 12px;
    border-right: 1px solid var(--border);
    position: sticky;
    left: 0;
    z-index: 4;
    background: #fff;
    box-shadow: 2px 0 0 rgba(226, 232, 240, .95);
  }
  .row[data-kind="phase"] .lab {
    background: #f8fafc;
  }
  .lab-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .dates {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
    margin-left: auto;
    padding: 2px 6px;
    border-radius: 6px;
    background: #f1f5f9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #64748b;
    white-space: nowrap;
  }
  .dates-arrow {
    color: var(--teal);
    font-weight: 700;
  }
  .tl {
    position: relative;
    flex: 1;
    min-height: var(--row-h);
    min-width: ${timelineMinW}px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .tag {
    font-size: 9px;
    color: #94a3b8;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .tl { min-height: var(--row-h); }
  .ch-band {
    position: absolute;
    top: 4px;
    bottom: 4px;
    border: 1px dashed rgba(56,189,248,.45);
    background: rgba(240,249,255,.65);
    border-radius: 4px;
    pointer-events: none;
  }
  .bar {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 6px;
    box-shadow: 0 1px 2px rgba(15,23,42,.12);
  }
  .ms {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    transform: translate(-50%, -50%) rotate(45deg);
    border: 2px solid #fff;
    border-radius: 2px;
    box-shadow: 0 1px 2px rgba(15,23,42,.2);
    z-index: 1;
  }
  .today-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(225,29,72,.75);
    z-index: 2;
    pointer-events: none;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 18px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    background: #f8fafc;
    font-size: 11px;
    color: var(--muted);
  }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .lg-ms {
    width: 10px; height: 10px;
    background: #3b82f6;
    transform: rotate(45deg);
    border-radius: 1px;
  }
  .lg-ws {
    width: 18px; height: 10px;
    background: var(--navy);
    border-radius: 3px;
  }
  .lg-act {
    width: 18px; height: 8px;
    background: var(--teal);
    border-radius: 3px;
  }
  .lg-today {
    width: 0; height: 12px;
    border-left: 2px solid #e11d48;
  }
  footer.note {
    margin-top: 12px;
    font-size: 11px;
    color: var(--muted);
    text-align: center;
  }
  @media (max-width: 720px) {
    :root { --label-w: 42vw; --row-h: 40px; }
    .wrap { padding: 10px; }
    .lab, .lab-h { font-size: 11px; }
    .gantt { min-width: 560px; }
    .recap { grid-template-columns: 1fr 1fr; }
  }
  @media print {
    body { background: #fff; }
    .wrap { max-width: none; padding: 0; }
    .card, .hero { box-shadow: none; }
    .scroll { overflow: visible; max-height: none; }
    .gantt { min-width: 0; }
    .head, .lab-h, .lab { position: static; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="brand">Bank of Africa · TransfoHub</p>
      <h1>Planning GANTT</h1>
      <p class="sub">Export figé — capture de la vue affichée (filtres / niveaux / période)</p>
      <div class="recap" aria-label="Récapitulatif chantier">
        <div class="recap-item">
          <span class="lbl">Code</span>
          <span class="val badge">${esc(chantier.code)}</span>
        </div>
        <div class="recap-item">
          <span class="lbl">Domaine</span>
          <span class="val">${esc(chantier.domaine?.trim() || "—")}</span>
        </div>
        <div class="recap-item wide">
          <span class="lbl">Nom</span>
          <span class="val">${esc(chantier.nom)}</span>
        </div>
        <div class="recap-item">
          <span class="lbl">Date de début</span>
          <span class="val">${fmt(chantierStart)}</span>
        </div>
        <div class="recap-item">
          <span class="lbl">Date de fin</span>
          <span class="val">${fmt(chantierEnd)}</span>
        </div>
        <div class="recap-item wide">
          <span class="lbl">Période exportée</span>
          <span class="val">${esc(periodLabel)}</span>
        </div>
      </div>
      <div class="meta">
        <span><strong>${totalJalonsShown}</strong> jalon(s) affiché(s)</span>
        <span><strong>${totalWsShown}</strong> workstream(s)</span>
        <span><strong>${totalActShown}</strong> activité(s)</span>
        <span>Échelle : <strong>${scaleLabel}</strong></span>
        <span>Export : <strong>${esc(exportedAt)}</strong></span>
      </div>
    </header>

    <div class="card">
      <div class="scroll">
        <div class="gantt" data-scale="${esc(opts.scale)}">
          <div class="head">
            <div class="lab-h">Structure</div>
            <div class="tl-h">
              ${tickHtml}
              ${
                todayPct != null
                  ? `<div class="today-head" style="left:${todayPct.toFixed(3)}%">Auj.</div>`
                  : ""
              }
            </div>
          </div>
          ${rowsHtml || `<div class="row"><div class="lab" style="padding:12px;width:100%">Aucun élément à afficher.</div></div>`}
        </div>
      </div>
      <div class="legend">
        <span><i class="lg-ms"></i> Jalon (date cible)</span>
        <span><i class="lg-ws"></i> Workstream</span>
        <span><i class="lg-act"></i> Activité</span>
        <span><i class="lg-today"></i> Aujourd'hui</span>
        <span>Zone pointillée = plage prévue du chantier</span>
      </div>
    </div>

    <footer class="note">
      Document autonome généré depuis TransfoHub — lisible hors ligne, adapté comité / projection.
      Aucune donnée n’est envoyée à un serveur lors de l’ouverture de ce fichier.
    </footer>
  </div>
</body>
</html>
`;
}

export function downloadTextFile(
  content: string,
  fileName: string,
  mime = "text/html;charset=utf-8"
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
