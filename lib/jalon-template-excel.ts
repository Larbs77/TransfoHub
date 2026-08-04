/**
 * Référentiel planning template (Paramètres) — Excel round-trip.
 *
 * Flat sheet Template_Jalons:
 * phase | jalon | jalon_ordre | jalon_offset_pct | workstream | workstream_ordre | activite | activite_ordre
 *
 * Hierarchy: Phase → Jalon → Workstream → Activité
 */

import * as XLSX from "xlsx";
import { PHASES } from "@/lib/jalon-labels";

export const TEMPLATE_SHEET_NAME = "Template_Jalons";
export const TEMPLATE_INSTRUCTIONS_SHEET = "Instructions";

export const TEMPLATE_EXCEL_HEADERS = [
  "phase",
  "jalon",
  "jalon_ordre",
  "jalon_offset_pct",
  "workstream",
  "workstream_ordre",
  "activite",
  "activite_ordre",
] as const;

export type TemplateExcelHeader = (typeof TEMPLATE_EXCEL_HEADERS)[number];

export type ActiviteTemplateNode = {
  id?: string;
  nom: string;
  ordre: number;
  description?: string;
};

export type WorkstreamTemplateNode = {
  id?: string;
  nom: string;
  ordre: number;
  description?: string;
  activites: ActiviteTemplateNode[];
};

export type JalonTemplateNode = {
  id?: string;
  phase: string;
  nom: string;
  ordre: number;
  offsetPct: number;
  workstreams: WorkstreamTemplateNode[];
};

export type TemplateExcelParseIssue = {
  row: number;
  message: string;
};

export type TemplateExcelParseResult = {
  ok: boolean;
  jalons: JalonTemplateNode[];
  issues: TemplateExcelParseIssue[];
  stats: {
    jalonCount: number;
    workstreamCount: number;
    activiteCount: number;
    rowCount: number;
  };
};

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function cellNum(v: unknown, fallback: number): number {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : fallback;
}

function phaseAllowed(phase: string): boolean {
  const n = norm(phase);
  return PHASES.some((p) => norm(p) === n);
}

function canonicalPhase(phase: string): string {
  const n = norm(phase);
  return PHASES.find((p) => norm(p) === n) ?? phase.trim();
}

/** Build flat rows from template tree for Excel export. */
export function templateTreeToRows(
  jalons: JalonTemplateNode[]
): Record<TemplateExcelHeader, string | number>[] {
  const rows: Record<TemplateExcelHeader, string | number>[] = [];
  const sorted = [...jalons].sort((a, b) => {
    const pa = PHASES.indexOf(a.phase as (typeof PHASES)[number]);
    const pb = PHASES.indexOf(b.phase as (typeof PHASES)[number]);
    if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return a.ordre - b.ordre;
  });

  for (const j of sorted) {
    const wsList = [...(j.workstreams ?? [])].sort((a, b) => a.ordre - b.ordre);
    if (wsList.length === 0) {
      rows.push({
        phase: j.phase,
        jalon: j.nom,
        jalon_ordre: j.ordre,
        jalon_offset_pct: j.offsetPct,
        workstream: "",
        workstream_ordre: "",
        activite: "",
        activite_ordre: "",
      });
      continue;
    }
    for (const ws of wsList) {
      const acts = [...(ws.activites ?? [])].sort((a, b) => a.ordre - b.ordre);
      if (acts.length === 0) {
        rows.push({
          phase: j.phase,
          jalon: j.nom,
          jalon_ordre: j.ordre,
          jalon_offset_pct: j.offsetPct,
          workstream: ws.nom,
          workstream_ordre: ws.ordre,
          activite: "",
          activite_ordre: "",
        });
        continue;
      }
      for (const act of acts) {
        rows.push({
          phase: j.phase,
          jalon: j.nom,
          jalon_ordre: j.ordre,
          jalon_offset_pct: j.offsetPct,
          workstream: ws.nom,
          workstream_ordre: ws.ordre,
          activite: act.nom,
          activite_ordre: act.ordre,
        });
      }
    }
  }
  return rows;
}

