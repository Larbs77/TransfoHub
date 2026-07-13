/**
 * CSV import / export helpers for Technique → Import / Purge
 * and Maintenance DB multi-table CSV export.
 *
 * Field separator is PIPE `|` (not comma) so free text may contain commas.
 * Technical fields (id, createdAt, updatedAt) are never imported — system-managed.
 * RAID `code` is optional on import (auto A_00001… if empty); included on export.
 */

import {
  isValidRaidCodeFormat,
  normalizeRaidCode,
  raidCodeMatchesType,
} from "@/lib/raid-code";

/** Delimiter used in all TransfoHub CSV exports/imports. */
export const CSV_SEPARATOR = "|" as const;

export type DataTableKey = "raid" | "ressources";

export type CsvColumn = {
  key: string;
  header: string;
  required?: boolean;
  description?: string;
};

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export type RowStatus = "ok" | "error";

export type PreviewRow = {
  line: number;
  status: RowStatus;
  errors: string[];
  /** Display values (business keys → string) */
  display: Record<string, string>;
  /** Payload ready for insert (only when status === "ok") */
  payload: Record<string, unknown> | null;
};

export type PreviewReport = {
  table: DataTableKey;
  total: number;
  okCount: number;
  errorCount: number;
  rows: PreviewRow[];
};

// ── Column definitions (business fields only) ─────────

export const RESSOURCE_CSV_COLUMNS: CsvColumn[] = [
  { key: "nom_complet", header: "nom_complet", required: true, description: "Nom complet" },
  { key: "email", header: "email", description: "Adresse e-mail" },
  { key: "telephone", header: "telephone", description: "Téléphone" },
  {
    key: "type",
    header: "type",
    required: true,
    description: "Interne | Externe | Consultant",
  },
  { key: "organisation", header: "organisation", description: "Organisation" },
  {
    key: "tarif_journalier",
    header: "tarif_journalier",
    description: "TJM (nombre décimal)",
  },
  {
    key: "capacite_jours_mois",
    header: "capacite_jours_mois",
    description: "Capacité en jours/mois (entier, défaut 20)",
  },
  {
    key: "actif",
    header: "actif",
    description: "true/false, oui/non, 1/0 (défaut true)",
  },
  {
    key: "profil",
    header: "profil",
    description: "Nom du profil ressource (optionnel)",
  },
];

export const RAID_CSV_COLUMNS: CsvColumn[] = [
  {
    key: "code",
    header: "code",
    description:
      "Code RAID (A_00001 / R_… / I_… / D_…). Optionnel à l'import : auto-attribué si vide",
  },
  {
    key: "type",
    header: "type",
    required: true,
    description: "Action | Risque | Information | Décision",
  },
  { key: "intitule", header: "intitule", required: true, description: "Intitulé" },
  { key: "description", header: "description", description: "Description" },
  { key: "categorie", header: "categorie", description: "Catégorie" },
  {
    key: "chantier_code",
    header: "chantier_code",
    description: "Code chantier (ex. CH_001)",
  },
  { key: "domaine", header: "domaine", description: "Domaine" },
  {
    key: "probabilite",
    header: "probabilite",
    description: "1–5 (Risque)",
  },
  { key: "impact", header: "impact", description: "1–5 (Risque)" },
  { key: "strategie", header: "strategie", description: "Stratégie (Risque)" },
  { key: "mitigation", header: "mitigation", description: "Mitigation" },
  { key: "responsable", header: "responsable", description: "Nom responsable" },
  {
    key: "responsable_email",
    header: "responsable_email",
    description: "E-mail ressource responsable (lien optionnel)",
  },
  { key: "statut", header: "statut", description: "Statut" },
  {
    key: "date_identification",
    header: "date_identification",
    description: "YYYY-MM-DD",
  },
  {
    key: "date_revision",
    header: "date_revision",
    description: "YYYY-MM-DD",
  },
  {
    key: "date_echeance",
    header: "date_echeance",
    description: "YYYY-MM-DD",
  },
  { key: "commentaires", header: "commentaires", description: "Commentaires" },
];

export const DATA_TABLE_META: Record<
  DataTableKey,
  {
    label: string;
    description: string;
    columns: CsvColumn[];
    fileBase: string;
  }
> = {
  ressources: {
    label: "Ressources",
    description:
      "Personnes / ressources du programme (profil, TJM, capacité).",
    columns: RESSOURCE_CSV_COLUMNS,
    fileBase: "ressources",
  },
  raid: {
    label: "RAID",
    description:
      "Risques, Actions, Informations et Décisions (code A_/R_/I_/D_#####, chantier par code).",
    columns: RAID_CSV_COLUMNS,
    fileBase: "raid",
  },
};

