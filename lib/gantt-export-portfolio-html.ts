/**
 * Export HTML figé multi-chantiers (Gantt Portefeuille).
 * Capture de la vue affichée : filtres, niveaux, échelle, barres clipées, sticky.
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
  isValid,
  getISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { PHASE_COLORS, STATUT_JALON_COLORS } from "@/lib/jalon-labels";

const BOA_NAVY = "#0A3C74";
const BOA_TEAL = "#00BDBB";

export type PortfolioExportRow = {
  key: string;
  kind: "phase" | "jalon" | "workstream" | "activite";
  label: string;
  depth: number;
  phase: string;
  start: Date | string | null;
  end: Date | string | null;
  milestone?: Date | string | null;
  statut?: string;
};

export type PortfolioExportChantierBlock = {
  code: string;
  nom: string;
  domaine?: string;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
  collapsed?: boolean;
  rows: PortfolioExportRow[];
};

export type PortfolioGanttExportOptions = {
  scale: "week" | "month" | "quarter";
  rangeStart: Date | string;
  rangeEnd: Date | string;
  filterDu?: string;
  filterAu?: string;
  intersectOnly?: boolean;
  showJalons?: boolean;
  showWorkstreams?: boolean;
  showActivites?: boolean;
  blocks: PortfolioExportChantierBlock[];
};

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

function eachQuarter(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let d = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
  while (d <= end) {
    out.push(d);
    d = addMonths(d, 3);
  }
  return out;
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { downloadTextFile };

function normalizeScale(
  value: unknown
): "week" | "month" | "quarter" {
  if (value === "week" || value === "month" || value === "quarter") return value;
  // Alias éventuels (UI FR / anciennes valeurs)
  if (value === "semaine" || value === "Semaine") return "week";
  if (value === "mois" || value === "Mois") return "month";
  if (value === "trimestre" || value === "Trimestre") return "quarter";
  return "month";
}

export function buildPortfolioGanttStandaloneHtml(
  options: PortfolioGanttExportOptions
): string {
  const scale = normalizeScale(options.scale);
  let rangeStart =
    parseDate(options.rangeStart) ?? startOfDay(new Date());
  let rangeEnd = parseDate(options.rangeEnd) ?? addDays(rangeStart, 90);
  if (rangeStart > rangeEnd) {
    const tmp = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = tmp;
  }
  const totalDays = Math.max(
    1,
    differenceInCalendarDays(rangeEnd, rangeStart)
  );
  const dayPct = (d: Date) =>
    (differenceInCalendarDays(d, rangeStart) / totalDays) * 100;

  // Génération des graduations strictement selon l'échelle de la vue
  let tickDates: Date[];
  if (scale === "week") {
    tickDates = eachWeekOfInterval(
      { start: rangeStart, end: rangeEnd },
      { weekStartsOn: 1 }
    );
  } else if (scale === "month") {
    tickDates = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
  } else {
    tickDates = eachQuarter(rangeStart, rangeEnd);
  }

  const slotMin = scale === "week" ? 52 : scale === "month" ? 76 : 96;
  const timelineMinW = Math.max(720, tickDates.length * slotMin);
  const labelW = 360;
  const now = startOfDay(new Date());
  const todayPct =
    now >= rangeStart && now <= rangeEnd ? dayPct(now) : null;

  const ticks = tickDates.map((d, i) => {
    let primary: string;
    let secondary: string;
    if (scale === "week") {
      primary = format(d, "dd/MM", { locale: fr });
      secondary = `S${getISOWeek(d)}`;
    } else if (scale === "month") {
      const m = format(d, "MMM", { locale: fr });
      primary = m.charAt(0).toUpperCase() + m.slice(1);
      secondary = format(d, "yyyy");
    } else {
      primary = `T${Math.floor(d.getMonth() / 3) + 1}`;
      secondary = String(d.getFullYear());
    }
    const left = dayPct(d);
    const nextLeft =
      i + 1 < tickDates.length ? dayPct(tickDates[i + 1]) : 100;
    return {
      left,
      width: Math.max(0.5, nextLeft - left),
      primary,
      secondary,
    };
  });

  const periodLabel =
    options.filterDu || options.filterAu
      ? `${options.filterDu ? fmt(parseDate(options.filterDu)) : "…"} → ${
          options.filterAu ? fmt(parseDate(options.filterAu)) : "…"
        }${
          options.intersectOnly
            ? " · planifiés sur la période"
            : " · fenêtre timeline"
        }`
      : "Période complète du portefeuille";

  const scaleLabel =
    scale === "week" ? "Semaine" : scale === "month" ? "Mois" : "Trimestre";

  const levels = [
    options.showJalons !== false ? "Jalons" : null,
    options.showWorkstreams !== false ? "Workstreams" : null,
    options.showActivites ? "Activités" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const tickHtml = ticks
    .map(
      (t) =>
        `<div class="tick" style="left:${t.left.toFixed(3)}%;width:${t.width.toFixed(3)}%">
          <span class="t-pri">${esc(t.primary)}</span>
          <span class="t-sec">${esc(t.secondary)}</span>
        </div>`
    )
    .join("");

  function barStyle(
    start: Date | null,
    end: Date | null,
    kind: PortfolioExportRow["kind"],
    phase: string,
    statut?: string
  ): { left: number; width: number; bg: string; h: number; opacity: string } | null {
    if (!start || !end) return null;
    const l = Math.max(0, Math.min(100, dayPct(start)));
    const r = Math.max(0, Math.min(100, dayPct(addDays(end, 1))));
    if (r <= l) return null;
    const phaseColor = PHASE_COLORS[phase] ?? BOA_NAVY;
    const statutColor = (statut && STATUT_JALON_COLORS[statut]) || "#64748b";
    const bg =
      kind === "phase"
        ? phaseColor
        : kind === "workstream"
          ? BOA_NAVY
          : kind === "jalon"
            ? statutColor
            : BOA_TEAL;
    const h =
      kind === "phase" ? 18 : kind === "workstream" ? 14 : kind === "jalon" ? 12 : 8;
    const opacity =
      kind === "phase" ? "0.35" : kind === "activite" ? "0.9" : "0.95";
    return { left: l, width: Math.max(0.4, r - l), bg, h, opacity };
  }

  let totalRows = 0;
  const blocksHtml = options.blocks
    .map((block) => {
      const rows = block.collapsed ? [] : block.rows;
      totalRows += rows.length;
      const chStart = parseDate(block.date_debut);
      const chEnd = parseDate(block.date_fin);
      const chL = chStart != null ? Math.max(0, Math.min(100, dayPct(chStart))) : null;
      const chR = chEnd != null ? Math.max(0, Math.min(100, dayPct(chEnd))) : null;
      const chBand =
        chL != null && chR != null && chR > chL
          ? `<div class="ch-band" style="left:${chL.toFixed(3)}%;width:${(chR - chL).toFixed(3)}%"></div>`
          : "";

      const headerRow = `<div class="ch-head">
  <div class="lab ch-lab">
    <span class="code">${esc(block.code)}</span>
    <span class="ch-nom" title="${esc(block.nom)}">${esc(block.nom)}</span>
    <span class="muted">${block.collapsed ? "replié" : `${rows.length} lignes`}</span>
  </div>
  <div class="tl">${chBand}${
    todayPct != null
      ? `<div class="today-line" style="left:${todayPct.toFixed(3)}%"></div>`
      : ""
  }</div>
</div>`;

      const rowsHtml = rows
        .map((row) => {
          const start = parseDate(row.start);
          const end = parseDate(row.end);
          const milestone = parseDate(row.milestone ?? null);
          const phaseColor = PHASE_COLORS[row.phase] ?? BOA_NAVY;
          const statutColor =
            (row.statut && STATUT_JALON_COLORS[row.statut]) || "#64748b";
          const bar = barStyle(start, end, row.kind, row.phase, row.statut);
          const pad = 12 + row.depth * 14;
          const dateStart = start ?? milestone;
          const dateEnd = end ?? milestone ?? start;
          const datesHtml =
            dateStart || dateEnd
              ? `<span class="dates" title="Date de début → date de fin">${
                  dateStart ? esc(fmt(dateStart, "dd/MM/yy")) : "—"
                }<span class="dates-arrow">→</span>${
                  dateEnd ? esc(fmt(dateEnd, "dd/MM/yy")) : "—"
                }</span>`
              : "";
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
          let barHtml = "";
          if (bar) {
            barHtml = `<div class="bar" title="${esc(
              `${row.label} · ${fmt(start)} → ${fmt(end)}`
            )}" style="left:${bar.left.toFixed(3)}%;width:${bar.width.toFixed(
              3
            )}%;height:${bar.h}px;background:${bar.bg};opacity:${bar.opacity}"></div>`;
          }
          let msHtml = "";
          if (milestone) {
            const ml = Math.max(0, Math.min(100, dayPct(milestone)));
            msHtml = `<div class="ms" title="${esc(
              `${row.label} · ${fmt(milestone)} · ${row.statut ?? ""}`
            )}" style="left:${ml.toFixed(3)}%;background:${statutColor}"></div>`;
          }
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
  <div class="tl">${barHtml}${msHtml}${todayLine}</div>
</div>`;
        })
        .join("\n");

      return `<section class="block">${headerRow}${rowsHtml}</section>`;
    })
    .join("\n");

  const exportedAt = format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr });
  const nChantiers = options.blocks.length;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GANTT Portefeuille — TransfoHub</title>
<style>
  :root {
    --navy: ${BOA_NAVY};
    --teal: ${BOA_TEAL};
    --label-w: ${labelW}px;
    --row-h: 34px;
    --border: #e2e8f0;
    --muted: #64748b;
    --bg: #f1f5f9;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: var(--bg); color: #0f172a; line-height: 1.4;
  }
  .wrap { max-width: 1600px; margin: 0 auto; padding: 16px; }
  header.hero {
    background: #fff; border: 1px solid var(--border); border-radius: 12px;
    padding: 16px 20px; margin-bottom: 12px;
  }
  .brand {
    font-size: 11px; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: var(--teal); margin: 0 0 4px;
  }
  h1 { margin: 0; font-size: 1.25rem; color: var(--navy); }
  .sub { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .meta {
    display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px;
    font-size: 12px; color: var(--muted);
  }
  .meta strong { color: var(--navy); }
  .card {
    background: #fff; border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden; display: flex; flex-direction: column;
  }
  .scroll {
    overflow: auto;
    max-height: min(78vh, 820px);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  .gantt { min-width: calc(var(--label-w) + ${timelineMinW}px); }
  .head {
    display: flex; border-bottom: 1px solid var(--border);
    background: #f8fafc;
    position: sticky; top: 0; z-index: 10;
    box-shadow: 0 1px 0 rgba(226,232,240,.95);
  }
  .lab-h {
    width: var(--label-w); min-width: var(--label-w); flex-shrink: 0;
    height: 48px; display: flex; align-items: flex-end; padding: 0 12px 8px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .04em; color: var(--muted);
    border-right: 1px solid var(--border); background: #f8fafc;
    position: sticky; left: 0; top: 0; z-index: 12;
    box-shadow: 2px 0 0 rgba(226,232,240,.95);
  }
  .tl-h {
    position: relative; flex: 1; height: 48px; min-width: ${timelineMinW}px;
    background: #f8fafc;
  }
  .tick {
    position: absolute; top: 0; height: 100%;
    border-left: 1px solid #e2e8f0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; overflow: hidden; padding: 0 1px;
  }
  .t-pri {
    font-size: ${scale === "week" ? "9px" : "11px"}; font-weight: 700;
    color: #334155; line-height: 1.1; white-space: nowrap;
    letter-spacing: ${scale === "week" ? "-0.02em" : "normal"};
  }
  .t-sec {
    font-size: ${scale === "week" ? "8px" : "10px"};
    font-weight: ${scale === "week" ? "600" : "500"};
    color: #94a3b8; line-height: 1.1; white-space: nowrap;
  }
  .today-head {
    position: absolute; top: 2px; transform: translateX(-50%);
    color: #e11d48; font-size: 10px; font-weight: 700; z-index: 2;
  }
  .ch-head {
    display: flex; min-height: 48px;
    border-bottom: 1px solid rgba(10,60,116,.15);
    background: rgba(10,60,116,.045);
  }
  .ch-lab {
    background: #f4f7fb !important;
    font-weight: 600;
  }
  .code {
    flex-shrink: 0; background: var(--navy); color: #fff;
    font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  }
  .ch-nom {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 12px; color: var(--navy);
  }
  .muted { flex-shrink: 0; font-size: 10px; color: var(--muted); }
  .row { display: flex; min-height: var(--row-h); border-bottom: 1px solid #f1f5f9; }
  .lab {
    width: var(--label-w); min-width: var(--label-w); flex-shrink: 0;
    display: flex; align-items: center; gap: 6px;
    padding: 4px 8px; font-size: 11px;
    border-right: 1px solid var(--border);
    position: sticky; left: 0; z-index: 4;
    background: #fff;
    box-shadow: 2px 0 0 rgba(226,232,240,.95);
  }
  .row[data-kind="phase"] .lab { background: #f8fafc; }
  .lab-text {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dates {
    display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
    margin-left: auto; padding: 2px 6px; border-radius: 6px;
    background: #f1f5f9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9px; font-weight: 600; font-variant-numeric: tabular-nums;
    color: #64748b; white-space: nowrap;
  }
  .dates-arrow { color: var(--teal); font-weight: 700; }
  .tag {
    flex-shrink: 0; font-size: 9px; text-transform: uppercase; color: #94a3b8;
  }
  .dot {
    width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0;
  }
  .tl {
    position: relative; flex: 1; min-height: var(--row-h);
    min-width: ${timelineMinW}px;
  }
  .ch-band {
    position: absolute; top: 4px; bottom: 4px;
    border: 1px dashed rgba(56,189,248,.45);
    background: rgba(240,249,255,.65);
    border-radius: 4px; pointer-events: none;
  }
  .bar {
    position: absolute; top: 50%; transform: translateY(-50%);
    border-radius: 6px; box-shadow: 0 1px 2px rgba(15,23,42,.12);
  }
  .ms {
    position: absolute; top: 50%;
    width: 12px; height: 12px;
    transform: translate(-50%, -50%) rotate(45deg);
    border: 2px solid #fff; border-radius: 2px;
    box-shadow: 0 1px 2px rgba(15,23,42,.2); z-index: 1;
  }
  .today-line {
    position: absolute; top: 0; bottom: 0; width: 1px;
    background: rgba(225,29,72,.75); z-index: 2; pointer-events: none;
  }
  .legend {
    display: flex; flex-wrap: wrap; gap: 12px 18px;
    padding: 10px 14px; border-top: 1px solid var(--border);
    background: #f8fafc; font-size: 11px; color: var(--muted);
  }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .lg-ms {
    width: 10px; height: 10px; background: #3b82f6;
    transform: rotate(45deg); border-radius: 1px;
  }
  .lg-ws { width: 18px; height: 10px; background: var(--navy); border-radius: 3px; }
  .lg-act { width: 18px; height: 8px; background: var(--teal); border-radius: 3px; }
  .lg-j { width: 18px; height: 10px; background: #22c55e; border-radius: 3px; }
  .lg-today { width: 0; height: 12px; border-left: 2px solid #e11d48; }
  footer.note {
    margin-top: 12px; font-size: 11px; color: var(--muted); text-align: center;
  }
  @media print {
    body { background: #fff; }
    .wrap { max-width: none; padding: 0; }
    .scroll { overflow: visible; max-height: none; }
    .head, .lab-h, .lab { position: static; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="brand">Bank of Africa · TransfoHub</p>
      <h1>Gantt portefeuille — vue figée</h1>
      <p class="sub">Capture de la vue affichée (chantiers sélectionnés, filtres, niveaux, échelle)</p>
      <div class="meta">
        <span><strong>${nChantiers}</strong> chantier(s)</span>
        <span><strong>${totalRows}</strong> ligne(s)</span>
        <span>Échelle : <strong data-export-scale="${esc(scale)}">${scaleLabel}</strong></span>
        <span>Niveaux : <strong>${esc(levels || "—")}</strong></span>
        <span>Période : <strong>${esc(periodLabel)}</strong></span>
        <span>Export : <strong>${esc(exportedAt)}</strong></span>
      </div>
    </header>

    <div class="card">
      <div class="scroll">
        <div class="gantt" data-scale="${esc(scale)}">
          <div class="head">
            <div class="lab-h">Portefeuille / structure</div>
            <div class="tl-h">
              ${tickHtml}
              ${
                todayPct != null
                  ? `<div class="today-head" style="left:${todayPct.toFixed(3)}%">Auj.</div>`
                  : ""
              }
            </div>
          </div>
          ${
            blocksHtml ||
            `<div class="row"><div class="lab" style="padding:12px">Aucun élément à afficher.</div></div>`
          }
        </div>
      </div>
      <div class="legend">
        <span><i class="lg-j"></i> Jalon (barre)</span>
        <span><i class="lg-ms"></i> Jalon (date cible)</span>
        <span><i class="lg-ws"></i> Workstream</span>
        <span><i class="lg-act"></i> Activité</span>
        <span><i class="lg-today"></i> Aujourd'hui</span>
      </div>
    </div>
    <footer class="note">
      Document autonome généré depuis TransfoHub — lisible hors ligne.
    </footer>
  </div>
</body>
</html>`;
}