/** Build workbook (Template_Jalons + Instructions). */
function buildTemplateWorkbook(jalons: JalonTemplateNode[]): XLSX.WorkBook {
  const rows = templateTreeToRows(jalons);
  const aoa: (string | number)[][] = [
    [...TEMPLATE_EXCEL_HEADERS],
    ...rows.map((r) => TEMPLATE_EXCEL_HEADERS.map((h) => r[h] ?? "")),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 14 },
    { wch: 36 },
    { wch: 12 },
    { wch: 16 },
    { wch: 32 },
    { wch: 16 },
    { wch: 36 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_SHEET_NAME);

  const instructions = [
    ["Referentiel planning - template TransfoHub"],
    [""],
    ["Hierarchie : Phase -> Jalon -> Workstream -> Activite"],
    ["Onglet de donnees : Template_Jalons"],
    [""],
    ["Colonnes"],
    ["phase", "Precadrage | Cadrage | Execution | Cloture"],
    ["jalon", "Nom du jalon (obligatoire)"],
    ["jalon_ordre", "Ordre d'affichage du jalon dans la phase"],
    ["jalon_offset_pct", "Position % sur la duree du chantier (0-100)"],
    ["workstream", "Nom du workstream (optionnel)"],
    ["workstream_ordre", "Ordre du workstream sous le jalon"],
    ["activite", "Nom de l'activite (optionnel, sous un workstream)"],
    ["activite_ordre", "Ordre de l'activite sous le workstream"],
    [""],
    ["Regles"],
    ["- Une ligne = une feuille de l'arbre (jalon seul, ou workstream, ou activite)."],
    ["- Repeter phase + jalon sur chaque ligne enfant."],
    ["- Une activite sans workstream est refusee."],
    ["- L'import remplace entierement le referentiel (apres confirmation)."],
    ["- Ne pas renommer les en-tetes de la premiere ligne."],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst["!cols"] = [{ wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInst, TEMPLATE_INSTRUCTIONS_SHEET);
  return wb;
}

/**
 * Build .xlsx as raw bytes.
 * Node: XLSX type "array" returns number[] — always normalize to Uint8Array.
 */
export function buildTemplateExcelBytes(jalons: JalonTemplateNode[]): Uint8Array {
  const wb = buildTemplateWorkbook(jalons);
  const raw = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    cellStyles: false,
  }) as number[] | Uint8Array;
  return raw instanceof Uint8Array ? raw : Uint8Array.from(raw);
}

/** Build .xlsx as base64 (preferred for server actions → browser download). */
export function buildTemplateExcelBase64(jalons: JalonTemplateNode[]): string {
  const wb = buildTemplateWorkbook(jalons);
  // SheetJS native base64 — avoids Node number[] / btoa pitfalls
  return XLSX.write(wb, {
    bookType: "xlsx",
    type: "base64",
    cellStyles: false,
  }) as string;
}

/** @deprecated prefer buildTemplateExcelBytes / buildTemplateExcelBase64 */
export function buildTemplateExcelBuffer(jalons: JalonTemplateNode[]): ArrayBuffer {
  return buildTemplateExcelBytes(jalons).buffer as ArrayBuffer;
}

/** Empty model with header + one example row per phase (structure only). */
export function buildEmptyTemplateExcelBytes(): Uint8Array {
  const example: JalonTemplateNode[] = PHASES.map((phase, i) => ({
    phase,
    nom: `Exemple jalon ${phase}`,
    ordre: 1,
    offsetPct: i * 25,
    workstreams: [
      {
        nom: "Exemple workstream",
        ordre: 1,
        activites: [{ nom: "Exemple activite", ordre: 1 }],
      },
    ],
  }));
  return buildTemplateExcelBytes(example);
}

