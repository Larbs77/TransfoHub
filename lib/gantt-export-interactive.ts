/**
 * Interactive standalone HTML export of a chantier Gantt.
 * Embeds full planning data + vanilla JS toolbar (scale, levels, period, collapse).
 * No external deps — open the .html in any browser, offline.
 */

import { format, isValid, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  PHASES,
  PHASE_COLORS,
  STATUT_JALON_COLORS,
} from "@/lib/jalon-labels";
import type {
  HtmlGanttChantier,
  HtmlGanttExportOptions,
  HtmlGanttJalon,
} from "@/lib/gantt-export-html";

const BOA_NAVY = "#0A3C74";
const BOA_TEAL = "#00BDBB";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseDate(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isValid(d) ? startOfDay(d) : null;
}

function toYmd(v: Date | string | null | undefined): string | null {
  const d = parseDate(v);
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

function fmtFr(v: Date | string | null | undefined): string {
  const d = parseDate(v);
  if (!d) return "—";
  return format(d, "dd/MM/yyyy", { locale: fr });
}

function serializeJalons(jalons: HtmlGanttJalon[]) {
  return jalons.map((j) => ({
    id: j.id,
    phase: j.phase,
    nom: j.nom,
    ordre: j.ordre,
    date_debut: toYmd(j.date_debut ?? null),
    date_cible: toYmd(j.date_cible),
    date_reelle: toYmd(j.date_reelle ?? null),
    statut: j.statut,
    workstreams: (j.workstreams ?? []).map((w) => ({
      id: w.id,
      nom: w.nom,
      ordre: w.ordre,
      date_debut: toYmd(w.date_debut),
      date_fin: toYmd(w.date_fin),
      statut: w.statut,
      activites: (w.activites ?? []).map((a) => ({
        id: a.id,
        nom: a.nom,
        ordre: a.ordre,
        date_debut: toYmd(a.date_debut),
        date_fin: toYmd(a.date_fin),
        statut: a.statut,
      })),
    })),
  }));
}

/** Safe JSON for embedding inside <script> (avoids </script> break-out). */
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Build a standalone interactive HTML document (UTF-8).
 * Initial toolbar state can mirror the in-app Gantt filters.
 */
export function buildGanttInteractiveHtml(
  chantier: HtmlGanttChantier,
  options: HtmlGanttExportOptions = {}
): string {
  // Interactif : planning complet par défaut (filtres vides) ;
  // l’utilisateur affine hors ligne. L’échelle / niveaux peuvent être pré-réglés.
  const initial = {
    scale: options.scale ?? ("week" as const),
    showJalons: options.showJalons ?? true,
    showWorkstreams: options.showWorkstreams ?? true,
    showActivites: options.showActivites ?? true,
    filterDu: "",
    filterAu: "",
    intersectOnly: false,
  };

  const payload = {
    code: chantier.code,
    nom: chantier.nom,
    domaine: chantier.domaine?.trim() || "",
    date_debut: toYmd(chantier.date_debut),
    date_fin: toYmd(chantier.date_fin),
    jalons: serializeJalons(chantier.jalons),
    phases: [...PHASES],
    phaseColors: PHASE_COLORS,
    statutColors: STATUT_JALON_COLORS,
    brand: { navy: BOA_NAVY, teal: BOA_TEAL },
    initial,
    exportedAt: format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr }),
  };

  const totalWs = chantier.jalons.reduce(
    (n, j) => n + (j.workstreams?.length ?? 0),
    0
  );
  const totalAct = chantier.jalons.reduce(
    (n, j) =>
      n +
      (j.workstreams?.reduce((m, w) => m + (w.activites?.length ?? 0), 0) ?? 0),
    0
  );

  const dataJson = embedJson(payload);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GANTT interactif · ${esc(chantier.code)} — ${esc(chantier.nom)}</title>
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
    margin: 0; padding: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--bg); color: #0f172a; line-height: 1.4;
  }
  .wrap { max-width: 1400px; margin: 0 auto; padding: 16px; }
  header.hero {
    background: #fff; border: 1px solid var(--border); border-radius: 12px;
    padding: 16px 20px; margin-bottom: 12px;
    box-shadow: 0 1px 2px rgba(15,23,42,.04);
  }
  .brand {
    font-size: 11px; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: var(--teal); margin: 0 0 4px;
  }
  h1 { margin: 0; font-size: clamp(1.1rem, 2.5vw, 1.35rem); color: var(--navy); }
  .sub { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
  .mode-pill {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 8px; padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600;
    background: rgba(0,189,187,.12); color: #0f766e;
    border: 1px solid rgba(0,189,187,.35);
  }
  .recap {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px 14px; margin-top: 14px; padding: 12px 14px; border-radius: 10px;
    border: 1px solid #dbe4f0;
    background: linear-gradient(180deg, #f7fafc 0%, #f1f5f9 100%);
  }
  .recap-item { min-width: 0; }
  .recap-item.wide { grid-column: 1 / -1; }
  @media (min-width: 721px) { .recap-item.wide { grid-column: span 2; } }
  .recap-item .lbl {
    display: block; font-size: 10px; font-weight: 700; letter-spacing: .05em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 3px;
  }
  .recap-item .val {
    display: block; font-size: 13px; font-weight: 600; color: var(--navy);
    word-break: break-word;
  }
  .recap-item .val.badge {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    background: rgba(10, 60, 116, .08); border: 1px solid rgba(10, 60, 116, .14);
    font-size: 12px;
  }
  .meta {
    display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px;
    font-size: 12px; color: var(--muted);
  }
  .meta strong { color: var(--navy); }

  .toolbar {
    background: #fff; border: 1px solid var(--border); border-radius: 12px;
    padding: 12px 14px; margin-bottom: 12px;
    box-shadow: 0 1px 2px rgba(15,23,42,.04);
    display: flex; flex-wrap: wrap; gap: 10px 12px; align-items: center;
  }
  .toolbar .group {
    display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px;
  }
  .toolbar .sep {
    width: 1px; height: 22px; background: var(--border); margin: 0 2px;
  }
  .seg {
    display: inline-flex; border: 1px solid var(--border); border-radius: 8px;
    padding: 2px; background: #f8fafc;
  }
  .seg button {
    border: 0; background: transparent; cursor: pointer;
    font: inherit; font-size: 12px; font-weight: 600;
    padding: 5px 10px; border-radius: 6px; color: var(--muted);
  }
  .seg button.active {
    background: var(--navy); color: #fff;
  }
  .seg button:disabled { opacity: .4; cursor: not-allowed; }
  label.chk {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; color: #334155; cursor: pointer; user-select: none;
  }
  label.chk input { accent-color: var(--navy); }
  .dates {
    display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px;
    font-size: 12px; color: var(--muted);
  }
  .dates input[type="date"] {
    font: inherit; font-size: 12px; padding: 4px 6px;
    border: 1px solid var(--border); border-radius: 6px; background: #fff;
    color: var(--navy);
  }
  .btn {
    border: 1px solid var(--border); background: #fff; color: var(--navy);
    font: inherit; font-size: 12px; font-weight: 600;
    padding: 6px 10px; border-radius: 8px; cursor: pointer;
  }
  .btn:hover { border-color: var(--teal); background: rgba(0,189,187,.08); }
  .btn.primary {
    background: var(--navy); color: #fff; border-color: var(--navy);
  }
  .btn.primary:hover { filter: brightness(1.05); }
  .status {
    font-size: 11px; color: var(--muted); margin-left: auto;
  }

  .card {
    background: #fff; border: 1px solid var(--border); border-radius: 12px;
    overflow: hidden; box-shadow: 0 1px 2px rgba(15,23,42,.04);
    display: flex; flex-direction: column;
  }
  /* Single scrollport: sticky header (Y) + sticky Structure column (X) */
  .scroll {
    overflow: auto;
    max-height: min(72vh, 760px);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  .gantt { min-width: calc(var(--label-w) + 640px); }
  .head {
    display: flex; border-bottom: 1px solid var(--border);
    background: #f8fafc;
    position: sticky;
    top: 0;
    z-index: 6;
    box-shadow: 0 1px 0 rgba(226, 232, 240, .95);
  }
  .lab-h {
    width: var(--label-w); min-width: var(--label-w); flex-shrink: 0;
    height: 48px; display: flex; align-items: flex-end; padding: 0 12px 8px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .04em; color: var(--muted);
    border-right: 1px solid var(--border);
    background: #f8fafc;
    /* Corner cell: stuck on both axes */
    position: sticky;
    left: 0;
    top: 0;
    z-index: 8;
    box-shadow: 2px 0 0 rgba(226, 232, 240, .95);
  }
  .tl-h {
    flex: 1; position: relative; height: 48px; min-width: 0;
    background: #f8fafc;
    z-index: 5;
  }
  .tick {
    position: absolute; top: 0; bottom: 0;
    border-left: 1px solid var(--border);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 0 1px; overflow: hidden; text-align: center;
  }
  .t-pri {
    font-size: 11px; font-weight: 700; color: var(--navy); line-height: 1.1;
    max-width: 100%; overflow: hidden; white-space: nowrap;
  }
  .t-sec {
    font-size: 10px; color: var(--muted); line-height: 1.1;
    max-width: 100%; overflow: hidden; white-space: nowrap;
  }
  .gantt[data-scale="week"] .t-pri {
    font-size: 9px; letter-spacing: -0.02em;
  }
  .gantt[data-scale="week"] .t-sec {
    font-size: 8px; font-weight: 600; opacity: 0.9;
  }
  .today-head {
    position: absolute; top: 4px; transform: translateX(-50%);
    font-size: 10px; font-weight: 700; color: #e11d48;
    background: #fff; padding: 0 3px; z-index: 3;
  }
  .row {
    display: flex; min-height: var(--row-h);
    border-bottom: 1px solid var(--border);
  }
  .row:last-child { border-bottom: 0; }
  .lab {
    width: var(--label-w); min-width: var(--label-w); flex-shrink: 0;
    display: flex; align-items: center; gap: 6px;
    padding: 4px 8px; border-right: 1px solid var(--border);
    font-size: 12px; overflow: hidden;
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
    flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .row-dates {
    display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
    margin-left: auto; padding: 2px 6px; border-radius: 6px;
    background: #f1f5f9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9px; font-weight: 600; font-variant-numeric: tabular-nums;
    color: #64748b; white-space: nowrap;
  }
  .row-dates-arrow { color: var(--teal); font-weight: 700; }
  .dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .tag {
    flex-shrink: 0; font-size: 9px; font-weight: 700;
    padding: 1px 5px; border-radius: 4px;
    background: #e2e8f0; color: #475569;
  }
  .collapse {
    flex-shrink: 0; width: 20px; height: 20px; border: 1px solid var(--border);
    border-radius: 4px; background: #fff; color: var(--navy);
    font-size: 12px; line-height: 1; cursor: pointer; padding: 0;
  }
  .collapse:hover { border-color: var(--teal); }
  .tl {
    flex: 1; position: relative; min-height: var(--row-h); min-width: 0;
  }
  .ch-band {
    position: absolute; top: 0; bottom: 0;
    background: repeating-linear-gradient(
      -45deg, transparent, transparent 4px, rgba(10,60,116,.04) 4px, rgba(10,60,116,.04) 8px
    );
    border-left: 1px dashed rgba(10,60,116,.25);
    border-right: 1px dashed rgba(10,60,116,.25);
    pointer-events: none;
  }
  .bar {
    position: absolute; top: 50%; transform: translateY(-50%);
    border-radius: 4px; min-width: 2px;
  }
  .ms {
    position: absolute; top: 50%; width: 10px; height: 10px;
    transform: translate(-50%, -50%) rotate(45deg);
    border-radius: 1px; box-shadow: 0 0 0 1px #fff;
  }
  .today-line {
    position: absolute; top: 0; bottom: 0; width: 1px;
    background: rgba(225,29,72,.75); z-index: 2; pointer-events: none;
  }
  .empty {
    padding: 28px 16px; text-align: center; color: var(--muted); font-size: 13px;
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
  .lg-ws {
    width: 18px; height: 10px; background: var(--navy); border-radius: 3px;
  }
  .lg-act {
    width: 18px; height: 8px; background: var(--teal); border-radius: 3px;
  }
  .lg-today {
    width: 0; height: 12px; border-left: 2px solid #e11d48;
  }
  footer.note {
    margin-top: 12px; font-size: 11px; color: var(--muted); text-align: center;
  }
  @media (max-width: 720px) {
    :root { --label-w: 42vw; --row-h: 40px; }
    .wrap { padding: 10px; }
    .recap { grid-template-columns: 1fr 1fr; }
    .toolbar .sep { display: none; }
    .status { width: 100%; margin-left: 0; }
    .gantt { min-width: 560px; }
  }
  @media print {
    body { background: #fff; }
    .wrap { max-width: none; padding: 0; }
    .toolbar { display: none !important; }
    .card, .hero { box-shadow: none; }
    .scroll { overflow: visible; max-height: none; }
    .gantt { min-width: 0; }
    .head, .lab-h, .lab {
      position: static !important;
      box-shadow: none !important;
    }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="brand">Bank of Africa · TransfoHub</p>
      <h1>Planning GANTT</h1>
      <p class="sub">Planning complet — filtrez et regroupez hors ligne</p>
      <span class="mode-pill">Mode interactif · planning entier + filtres hors ligne</span>
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
          <span class="val">${fmtFr(chantier.date_debut)}</span>
        </div>
        <div class="recap-item">
          <span class="lbl">Date de fin</span>
          <span class="val">${fmtFr(chantier.date_fin)}</span>
        </div>
      </div>
      <div class="meta" id="metaStats">
        <span><strong>${chantier.jalons.length}</strong> jalon(s)</span>
        <span><strong>${totalWs}</strong> workstream(s)</span>
        <span><strong>${totalAct}</strong> activité(s)</span>
        <span>Export : <strong>${esc(payload.exportedAt)}</strong></span>
      </div>
    </header>

    <div class="toolbar" id="toolbar" role="toolbar" aria-label="Filtres du planning">
      <div class="group">
        <div class="seg" id="scaleSeg" aria-label="Échelle">
          <button type="button" data-scale="week">Semaine</button>
          <button type="button" data-scale="month">Mois</button>
          <button type="button" data-scale="quarter">Trimestre</button>
        </div>
      </div>
      <div class="sep"></div>
      <div class="group dates">
        <span>Du</span>
        <input type="date" id="filterDu" />
        <span>Au</span>
        <input type="date" id="filterAu" />
      </div>
      <div class="group">
        <div class="seg" id="contentSeg" aria-label="Contenu période">
          <button type="button" data-content="all">Tous</button>
          <button type="button" data-content="intersect">Sur la période</button>
        </div>
      </div>
      <div class="sep"></div>
      <div class="group">
        <label class="chk"><input type="checkbox" id="showJalons" /> Jalons</label>
        <label class="chk"><input type="checkbox" id="showWs" /> Workstreams</label>
        <label class="chk"><input type="checkbox" id="showAct" /> Activités</label>
      </div>
      <div class="sep"></div>
      <div class="group">
        <button type="button" class="btn" id="btnExpand">Tout déplier</button>
        <button type="button" class="btn" id="btnCollapse">Tout replier</button>
        <button type="button" class="btn" id="btnReset">Réinitialiser</button>
      </div>
      <div class="status" id="viewStatus"></div>
    </div>

    <div class="card">
      <div class="scroll">
        <div class="gantt" id="ganttRoot"></div>
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
      Document autonome généré depuis TransfoHub — lisible hors ligne.
      Les filtres s'appliquent localement dans le navigateur ; aucune donnée n'est renvoyée à un serveur.
    </footer>
  </div>

<script>
(function () {
  "use strict";
  var DATA = ${dataJson};
  var NAVY = DATA.brand.navy;
  var TEAL = DATA.brand.teal;

  var state = {
    scale: DATA.initial.scale || "week",
    showJalons: DATA.initial.showJalons !== false,
    showWorkstreams: DATA.initial.showWorkstreams !== false,
    showActivites: !!DATA.initial.showActivites,
    filterDu: DATA.initial.filterDu || "",
    filterAu: DATA.initial.filterAu || "",
    intersectOnly: !!DATA.initial.intersectOnly,
    collapsed: {}
  };

  var defaults = {
    scale: DATA.initial.scale || "week",
    showJalons: DATA.initial.showJalons !== false,
    showWorkstreams: DATA.initial.showWorkstreams !== false,
    showActivites: !!DATA.initial.showActivites,
    filterDu: DATA.initial.filterDu || "",
    filterAu: DATA.initial.filterAu || "",
    intersectOnly: !!DATA.initial.intersectOnly
  };

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function parseYmd(s) {
    if (!s || typeof s !== "string") return null;
    var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s.trim());
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function toYmd(d) {
    if (!d) return "";
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function fmt(d) {
    if (!d) return "—";
    return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  /** Format court comme l'écran app : jj/mm/aa */
  function fmtShort(d) {
    if (!d) return "—";
    var yy = String(d.getFullYear()).slice(-2);
    return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + yy;
  }

  function dayDiff(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 86400000);
  }

  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }

  function startOfWeekMon(d) {
    var x = new Date(d.getTime());
    var day = x.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function endOfWeekMon(d) {
    return addDays(startOfWeekMon(d), 6);
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function endOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - y) / 86400000) + 1) / 7);
  }

  function monthLabel(d) {
    var names = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Aoû","Sep","Oct","Nov","Déc"];
    return names[d.getMonth()];
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rangesOverlap(a0, a1, b0, b1) {
    if (!a0 && !a1) return true;
    if (!b0 && !b1) return true;
    var s1 = a0 || a1;
    var e1 = a1 || a0;
    var s2 = b0 || b1;
    var e2 = b1 || b0;
    return s1 <= e2 && s2 <= e1;
  }

  function collectAllDates() {
    var dates = [];
    var d0 = parseYmd(DATA.date_debut);
    var d1 = parseYmd(DATA.date_fin);
    if (d0) dates.push(d0);
    if (d1) dates.push(d1);
    (DATA.jalons || []).forEach(function (j) {
      var c = parseYmd(j.date_cible);
      var js = parseYmd(j.date_debut);
      if (c) dates.push(c);
      if (js) dates.push(js);
      (j.workstreams || []).forEach(function (w) {
        var a = parseYmd(w.date_debut);
        var b = parseYmd(w.date_fin);
        if (a) dates.push(a);
        if (b) dates.push(b);
        (w.activites || []).forEach(function (act) {
          var x = parseYmd(act.date_debut);
          var y = parseYmd(act.date_fin);
          if (x) dates.push(x);
          if (y) dates.push(y);
        });
      });
    });
    return dates;
  }

  function minDate(arr) {
    var m = arr[0];
    for (var i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
    return m;
  }

  function maxDate(arr) {
    var m = arr[0];
    for (var i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
    return m;
  }

  function computeRange() {
    var dates = collectAllDates();
    var filterStart = parseYmd(state.filterDu);
    var filterEnd = parseYmd(state.filterAu);
    var start, end;
    if (filterStart || filterEnd) {
      start = filterStart || (dates.length ? minDate(dates) : addDays(new Date(), -30));
      end = filterEnd || (dates.length ? maxDate(dates) : addDays(new Date(), 90));
      if (start > end) { var t = start; start = end; end = t; }
      if (dayDiff(end, start) < 1) end = addDays(start, 1);
      return { start: start, end: end };
    }
    if (!dates.length) {
      var today = new Date(); today.setHours(0,0,0,0);
      return { start: addDays(today, -30), end: addDays(today, 90) };
    }
    start = minDate(dates);
    end = maxDate(dates);
    if (state.scale === "week") {
      start = startOfWeekMon(addDays(start, -7));
      end = endOfWeekMon(addDays(end, 14));
    } else if (state.scale === "month") {
      start = startOfMonth(addDays(start, -15));
      end = endOfMonth(addDays(end, 30));
    } else {
      var q0 = Math.floor(start.getMonth() / 3) * 3;
      start = new Date(start.getFullYear(), q0 - 3, 1);
      var q1 = Math.floor(end.getMonth() / 3) * 3;
      end = endOfMonth(new Date(end.getFullYear(), q1 + 5, 1));
    }
    if (dayDiff(end, start) < 14) end = addDays(start, 30);
    return { start: start, end: end };
  }

  function buildTicks(range, totalDays) {
    var dates = [];
    var d;
    if (state.scale === "week") {
      d = startOfWeekMon(range.start);
      while (d <= range.end) { dates.push(new Date(d.getTime())); d = addDays(d, 7); }
    } else if (state.scale === "month") {
      d = startOfMonth(range.start);
      while (d <= range.end) { dates.push(new Date(d.getTime())); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    } else {
      var qm = Math.floor(range.start.getMonth() / 3) * 3;
      d = new Date(range.start.getFullYear(), qm, 1);
      while (d <= range.end) { dates.push(new Date(d.getTime())); d = new Date(d.getFullYear(), d.getMonth() + 3, 1); }
    }
    function pct(date) { return (dayDiff(date, range.start) / totalDays) * 100; }
    var raw = dates.map(function (dt) {
      var primary, secondary;
      if (state.scale === "week") {
        // Haut : lundi de la semaine · Bas : n° de semaine (petit)
        primary = pad2(dt.getDate()) + "/" + pad2(dt.getMonth() + 1);
        secondary = "S" + isoWeek(dt);
      } else if (state.scale === "month") {
        primary = monthLabel(dt);
        secondary = String(dt.getFullYear());
      } else {
        primary = "T" + (Math.floor(dt.getMonth() / 3) + 1);
        secondary = String(dt.getFullYear());
      }
      return { left: pct(dt), primary: primary, secondary: secondary };
    });
    return raw.map(function (t, i) {
      return {
        left: t.left,
        width: Math.max(0.5, (raw[i + 1] ? raw[i + 1].left : 100) - t.left),
        primary: t.primary,
        secondary: t.secondary
      };
    });
  }

  function entityIntersects(start, end, filterStart, filterEnd) {
    if (!filterStart && !filterEnd) return true;
    return rangesOverlap(start, end, filterStart, filterEnd);
  }

  function buildRows() {
    var filterStart = parseYmd(state.filterDu);
    var filterEnd = parseYmd(state.filterAu);
    var useIntersect = state.intersectOnly && (filterStart || filterEnd);
    var out = [];
    var phases = DATA.phases || [];
    phases.forEach(function (phase) {
      var phaseJalons = (DATA.jalons || []).filter(function (j) { return j.phase === phase; })
        .sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
      if (!phaseJalons.length) return;

      var phaseId = "phase:" + phase;
      var phaseCollapsed = !!state.collapsed[phaseId];
      var phaseDates = [];

      var visibleJalons = [];
      phaseJalons.forEach(function (jalon) {
        var jStart = parseYmd(jalon.date_debut);
        var jTarget = parseYmd(jalon.date_cible);
        var jEnd = jTarget || jStart;
        var jStartEff = jStart || jTarget;

        if (useIntersect && state.showJalons) {
          if (!entityIntersects(jStartEff, jEnd, filterStart, filterEnd)) {
            // still show if a child intersects
            var childHit = false;
            (jalon.workstreams || []).forEach(function (w) {
              var wsS = parseYmd(w.date_debut);
              var wsE = parseYmd(w.date_fin);
              if (entityIntersects(wsS || wsE, wsE || wsS, filterStart, filterEnd)) childHit = true;
              (w.activites || []).forEach(function (a) {
                var as = parseYmd(a.date_debut);
                var ae = parseYmd(a.date_fin);
                if (entityIntersects(as || ae, ae || as, filterStart, filterEnd)) childHit = true;
              });
            });
            if (!childHit && !state.showWorkstreams && !state.showActivites) return;
            if (!childHit && !state.showJalons) return;
            if (!childHit) return;
          }
        }

        visibleJalons.push(jalon);
        if (jStart) phaseDates.push(jStart);
        if (jTarget) phaseDates.push(jTarget);
      });

      if (!visibleJalons.length && useIntersect) return;

      out.push({
        id: phaseId,
        kind: "phase",
        label: phase,
        depth: 0,
        phase: phase,
        start: phaseDates.length ? minDate(phaseDates) : null,
        end: phaseDates.length ? maxDate(phaseDates) : null,
        milestone: null,
        collapsible: true,
        collapsed: phaseCollapsed
      });
      if (phaseCollapsed) return;

      visibleJalons.forEach(function (jalon) {
        var jStart = parseYmd(jalon.date_debut);
        var jTarget = parseYmd(jalon.date_cible);
        var jalonId = "jalon:" + jalon.id;
        var jalonCollapsed = !!state.collapsed[jalonId];
        var hasChildren = (jalon.workstreams || []).length > 0;

        if (state.showJalons) {
          out.push({
            id: jalonId,
            kind: "jalon",
            label: jalon.nom,
            depth: 1,
            phase: phase,
            statut: jalon.statut,
            start: jStart,
            end: jTarget,
            milestone: jTarget,
            collapsible: hasChildren,
            collapsed: jalonCollapsed
          });
        }

        if (jalonCollapsed) return;
        if (!state.showWorkstreams && !state.showActivites) return;

        (jalon.workstreams || []).slice().sort(function (a, b) {
          return (a.ordre || 0) - (b.ordre || 0);
        }).forEach(function (ws) {
          var wsS = parseYmd(ws.date_debut);
          var wsE = parseYmd(ws.date_fin);
          if (useIntersect && !entityIntersects(wsS || wsE, wsE || wsS, filterStart, filterEnd)) {
            var actHit = false;
            (ws.activites || []).forEach(function (a) {
              var as = parseYmd(a.date_debut);
              var ae = parseYmd(a.date_fin);
              if (entityIntersects(as || ae, ae || as, filterStart, filterEnd)) actHit = true;
            });
            if (!actHit) return;
          }

          var wsId = "ws:" + ws.id;
          var wsCollapsed = !!state.collapsed[wsId];
          var hasAct = (ws.activites || []).length > 0;

          if (state.showWorkstreams) {
            out.push({
              id: wsId,
              kind: "workstream",
              label: ws.nom,
              depth: state.showJalons ? 2 : 1,
              phase: phase,
              statut: ws.statut,
              start: wsS,
              end: wsE,
              milestone: null,
              collapsible: hasAct && state.showActivites,
              collapsed: wsCollapsed
            });
          }

          if (wsCollapsed || !state.showActivites) return;

          (ws.activites || []).slice().sort(function (a, b) {
            return (a.ordre || 0) - (b.ordre || 0);
          }).forEach(function (act) {
            var as = parseYmd(act.date_debut);
            var ae = parseYmd(act.date_fin);
            if (useIntersect && !entityIntersects(as || ae, ae || as, filterStart, filterEnd)) return;
            out.push({
              id: "act:" + act.id,
              kind: "activite",
              label: act.nom,
              depth: (state.showJalons ? 2 : 1) + (state.showWorkstreams ? 1 : 0),
              phase: phase,
              statut: act.statut,
              start: as,
              end: ae,
              milestone: null,
              collapsible: false,
              collapsed: false
            });
          });
        });
      });
    });
    return out;
  }

  function render() {
    var root = document.getElementById("ganttRoot");
    if (!root) return;
    var range = computeRange();
    var totalDays = Math.max(dayDiff(range.end, range.start), 1);
    function dayPct(d) { return (dayDiff(d, range.start) / totalDays) * 100; }

    var now = new Date(); now.setHours(0,0,0,0);
    var todayPct = (now >= range.start && now <= range.end) ? dayPct(now) : null;
    var chStart = parseYmd(DATA.date_debut);
    var chEnd = parseYmd(DATA.date_fin);
    var chLeft = null;
    var chWidth = null;
    if (chStart && chEnd) {
      var chL = Math.max(0, Math.min(100, dayPct(chStart)));
      var chR = Math.max(0, Math.min(100, dayPct(chEnd)));
      if (chR > chL) {
        chLeft = chL;
        chWidth = Math.max(1, chR - chL);
      }
    }

    var ticks = buildTicks(range, totalDays);
    var slotMin = state.scale === "week" ? 52 : state.scale === "month" ? 76 : 96;
    var timelineMinW = Math.max(640, ticks.length * slotMin);
    var rows = buildRows();

    var tickHtml = ticks.map(function (t) {
      return '<div class="tick" style="left:' + t.left.toFixed(3) + '%;width:' + t.width.toFixed(3) + '%">' +
        '<span class="t-pri">' + esc(t.primary) + '</span>' +
        '<span class="t-sec">' + esc(t.secondary) + '</span></div>';
    }).join("");

    var todayHead = todayPct != null
      ? '<div class="today-head" style="left:' + todayPct.toFixed(3) + '%">Auj.</div>'
      : "";

    var rowsHtml = rows.map(function (row) {
      var phaseColor = (row.phase && DATA.phaseColors[row.phase]) || NAVY;
      var statutColor = (row.statut && DATA.statutColors[row.statut]) || "#94a3b8";
      var pad = 8 + row.depth * 14;
      var barHtml = "";
      if (row.start && row.end) {
        // Clipper à la fenêtre : left/right bornés puis width = right - left
        // (jalons inclus — même rendu que l’écran app)
        var l = Math.max(0, Math.min(100, dayPct(row.start)));
        var r = Math.max(0, Math.min(100, dayPct(addDays(row.end, 1))));
        if (r > l) {
          var w = Math.max(0.4, r - l);
          var h = row.kind === "phase" ? 18
            : row.kind === "workstream" ? 16
            : row.kind === "jalon" ? 12
            : 10;
          var bg = row.kind === "phase" ? phaseColor
            : row.kind === "workstream" ? NAVY
            : row.kind === "jalon" ? statutColor
            : TEAL;
          var opacity = row.kind === "phase" ? "0.35"
            : row.kind === "activite" ? "0.9"
            : "0.95";
          barHtml = '<div class="bar" title="' + esc(row.label + " · " + fmt(row.start) + " → " + fmt(row.end)) +
            '" style="left:' + l.toFixed(3) + '%;width:' + w.toFixed(3) + '%;height:' + h + 'px;background:' + bg + ';opacity:' + opacity + '"></div>';
        }
      }
      var msHtml = "";
      if (row.milestone) {
        var ml = Math.max(0, Math.min(100, dayPct(row.milestone)));
        msHtml = '<div class="ms" title="' + esc(row.label + " · " + fmt(row.milestone) + " · " + (row.statut || "")) +
          '" style="left:' + ml.toFixed(3) + '%;background:' + statutColor + '"></div>';
      }
      var kindTag = row.kind === "phase" ? "" : row.kind === "jalon" ? "J" : row.kind === "workstream" ? "WS" : "Act";
      var labelStyle = row.kind === "phase" ? "font-weight:700;color:" + phaseColor
        : row.kind === "jalon" ? "font-weight:600" : "";
      var rowBg = row.kind === "phase" ? "background:#f8fafc" : "background:#fff";
      var phaseDot = row.kind === "phase" ? '<span class="dot" style="background:' + phaseColor + '"></span>' : "";
      var collapseBtn = row.collapsible
        ? '<button type="button" class="collapse" data-toggle="' + esc(row.id) + '" title="' +
          (row.collapsed ? "Déplier" : "Replier") + '">' + (row.collapsed ? "+" : "−") + "</button>"
        : "";
      var chBand = (chLeft != null && chWidth != null)
        ? '<div class="ch-band" style="left:' + chLeft.toFixed(3) + '%;width:' + chWidth.toFixed(3) + '%"></div>'
        : "";
      var todayLine = todayPct != null
        ? '<div class="today-line" style="left:' + todayPct.toFixed(3) + '%"></div>'
        : "";
      var dateStart = row.start || row.milestone;
      var dateEnd = row.end || row.milestone || row.start;
      var datesHtml = (dateStart || dateEnd)
        ? '<span class="row-dates" title="Date de début → date de fin">' +
          esc(fmtShort(dateStart)) +
          '<span class="row-dates-arrow">→</span>' +
          esc(fmtShort(dateEnd)) +
          "</span>"
        : "";
      return '<div class="row" data-kind="' + row.kind + '" style="' + rowBg + '">' +
        '<div class="lab" style="padding-left:' + pad + 'px">' +
        collapseBtn + phaseDot +
        '<span class="lab-text" style="' + labelStyle + '" title="' + esc(row.label) + '">' + esc(row.label) + "</span>" +
        datesHtml +
        (kindTag ? '<span class="tag">' + kindTag + "</span>" : "") +
        "</div>" +
        '<div class="tl">' + chBand + barHtml + msHtml + todayLine + "</div></div>";
    }).join("");

    root.style.minWidth = "calc(var(--label-w) + " + timelineMinW + "px)";
    root.setAttribute("data-scale", state.scale);
    root.innerHTML =
      '<div class="head"><div class="lab-h">Structure</div><div class="tl-h">' +
      tickHtml + todayHead + "</div></div>" +
      (rowsHtml || '<div class="empty">Aucun élément à afficher avec les filtres actuels.</div>');

    var scaleLabel = state.scale === "week" ? "Semaine" : state.scale === "month" ? "Mois" : "Trimestre";
    var status = document.getElementById("viewStatus");
    if (status) {
      status.textContent =
        rows.length + " ligne(s) · " + scaleLabel + " · " +
        fmt(range.start) + " → " + fmt(range.end);
    }

    var meta = document.getElementById("metaStats");
    if (meta) {
      meta.innerHTML =
        "<span><strong>" + (DATA.jalons || []).length + "</strong> jalon(s)</span>" +
        "<span>Échelle : <strong>" + esc(scaleLabel) + "</strong></span>" +
        "<span>Fenêtre : <strong>" + esc(fmt(range.start)) + " → " + esc(fmt(range.end)) + "</strong></span>" +
        "<span>Export : <strong>" + esc(DATA.exportedAt || "") + "</strong></span>";
    }

    syncToolbar();
  }

  function syncToolbar() {
    var scaleSeg = document.getElementById("scaleSeg");
    if (scaleSeg) {
      Array.prototype.forEach.call(scaleSeg.querySelectorAll("button"), function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-scale") === state.scale);
      });
    }
    var contentSeg = document.getElementById("contentSeg");
    if (contentSeg) {
      var mode = state.intersectOnly ? "intersect" : "all";
      Array.prototype.forEach.call(contentSeg.querySelectorAll("button"), function (btn) {
        var isIntersect = btn.getAttribute("data-content") === "intersect";
        btn.classList.toggle("active", (isIntersect && state.intersectOnly) || (!isIntersect && !state.intersectOnly));
        if (isIntersect) btn.disabled = !state.filterDu && !state.filterAu;
      });
    }
    var sj = document.getElementById("showJalons");
    var sw = document.getElementById("showWs");
    var sa = document.getElementById("showAct");
    if (sj) sj.checked = state.showJalons;
    if (sw) sw.checked = state.showWorkstreams;
    if (sa) sa.checked = state.showActivites;
    var du = document.getElementById("filterDu");
    var au = document.getElementById("filterAu");
    if (du) du.value = state.filterDu || "";
    if (au) {
      au.value = state.filterAu || "";
      if (state.filterDu) au.min = state.filterDu; else au.removeAttribute("min");
    }
  }

  function bind() {
    var scaleSeg = document.getElementById("scaleSeg");
    if (scaleSeg) {
      scaleSeg.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var s = t.getAttribute("data-scale");
        if (!s) return;
        state.scale = s;
        render();
      });
    }
    var contentSeg = document.getElementById("contentSeg");
    if (contentSeg) {
      contentSeg.addEventListener("click", function (e) {
        var t = e.target;
        if (!t || !t.getAttribute) return;
        var c = t.getAttribute("data-content");
        if (!c) return;
        if (c === "intersect" && !state.filterDu && !state.filterAu) return;
        state.intersectOnly = c === "intersect";
        render();
      });
    }
    function onDateChange() {
      var du = document.getElementById("filterDu");
      var au = document.getElementById("filterAu");
      state.filterDu = du ? du.value : "";
      state.filterAu = au ? au.value : "";
      if (state.filterDu || state.filterAu) state.intersectOnly = true;
      else state.intersectOnly = false;
      render();
    }
    var du = document.getElementById("filterDu");
    var au = document.getElementById("filterAu");
    if (du) du.addEventListener("change", onDateChange);
    if (au) au.addEventListener("change", onDateChange);

    ["showJalons", "showWs", "showAct"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", function () {
        if (id === "showJalons") state.showJalons = el.checked;
        if (id === "showWs") state.showWorkstreams = el.checked;
        if (id === "showAct") state.showActivites = el.checked;
        render();
      });
    });

    document.getElementById("btnReset").addEventListener("click", function () {
      state.scale = defaults.scale;
      state.showJalons = defaults.showJalons;
      state.showWorkstreams = defaults.showWorkstreams;
      state.showActivites = defaults.showActivites;
      state.filterDu = defaults.filterDu;
      state.filterAu = defaults.filterAu;
      state.intersectOnly = defaults.intersectOnly;
      state.collapsed = {};
      render();
    });

    document.getElementById("btnExpand").addEventListener("click", function () {
      state.collapsed = {};
      render();
    });

    document.getElementById("btnCollapse").addEventListener("click", function () {
      var next = {};
      (DATA.phases || []).forEach(function (p) { next["phase:" + p] = true; });
      state.collapsed = next;
      render();
    });

    document.getElementById("ganttRoot").addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var id = t.getAttribute("data-toggle");
      if (!id) return;
      state.collapsed[id] = !state.collapsed[id];
      render();
    });
  }

  bind();
  render();
})();
</script>
</body>
</html>
`;
}