export const DATA_TABLE_KEYS: DataTableKey[] = ["ressources", "raid"];

// ── CSV parse / serialize (pipe-separated) ────────────

/**
 * Escape a single field for pipe-separated CSV.
 * Quotes when the value contains `|`, `"`, or line breaks.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : typeof value === "boolean"
        ? value
          ? "true"
          : "false"
        : String(value);
  // Quote if separator, quote, or newline present (commas are allowed unquoted)
  if (/["|\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const sep = CSV_SEPARATOR;
  const lines = [
    headers.map(escapeCsvField).join(sep),
    ...rows.map((r) => r.map(escapeCsvField).join(sep)),
  ];
  // BOM for Excel French locales
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function getTemplateCsv(table: DataTableKey): string {
  const cols = DATA_TABLE_META[table].columns;
  return rowsToCsv(
    cols.map((c) => c.header),
    []
  );
}

/**
 * Detect separator: prefer pipe `|` (TransfoHub default).
 * Falls back to comma only if no pipe appears on the header line
 * (legacy files) — pipes win when both are present.
 */
export function detectCsvSeparator(headerLine: string): string {
  const unquoted = headerLine.replace(/"[^"]*"/g, "");
  if (unquoted.includes(CSV_SEPARATOR)) return CSV_SEPARATOR;
  if (unquoted.includes(",")) return ",";
  return CSV_SEPARATOR;
}

/**
 * Minimal CSV parser supporting quoted fields and CRLF/LF.
 * Default separator is `|`. Auto-detects comma for legacy files without pipes.
 */
export function parseCsv(text: string, separator?: string): ParsedCsv {
  // Strip BOM
  const raw = text.replace(/^\uFEFF/, "");
  if (!raw.trim()) {
    return { headers: [], rows: [] };
  }

  // Peek first line to detect separator if not forced
  let sep = separator;
  if (!sep) {
    const firstNl = raw.search(/\r?\n/);
    const headerLine = firstNl === -1 ? raw : raw.slice(0, firstNl);
    sep = detectCsvSeparator(headerLine);
  }

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === sep) {
      row.push(field.trim());
      field = "";
    } else if (c === "\r") {
      // ignore; handle with \n
    } else if (c === "\n") {
      row.push(field.trim());
      field = "";
      // skip empty trailing lines
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      field += c;
    }
  }
  // last field / row
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0].map((h) => h.trim());
  return { headers, rows: rows.slice(1) };
}

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

export function mapRowToObject(
  headers: string[],
  cells: string[]
): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key) obj[key] = (cells[i] ?? "").trim();
  });
  return obj;
}

// ── Value helpers ─────────────────────────────────────

const RESSOURCE_TYPES = new Set(["Interne", "Externe", "Consultant"]);
const RAID_TYPES = new Set(["Action", "Risque", "Information", "Décision"]);

export function parseBoolean(raw: string, defaultValue = true): boolean | null {
  if (raw === "") return defaultValue;
  const v = raw.toLowerCase();
  if (["true", "1", "oui", "yes", "o", "vrai"].includes(v)) return true;
  if (["false", "0", "non", "no", "n", "faux"].includes(v)) return false;
  return null;
}

export function parseOptionalInt(
  raw: string,
  min?: number,
  max?: number
): { value: number | null; error?: string } {
  if (raw === "") return { value: null };
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { value: null, error: `entier attendu (« ${raw} »)` };
  }
  if (min !== undefined && n < min) {
    return { value: null, error: `minimum ${min}` };
  }
  if (max !== undefined && n > max) {
    return { value: null, error: `maximum ${max}` };
  }
  return { value: n };
}

export function parseOptionalFloat(
  raw: string
): { value: number | null; error?: string } {
  if (raw === "") return { value: null };
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) {
    return { value: null, error: `nombre attendu (« ${raw} »)` };
  }
  return { value: n };
}

/** Accept YYYY-MM-DD or DD/MM/YYYY */
export function parseOptionalDate(
  raw: string
): { value: string | null; error?: string } {
  if (raw === "") return { value: null };
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return { value: null, error: `date invalide (« ${raw} »)` };
    }
    return { value: `${iso[1]}-${iso[2]}-${iso[3]}` };
  }
  const fr = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const dd = fr[1].padStart(2, "0");
    const mm = fr[2].padStart(2, "0");
    const yyyy = fr[3];
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return { value: null, error: `date invalide (« ${raw} »)` };
    }
    return { value: `${yyyy}-${mm}-${dd}` };
  }
  return {
    value: null,
    error: `format de date invalide (« ${raw} » — utiliser YYYY-MM-DD)`,
  };
}