export function buildEmptyTemplateExcelBase64(): string {
  const example: JalonTemplateNode[] = PHASES.map((phase, i) => ({
    phase,
    nom: `Exemple jalon ${phase}`,
    ordre: 1,
    offsetPct: i * 25,
    workstreams: [
      {
        nom: "Exemple workstream",
        ordre: 1,
        activites: [{ nom: "Exemple activite", ordre: 1 }],
      },
    ],
  }));
  return buildTemplateExcelBase64(example);
}

/** @deprecated prefer buildEmptyTemplateExcelBytes */
export function buildEmptyTemplateExcelBuffer(): ArrayBuffer {
  return buildEmptyTemplateExcelBytes().buffer as ArrayBuffer;
}

function headerIndexMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = norm(cellStr(h)).replace(/ /g, "_");
    map.set(key, i);
  });
  return map;
}

function pick(
  row: unknown[],
  map: Map<string, number>,
  ...aliases: string[]
): string {
  for (const a of aliases) {
    const idx = map.get(norm(a).replace(/ /g, "_"));
    if (idx !== undefined) return cellStr(row[idx]);
  }
  return "";
}

function pickNum(
  row: unknown[],
  map: Map<string, number>,
  fallback: number,
  ...aliases: string[]
): number {
  for (const a of aliases) {
    const idx = map.get(norm(a).replace(/ /g, "_"));
    if (idx !== undefined) return cellNum(row[idx], fallback);
  }
  return fallback;
}

/**
 * Parse an Excel buffer into a template tree.
 * Accepts sheet Template_Jalons or the first sheet.
 */
export function parseTemplateExcelBuffer(data: ArrayBuffer | Uint8Array): TemplateExcelParseResult {
  const issues: TemplateExcelParseIssue[] = [];
  const wb = XLSX.read(data, { type: "array" });
  const sheetName =
    wb.SheetNames.find((n) => norm(n) === norm(TEMPLATE_SHEET_NAME)) ??
    wb.SheetNames[0];
  if (!sheetName) {
    return {
      ok: false,
      jalons: [],
      issues: [{ row: 0, message: "Fichier Excel vide (aucun onglet)." }],
      stats: { jalonCount: 0, workstreamCount: 0, activiteCount: 0, rowCount: 0 },
    };
  }

  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  if (!aoa.length) {
    return {
      ok: false,
      jalons: [],
      issues: [{ row: 0, message: "Onglet vide." }],
      stats: { jalonCount: 0, workstreamCount: 0, activiteCount: 0, rowCount: 0 },
    };
  }

  const map = headerIndexMap(aoa[0] ?? []);
  const required = ["phase", "jalon"];
  for (const r of required) {
    if (!map.has(r)) {
      issues.push({
        row: 1,
        message: `Colonne obligatoire manquante : ${r}`,
      });
    }
  }
  if (issues.length) {
    return {
      ok: false,
      jalons: [],
      issues,
      stats: { jalonCount: 0, workstreamCount: 0, activiteCount: 0, rowCount: 0 },
    };
  }

  type AccJalon = JalonTemplateNode & {
    _ws: Map<string, WorkstreamTemplateNode & { _key: string }>;
  };
  const jalonMap = new Map<string, AccJalon>();
  let dataRows = 0;

  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] ?? [];
    const excelRow = i + 1;
    const phaseRaw = pick(row, map, "phase");
    const jalonNom = pick(row, map, "jalon", "nom_jalon", "nom");
    const wsNom = pick(row, map, "workstream", "ws");
    const actNom = pick(row, map, "activite", "activité", "activity");

    // Skip fully empty rows
    if (!phaseRaw && !jalonNom && !wsNom && !actNom) continue;
    dataRows++;

    if (!phaseRaw || !jalonNom) {
      issues.push({
        row: excelRow,
        message: "phase et jalon sont obligatoires.",
      });
      continue;
    }
    if (!phaseAllowed(phaseRaw)) {
      issues.push({
        row: excelRow,
        message: `phase invalide « ${phaseRaw} » (Précadrage | Cadrage | Exécution | Clôture).`,
      });
      continue;
    }
    if (actNom && !wsNom) {
      issues.push({
        row: excelRow,
        message: "une activité nécessite un workstream sur la même ligne.",
      });
      continue;
    }

    const phase = canonicalPhase(phaseRaw);
    const jKey = `${norm(phase)}::${norm(jalonNom)}`;
    let jNode = jalonMap.get(jKey);
    const jOrdre = pickNum(row, map, 0, "jalon_ordre", "ordre_jalon", "ordre");
    const offset = pickNum(
      row,
      map,
      0,
      "jalon_offset_pct",
      "offset_pct",
      "offsetpct",
      "position"
    );

    if (!jNode) {
      jNode = {
        phase,
        nom: jalonNom,
        ordre: jOrdre || jalonMap.size + 1,
        offsetPct: Math.min(100, Math.max(0, offset)),
        workstreams: [],
        _ws: new Map(),
      };
      jalonMap.set(jKey, jNode);
    } else {
      if (jOrdre) jNode.ordre = jOrdre;
      if (offset || offset === 0) {
        const o = pickNum(row, map, jNode.offsetPct, "jalon_offset_pct", "offset_pct", "offsetpct");
        jNode.offsetPct = Math.min(100, Math.max(0, o));
      }
    }

    if (!wsNom) continue;

    const wsKey = norm(wsNom);
    let wsNode = jNode._ws.get(wsKey);
    const wsOrdre = pickNum(row, map, 0, "workstream_ordre", "ordre_workstream");
    if (!wsNode) {
      wsNode = {
        nom: wsNom,
        ordre: wsOrdre || jNode._ws.size + 1,
        activites: [],
        _key: wsKey,
      };
      jNode._ws.set(wsKey, wsNode);
    } else if (wsOrdre) {
      wsNode.ordre = wsOrdre;
    }

    if (!actNom) continue;

    const actOrdre = pickNum(row, map, 0, "activite_ordre", "ordre_activite");
    const actNorm = norm(actNom);
    if (wsNode.activites.some((a) => norm(a.nom) === actNorm)) {
      issues.push({
        row: excelRow,
        message: `activité en double « ${actNom} » sous workstream « ${wsNom} ».`,
      });
      continue;
    }
    wsNode.activites.push({
      nom: actNom,
      ordre: actOrdre || wsNode.activites.length + 1,
    });
  }

  const jalons: JalonTemplateNode[] = [];
  for (const j of jalonMap.values()) {
    const workstreams = [...j._ws.values()]
      .map(({ _key: _k, ...ws }) => ({
        ...ws,
        activites: [...ws.activites].sort((a, b) => a.ordre - b.ordre),
      }))
      .sort((a, b) => a.ordre - b.ordre);
    jalons.push({
      phase: j.phase,
      nom: j.nom,
      ordre: j.ordre,
      offsetPct: j.offsetPct,
      workstreams,
    });
  }

  jalons.sort((a, b) => {
    const pa = PHASES.indexOf(a.phase as (typeof PHASES)[number]);
    const pb = PHASES.indexOf(b.phase as (typeof PHASES)[number]);
    if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return a.ordre - b.ordre;
  });

  const workstreamCount = jalons.reduce((n, j) => n + j.workstreams.length, 0);
  const activiteCount = jalons.reduce(
    (n, j) => n + j.workstreams.reduce((m, w) => m + w.activites.length, 0),
    0
  );

  const hardErrors = issues.filter((i) => !i.message.includes("en double"));
  // Duplicates are soft? treat all as blocking for clean import
  const ok = issues.length === 0 && jalons.length > 0;

  if (jalons.length === 0 && issues.length === 0) {
    issues.push({ row: 0, message: "Aucune ligne de données valide." });
  }

  return {
    ok: ok && hardErrors.length === 0,
    jalons,
    issues,
    stats: {
      jalonCount: jalons.length,
      workstreamCount,
      activiteCount,
      rowCount: dataRows,
    },
  };
}

export function arrayBufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  // Prefer Node Buffer (server actions) — reliable for binary
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/^data:.*?;base64,/, "").replace(/\s/g, "");
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(clean, "base64"));
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