export function isValidRessourceType(t: string): boolean {
  return RESSOURCE_TYPES.has(t);
}

export function isValidRaidType(t: string): boolean {
  return RAID_TYPES.has(t);
}

export type LookupMaps = {
  chantierByCode: Map<string, string>;
  ressourceByEmail: Map<string, string>;
  profilByName: Map<string, string>;
};

export function validateRessourceRow(
  raw: Record<string, string>,
  lookups: LookupMaps
): { errors: string[]; payload: Record<string, unknown> | null; display: Record<string, string> } {
  const errors: string[] = [];
  const nom_complet = (raw.nom_complet ?? "").trim();
  const email = (raw.email ?? "").trim();
  const telephone = (raw.telephone ?? "").trim();
  const type = (raw.type ?? "").trim();
  const organisation = (raw.organisation ?? "").trim();
  const profilName = (raw.profil ?? "").trim();

  if (!nom_complet) errors.push("nom_complet obligatoire");
  if (!type) errors.push("type obligatoire");
  else if (!isValidRessourceType(type)) {
    errors.push(`type invalide (« ${type} » — Interne, Externe ou Consultant)`);
  }

  const tjm = parseOptionalFloat(raw.tarif_journalier ?? "");
  if (tjm.error) errors.push(`tarif_journalier : ${tjm.error}`);

  const cap = parseOptionalInt(raw.capacite_jours_mois ?? "", 0, 31);
  if (cap.error) errors.push(`capacite_jours_mois : ${cap.error}`);

  const actif = parseBoolean(raw.actif ?? "", true);
  if (actif === null) errors.push(`actif invalide (« ${raw.actif} »)`);

  let profilId: string | null = null;
  if (profilName) {
    const id = lookups.profilByName.get(profilName.toLowerCase());
    if (!id) {
      errors.push(`profil introuvable (« ${profilName} »)`);
    } else {
      profilId = id;
    }
  }

  const display: Record<string, string> = {
    nom_complet,
    email,
    telephone,
    type,
    organisation,
    tarif_journalier: raw.tarif_journalier ?? "",
    capacite_jours_mois: raw.capacite_jours_mois ?? "",
    actif: raw.actif ?? "",
    profil: profilName,
  };

  if (errors.length > 0) {
    return { errors, payload: null, display };
  }

  return {
    errors: [],
    display,
    payload: {
      nom_complet,
      email,
      telephone,
      type,
      organisation,
      tarif_journalier: tjm.value ?? 0,
      capacite_jours_mois: cap.value ?? 20,
      actif: actif as boolean,
      profilId,
    },
  };
}

export function validateRaidRow(
  raw: Record<string, string>,
  lookups: LookupMaps
): { errors: string[]; payload: Record<string, unknown> | null; display: Record<string, string> } {
  const errors: string[] = [];
  const type = (raw.type ?? "").trim();
  const intitule = (raw.intitule ?? "").trim();
  const description = (raw.description ?? "").trim();
  const categorie = (raw.categorie ?? "").trim();
  const chantier_code = (raw.chantier_code ?? "").trim();
  const domaine = (raw.domaine ?? "").trim();
  const strategie = (raw.strategie ?? "").trim();
  const mitigation = (raw.mitigation ?? "").trim();
  const responsable = (raw.responsable ?? "").trim();
  const responsable_email = (raw.responsable_email ?? "").trim().toLowerCase();
  const statut = (raw.statut ?? "").trim();
  const commentaires = (raw.commentaires ?? "").trim();
  const codeRaw = (raw.code ?? "").trim();

  if (!type) errors.push("type obligatoire");
  else if (!isValidRaidType(type)) {
    errors.push(
      `type invalide (« ${type} » — Action, Risque, Information ou Décision)`
    );
  }
  if (!intitule) errors.push("intitule obligatoire");

  let code: string | null = null;
  if (codeRaw) {
    const normalized = normalizeRaidCode(codeRaw);
    if (!isValidRaidCodeFormat(normalized)) {
      errors.push(
        `code invalide (« ${codeRaw} » — format A_00001 / R_… / I_… / D_…)`
      );
    } else if (
      type &&
      isValidRaidType(type) &&
      !raidCodeMatchesType(normalized, type)
    ) {
      errors.push(
        `code « ${normalized} » ne correspond pas au type « ${type} »`
      );
    } else {
      code = normalized;
    }
  }

  const prob = parseOptionalInt(raw.probabilite ?? "", 1, 5);
  if (prob.error) errors.push(`probabilite : ${prob.error}`);
  const impact = parseOptionalInt(raw.impact ?? "", 1, 5);
  if (impact.error) errors.push(`impact : ${impact.error}`);

  const dId = parseOptionalDate(raw.date_identification ?? "");
  if (dId.error) errors.push(`date_identification : ${dId.error}`);
  const dRev = parseOptionalDate(raw.date_revision ?? "");
  if (dRev.error) errors.push(`date_revision : ${dRev.error}`);
  const dEch = parseOptionalDate(raw.date_echeance ?? "");
  if (dEch.error) errors.push(`date_echeance : ${dEch.error}`);

  let chantierId: string | null = null;
  if (chantier_code) {
    const id = lookups.chantierByCode.get(chantier_code.toUpperCase());
    if (!id) {
      errors.push(`chantier_code introuvable (« ${chantier_code} »)`);
    } else {
      chantierId = id;
    }
  }

  let responsableRessourceId: string | null = null;
  if (responsable_email) {
    const id = lookups.ressourceByEmail.get(responsable_email);
    if (!id) {
      errors.push(
        `responsable_email introuvable (« ${responsable_email} »)`
      );
    } else {
      responsableRessourceId = id;
    }
  }

  const display: Record<string, string> = {
    code: code ?? codeRaw,
    type,
    intitule,
    description,
    categorie,
    chantier_code,
    domaine,
    probabilite: raw.probabilite ?? "",
    impact: raw.impact ?? "",
    strategie,
    mitigation,
    responsable,
    responsable_email: raw.responsable_email ?? "",
    statut,
    date_identification: raw.date_identification ?? "",
    date_revision: raw.date_revision ?? "",
    date_echeance: raw.date_echeance ?? "",
    commentaires,
  };

  if (errors.length > 0) {
    return { errors, payload: null, display };
  }

  return {
    errors: [],
    display,
    payload: {
      code,
      type,
      intitule,
      description,
      categorie,
      chantierId,
      domaine,
      probabilite: prob.value,
      impact: impact.value,
      strategie,
      mitigation,
      responsable,
      responsableRessourceId,
      statut,
      date_identification: dId.value,
      date_revision: dRev.value,
      date_echeance: dEch.value,
      commentaires,
      comiteId: null as string | null,
    },
  };
}

export function buildPreviewReport(
  table: DataTableKey,
  csvText: string,
  lookups: LookupMaps
): PreviewReport {
  const parsed = parseCsv(csvText);
  if (parsed.headers.length === 0) {
    return {
      table,
      total: 0,
      okCount: 0,
      errorCount: 0,
      rows: [],
    };
  }

  const expected = DATA_TABLE_META[table].columns.map((c) =>
    normalizeHeader(c.header)
  );
  const headerSet = new Set(parsed.headers.map(normalizeHeader));
  const missingRequired = DATA_TABLE_META[table].columns
    .filter((c) => c.required && !headerSet.has(normalizeHeader(c.header)))
    .map((c) => c.header);

  const rows: PreviewRow[] = [];
  let okCount = 0;
  let errorCount = 0;

  if (missingRequired.length > 0) {
    // Single synthetic error if required columns missing
    return {
      table,
      total: 0,
      okCount: 0,
      errorCount: 1,
      rows: [
        {
          line: 1,
          status: "error",
          errors: [
            `Colonnes obligatoires manquantes : ${missingRequired.join(", ")}. Colonnes attendues : ${expected.join(", ")}`,
          ],
          display: {},
          payload: null,
        },
      ],
    };
  }

  parsed.rows.forEach((cells, idx) => {
    const line = idx + 2; // 1-based + header
    const raw = mapRowToObject(parsed.headers, cells);
    // skip fully empty rows
    if (Object.values(raw).every((v) => !v)) return;

    const result =
      table === "ressources"
        ? validateRessourceRow(raw, lookups)
        : validateRaidRow(raw, lookups);

    const status: RowStatus = result.errors.length ? "error" : "ok";
    if (status === "ok") okCount++;
    else errorCount++;

    rows.push({
      line,
      status,
      errors: result.errors,
      display: result.display,
      payload: result.payload,
    });
  });

  return {
    table,
    total: rows.length,
    okCount,
    errorCount,
    rows,
  };
}
