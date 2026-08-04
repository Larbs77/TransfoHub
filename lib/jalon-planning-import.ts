/**
 * Import planning jalons (par chantier) — CSV pipe `|`.
 *
 * Dry-run (chargement à blanc) then confirm injection.
 * Cas 1 : 0 jalon → simuler/appliquer le template puis merge fichier.
 * Cas 2 : jalons existants → merge only (CREATE / UPDATE / SKIP).
 * Matching : phase + nom (normalisés). Pas de suppression automatique.
 */

import {
  PHASES,
  STATUT_JALON_LIST,
  JALON_TEMPLATES,
  calculateDateCible,
} from "@/lib/jalon-labels";
import {
  CSV_SEPARATOR,
  type CsvColumn,
  parseCsv,
  rowsToCsv,
  formatCsvDate,
  parseOptionalDate,
} from "@/lib/csv-data-admin";

// ── Columns ───────────────────────────────────────────

export const JALON_PLANNING_CSV_COLUMNS: CsvColumn[] = [
  {
    key: "chantier_code",
    header: "chantier_code",
    description: "Code chantier (doit correspondre au chantier sélectionné)",
  },
  {
    key: "phase",
    header: "phase",
    required: true,
    description: "Précadrage | Cadrage | Exécution | Clôture",
  },
  {
    key: "nom",
    header: "nom",
    required: true,
    description: "Nom du jalon (clé avec phase)",
  },
  {
    key: "ordre",
    header: "ordre",
    description: "Ordre dans la phase (entier)",
  },
  {
    key: "date_cible",
    header: "date_cible",
    description: "jj/mm/aaaa (obligatoire à la création)",
  },
  {
    key: "date_reelle",
    header: "date_reelle",
    description: "jj/mm/aaaa ou vide",
  },
  {
    key: "statut",
    header: "statut",
    description: STATUT_JALON_LIST.join(" | "),
  },
  {
    key: "description",
    header: "description",
    description: "Description",
  },
  {
    key: "livrables",
    header: "livrables",
    description: "Livrables",
  },
  {
    key: "commentaire",
    header: "commentaire",
    description: "Commentaire",
  },
];

export const JALON_PLANNING_HEADERS = JALON_PLANNING_CSV_COLUMNS.map(
  (c) => c.header
);

// ── Types ─────────────────────────────────────────────

export type PlanningAction = "CREATE" | "UPDATE" | "SKIP" | "ERROR";

export type JalonSnapshot = {
  id: string | null; // null = virtual (template not yet in DB)
  phase: string;
  nom: string;
  ordre: number;
  /** Internal ISO YYYY-MM-DD for compare/persist */
  date_cible: string;
  /** Internal ISO YYYY-MM-DD or "" */
  date_reelle: string;
  statut: string;
  description: string;
  livrables: string;
  commentaire: string;
};

export type PlanningFieldChange = {
  field: string;
  from: string;
  to: string;
};

export type PlanningPreviewRow = {
  line: number;
  action: PlanningAction;
  errors: string[];
  warnings: string[];
  phase: string;
  nom: string;
  display: Record<string, string>;
  changes: PlanningFieldChange[];
  /** Payload for CREATE / UPDATE (absent on ERROR / SKIP) */
  apply?: PlanningApplyOp;
};

export type PlanningApplyOp =
  | {
      kind: "CREATE";
      phase: string;
      nom: string;
      ordre: number;
      date_cible: string;
      date_reelle: string | null;
      statut: string;
      description: string;
      livrables: string;
      commentaire: string;
    }
  | {
      kind: "UPDATE";
      id: string;
      phase: string;
      nom: string;
      data: {
        ordre?: number;
        date_cible?: string;
        date_reelle?: string | null;
        clear_date_reelle?: boolean;
        statut?: string;
        description?: string;
        livrables?: string;
        commentaire?: string;
      };
    };

export type PlanningPreviewReport = {
  chantierId: string;
  chantierCode: string;
  chantierNom: string;
  dateDebut: string;
  dateFin: string;
  existingJalonCount: number;
  willApplyTemplate: boolean;
  templateJalonCount: number;
  total: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  rows: PlanningPreviewRow[];
  /** Fingerprint of DB state at preview time (re-check on confirm) */
  fingerprint: string;
  formatErrors: string[];
};

export type TemplateRow = {
  phase: string;
  nom: string;
  ordre: number;
  offsetPct: number;
};

export type ExistingJalonRow = {
  id: string;
  phase: string;
  nom: string;
  ordre: number;
  date_cible: Date;
  date_reelle: Date | null;
  statut: string;
  description: string;
  livrables: string;
  commentaire: string;
  updatedAt: Date;
};

// ── Helpers ───────────────────────────────────────────

export function normalizeJalonKey(phase: string, nom: string): string {
  return `${normalizeText(phase)}||${normalizeText(nom)}`;
}

function normalizeText(s: string): string {
  return s
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Internal ISO calendar day (UTC) — not for CSV files. */
export function formatDateYmd(d: Date | null | undefined): string {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Display / CSV: jj/mm/aaaa */
export function formatPlanningDateFr(d: Date | string | null | undefined): string {
  return formatCsvDate(d);
}

/**
 * Parse CSV date → internal ISO YYYY-MM-DD.
 * Canonical file format: jj/mm/aaaa (legacy aaaa-mm-jj still accepted).
 */
export function parsePlanningDate(
  raw: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const parsed = parseOptionalDate(raw);
  if (parsed.error) return { ok: false, error: parsed.error };
  return { ok: true, value: parsed.value };
}

/** Format a change value for the preview UI (jj/mm/aaaa). */
function displayDate(isoOrEmpty: string): string {
  if (!isoOrEmpty || isoOrEmpty === "—") return isoOrEmpty || "—";
  return formatCsvDate(isoOrEmpty) || isoOrEmpty;
}

export function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function buildPlanningFingerprint(
  existing: ExistingJalonRow[],
  willApplyTemplate: boolean
): string {
  const parts = existing
    .map((j) => `${j.id}:${j.updatedAt.toISOString()}`)
    .sort();
  return `${willApplyTemplate ? "T" : "E"}|${existing.length}|${parts.join(",")}`;
}

export function emptyPlanningTemplateCsv(): string {
  return rowsToCsv(JALON_PLANNING_HEADERS, []);
}

/** Index métier des phases : Précadrage → Cadrage → Exécution → Clôture */
export function phasePathIndex(phase: string): number {
  const n = phase.normalize("NFC").trim();
  const i = (PHASES as readonly string[]).findIndex(
    (p) => p.normalize("NFC") === n
  );
  return i === -1 ? 999 : i;
}

/**
 * Ordre export / template : cheminement phases puis `ordre` puis nom.
 * Précadrage > Cadrage > Exécution > Clôture
 */
export function sortByPhasePath<
  T extends { phase: string; ordre?: number; nom?: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = phasePathIndex(a.phase);
    const pb = phasePathIndex(b.phase);
    if (pa !== pb) return pa - pb;
    const oa = a.ordre ?? 0;
    const ob = b.ordre ?? 0;
    if (oa !== ob) return oa - ob;
    return (a.nom ?? "").localeCompare(b.nom ?? "", "fr");
  });
}

export function buildPlanningCsvFromSnapshots(
  chantierCode: string,
  rows: Array<{
    phase: string;
    nom: string;
    ordre: number;
    date_cible: string;
    date_reelle: string;
    statut: string;
    description: string;
    livrables: string;
    commentaire: string;
  }>
): string {
  const ordered = sortByPhasePath(rows);
  const data = ordered.map((r) => [
    chantierCode,
    r.phase,
    r.nom,
    r.ordre,
    formatCsvDate(r.date_cible),
    formatCsvDate(r.date_reelle),
    r.statut,
    r.description,
    r.livrables,
    r.commentaire,
  ]);
  return rowsToCsv(JALON_PLANNING_HEADERS, data);
}

function snapshotFromExisting(j: ExistingJalonRow): JalonSnapshot {
  return {
    id: j.id,
    phase: j.phase,
    nom: j.nom,
    ordre: j.ordre,
    date_cible: formatDateYmd(j.date_cible),
    date_reelle: formatDateYmd(j.date_reelle),
    statut: j.statut,
    description: j.description ?? "",
    livrables: j.livrables ?? "",
    commentaire: j.commentaire ?? "",
  };
}

function snapshotFromTemplate(
  t: TemplateRow,
  dateDebut: Date,
  dateFin: Date
): JalonSnapshot {
  return {
    id: null,
    phase: t.phase,
    nom: t.nom,
    ordre: t.ordre,
    date_cible: formatDateYmd(calculateDateCible(dateDebut, dateFin, t.offsetPct)),
    date_reelle: "",
    statut: "Planifié",
    description: "",
    livrables: "",
    commentaire: "",
  };
}

function isValidPhase(phase: string): boolean {
  const n = phase.normalize("NFC").trim();
  return (PHASES as readonly string[]).some((p) => p.normalize("NFC") === n);
}

/** Map user phase text to canonical PHASES label (NFC). */
function canonicalPhase(phase: string): string {
  const n = phase.normalize("NFC").trim();
  return (
    (PHASES as readonly string[]).find((p) => p.normalize("NFC") === n) ?? n
  );
}

function isValidStatut(statut: string): boolean {
  return STATUT_JALON_LIST.includes(statut);
}

function colMap(headers: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(h.trim().toLowerCase(), i));
  return m;
}

function cell(row: string[], map: Map<string, number>, key: string): string {
  const i = map.get(key.toLowerCase());
  if (i === undefined) return "";
  return (row[i] ?? "").trim();
}

// ── Dry-run ───────────────────────────────────────────

export type BuildPlanningPreviewInput = {
  chantierId: string;
  chantierCode: string;
  chantierNom: string;
  dateDebut: Date;
  dateFin: Date;
  existing: ExistingJalonRow[];
  templates: TemplateRow[];
  csvText: string;
};

/**
 * Pure dry-run: no DB writes.
 * Validates CSV format + métier, simulates template if empty, merges rows.
 */
export function buildPlanningPreview(
  input: BuildPlanningPreviewInput
): PlanningPreviewReport {
  const {
    chantierId,
    chantierCode,
    chantierNom,
    dateDebut,
    dateFin,
    existing,
    templates,
    csvText,
  } = input;

  const willApplyTemplate = existing.length === 0;
  const formatErrors: string[] = [];
  const fingerprint = buildPlanningFingerprint(existing, willApplyTemplate);

  const emptyReport = (
    rows: PlanningPreviewRow[] = [],
    extraFormat: string[] = []
  ): PlanningPreviewReport => ({
    chantierId,
    chantierCode,
    chantierNom,
    dateDebut: formatDateYmd(dateDebut),
    dateFin: formatDateYmd(dateFin),
    existingJalonCount: existing.length,
    willApplyTemplate,
    templateJalonCount: willApplyTemplate ? templates.length : 0,
    total: rows.length,
    createCount: rows.filter((r) => r.action === "CREATE").length,
    updateCount: rows.filter((r) => r.action === "UPDATE").length,
    skipCount: rows.filter((r) => r.action === "SKIP").length,
    errorCount: rows.filter((r) => r.action === "ERROR").length,
    rows,
    fingerprint,
    formatErrors: [...formatErrors, ...extraFormat],
  });

  if (!csvText?.trim()) {
    formatErrors.push("Fichier CSV vide");
    return emptyReport();
  }
  if (csvText.length > 2_000_000) {
    formatErrors.push("Fichier trop volumineux (max. ~2 Mo)");
    return emptyReport();
  }

  const parsed = parseCsv(csvText);
  if (parsed.headers.length === 0) {
    formatErrors.push("En-têtes CSV introuvables");
    return emptyReport();
  }

  const map = colMap(parsed.headers);
  const requiredHeaders = ["phase", "nom"];
  for (const h of requiredHeaders) {
    if (!map.has(h)) {
      formatErrors.push(`Colonne obligatoire manquante : ${h}`);
    }
  }
  // Prefer pipe; warn if we only got one column and header has no |
  if (parsed.headers.length === 1 && !parsed.headers[0].includes("|")) {
    formatErrors.push(
      `Séparateur attendu « ${CSV_SEPARATOR} » (pipe). Vérifiez le format du fichier.`
    );
  }
  if (formatErrors.length > 0) {
    return emptyReport();
  }

  // Base index: existing or virtual template
  const baseMap = new Map<string, JalonSnapshot>();
  if (willApplyTemplate) {
    for (const t of templates) {
      const snap = snapshotFromTemplate(t, dateDebut, dateFin);
      baseMap.set(normalizeJalonKey(snap.phase, snap.nom), snap);
    }
  } else {
    for (const j of existing) {
      const snap = snapshotFromExisting(j);
      baseMap.set(normalizeJalonKey(snap.phase, snap.nom), snap);
    }
  }

  // Detect duplicate keys in file
  const fileKeys = new Map<string, number>(); // key → first line
  const previewRows: PlanningPreviewRow[] = [];

  parsed.rows.forEach((rawRow, idx) => {
    const line = idx + 2; // 1-based + header
    // Skip fully empty rows
    if (rawRow.every((c) => !String(c ?? "").trim())) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    const rowChantierCode = cell(rawRow, map, "chantier_code");
    const phaseRaw = cell(rawRow, map, "phase");
    const phase = phaseRaw ? canonicalPhase(phaseRaw) : "";
    const nom = cell(rawRow, map, "nom").normalize("NFC");
    const ordreRaw = cell(rawRow, map, "ordre");
    const dateCibleRaw = cell(rawRow, map, "date_cible");
    const dateReelleRaw = cell(rawRow, map, "date_reelle");
    const statutRaw = cell(rawRow, map, "statut");
    const description = cell(rawRow, map, "description");
    const livrables = cell(rawRow, map, "livrables");
    const commentaire = cell(rawRow, map, "commentaire");

    const display: Record<string, string> = {
      chantier_code: rowChantierCode,
      phase,
      nom,
      ordre: ordreRaw,
      date_cible: dateCibleRaw,
      date_reelle: dateReelleRaw,
      statut: statutRaw,
      description,
      livrables,
      commentaire,
    };

    if (rowChantierCode && rowChantierCode.toUpperCase() !== chantierCode.toUpperCase()) {
      errors.push(
        `chantier_code « ${rowChantierCode} » ≠ chantier sélectionné « ${chantierCode} »`
      );
    }
    if (!phase) errors.push("phase obligatoire");
    else if (!isValidPhase(phase)) {
      errors.push(
        `phase invalide « ${phase} » (attendu : ${PHASES.join(", ")})`
      );
    }
    if (!nom) errors.push("nom obligatoire");

    let ordre: number | null = null;
    if (ordreRaw) {
      const n = Number(ordreRaw);
      if (!Number.isInteger(n) || n < 0) {
        errors.push(`ordre invalide « ${ordreRaw} »`);
      } else {
        ordre = n;
      }
    }

    const dateCibleParsed = parsePlanningDate(dateCibleRaw);
    if (!dateCibleParsed.ok) errors.push(dateCibleParsed.error);
    const dateReelleParsed = parsePlanningDate(dateReelleRaw);
    if (!dateReelleParsed.ok) errors.push(dateReelleParsed.error);

    let statut = statutRaw;
    if (statut && !isValidStatut(statut)) {
      errors.push(
        `statut invalide « ${statut} » (attendu : ${STATUT_JALON_LIST.join(", ")})`
      );
    }

    // Date range warnings
    if (dateCibleParsed.ok && dateCibleParsed.value) {
      const dc = ymdToUtcDate(dateCibleParsed.value);
      const start = new Date(
        Date.UTC(
          dateDebut.getUTCFullYear(),
          dateDebut.getUTCMonth(),
          dateDebut.getUTCDate()
        )
      );
      const end = new Date(
        Date.UTC(
          dateFin.getUTCFullYear(),
          dateFin.getUTCMonth(),
          dateFin.getUTCDate()
        )
      );
      // Compare using local-ish: use date parts from chantier dates
      const chStart = formatDateYmd(dateDebut);
      const chEnd = formatDateYmd(dateFin);
      if (dateCibleParsed.value < chStart || dateCibleParsed.value > chEnd) {
        warnings.push(
          `date_cible hors plage chantier (${formatCsvDate(chStart)} → ${formatCsvDate(chEnd)})`
        );
      }
      void dc;
      void start;
      void end;
    }

    const key =
      phase && nom ? normalizeJalonKey(phase, nom) : `line-${line}`;
    if (phase && nom) {
      const first = fileKeys.get(key);
      if (first !== undefined) {
        errors.push(
          `Doublon dans le fichier (même phase+nom que la ligne ${first})`
        );
      } else {
        fileKeys.set(key, line);
      }
    }

    if (errors.length > 0) {
      previewRows.push({
        line,
        action: "ERROR",
        errors,
        warnings,
        phase,
        nom,
        display,
        changes: [],
      });
      return;
    }

    const existingSnap = baseMap.get(key);

    if (!existingSnap) {
      // CREATE
      if (!dateCibleParsed.ok || !dateCibleParsed.value) {
        previewRows.push({
          line,
          action: "ERROR",
          errors: ["date_cible obligatoire pour créer un jalon"],
          warnings,
          phase,
          nom,
          display,
          changes: [],
        });
        return;
      }
      const createOrdre =
        ordre ??
        maxOrdreInPhase(baseMap, phase) + 1;
      const createStatut = statut || "Planifié";
      const dateReelle =
        dateReelleParsed.ok && dateReelleParsed.value
          ? dateReelleParsed.value
          : null;

      // Register so later rows can see it for ordre / dup logic
      baseMap.set(key, {
        id: null,
        phase,
        nom,
        ordre: createOrdre,
        date_cible: dateCibleParsed.value,
        date_reelle: dateReelle ?? "",
        statut: createStatut,
        description,
        livrables,
        commentaire,
      });

      previewRows.push({
        line,
        action: "CREATE",
        errors: [],
        warnings,
        phase,
        nom,
        display: {
          ...display,
          ordre: String(createOrdre),
          date_cible: displayDate(dateCibleParsed.value),
          date_reelle: dateReelle ? displayDate(dateReelle) : "",
          statut: createStatut,
        },
        changes: [
          {
            field: "date_cible",
            from: "—",
            to: displayDate(dateCibleParsed.value),
          },
          { field: "statut", from: "—", to: createStatut },
        ],
        apply: {
          kind: "CREATE",
          phase,
          nom,
          ordre: createOrdre,
          date_cible: dateCibleParsed.value,
          date_reelle: dateReelle,
          statut: createStatut,
          description,
          livrables,
          commentaire,
        },
      });
      return;
    }

    // UPDATE or SKIP against existing / virtual template
    const changes: PlanningFieldChange[] = [];
    const updateData: Extract<PlanningApplyOp, { kind: "UPDATE" }>["data"] =
      {};

    if (dateCibleParsed.ok && dateCibleParsed.value) {
      if (dateCibleParsed.value !== existingSnap.date_cible) {
        changes.push({
          field: "date_cible",
          from: displayDate(existingSnap.date_cible || "—"),
          to: displayDate(dateCibleParsed.value),
        });
        updateData.date_cible = dateCibleParsed.value;
      }
    }

    if (dateReelleRaw !== "") {
      // Explicit value (including desire to set)
      if (dateReelleParsed.ok) {
        const next = dateReelleParsed.value ?? "";
        if (next !== existingSnap.date_reelle) {
          changes.push({
            field: "date_reelle",
            from: displayDate(existingSnap.date_reelle || "—"),
            to: next ? displayDate(next) : "—",
          });
          if (next) {
            updateData.date_reelle = next;
          } else {
            updateData.clear_date_reelle = true;
            updateData.date_reelle = null;
          }
        }
      }
    }

    if (statut) {
      if (statut !== existingSnap.statut) {
        changes.push({
          field: "statut",
          from: existingSnap.statut,
          to: statut,
        });
        updateData.statut = statut;
      }
    }

    if (ordre !== null && ordre !== existingSnap.ordre) {
      changes.push({
        field: "ordre",
        from: String(existingSnap.ordre),
        to: String(ordre),
      });
      updateData.ordre = ordre;
    }

    // Text fields: non-empty cell overwrites
    if (description !== "" && description !== existingSnap.description) {
      changes.push({
        field: "description",
        from: existingSnap.description || "—",
        to: description,
      });
      updateData.description = description;
    }
    if (livrables !== "" && livrables !== existingSnap.livrables) {
      changes.push({
        field: "livrables",
        from: existingSnap.livrables || "—",
        to: livrables,
      });
      updateData.livrables = livrables;
    }
    if (commentaire !== "" && commentaire !== existingSnap.commentaire) {
      changes.push({
        field: "commentaire",
        from: existingSnap.commentaire || "—",
        to: commentaire,
      });
      updateData.commentaire = commentaire;
    }

    // Mutate base for subsequent consistency
    if (updateData.date_cible) existingSnap.date_cible = updateData.date_cible;
    if (updateData.date_reelle !== undefined) {
      existingSnap.date_reelle = updateData.date_reelle ?? "";
    }
    if (updateData.clear_date_reelle) existingSnap.date_reelle = "";
    if (updateData.statut) existingSnap.statut = updateData.statut;
    if (updateData.ordre !== undefined) existingSnap.ordre = updateData.ordre;
    if (updateData.description !== undefined)
      existingSnap.description = updateData.description;
    if (updateData.livrables !== undefined)
      existingSnap.livrables = updateData.livrables;
    if (updateData.commentaire !== undefined)
      existingSnap.commentaire = updateData.commentaire;

    // Template virtual row (cas 1) → always CREATE (never SKIP/UPDATE)
    if (existingSnap.id === null) {
      const finalDate =
        updateData.date_cible ?? existingSnap.date_cible;
      if (!finalDate) {
        previewRows.push({
          line,
          action: "ERROR",
          errors: ["date_cible manquante après merge template"],
          warnings,
          phase,
          nom,
          display,
          changes: [],
        });
        return;
      }
      const createChanges =
        changes.length > 0
          ? changes
          : [
              {
                field: "date_cible",
                from: "—",
                to: displayDate(finalDate),
              },
              { field: "source", from: "—", to: "template (inchangé vs défaut)" },
            ];
      previewRows.push({
        line,
        action: "CREATE",
        errors: [],
        warnings: [
          ...warnings,
          willApplyTemplate
            ? changes.length > 0
              ? "Issu du template (valeurs fusionnées avec le fichier)"
              : "Issu du template (dates par défaut)"
            : "",
        ].filter(Boolean),
        phase,
        nom,
        display: {
          ...display,
          date_cible: displayDate(finalDate),
          ordre: String(updateData.ordre ?? existingSnap.ordre),
          statut: updateData.statut ?? existingSnap.statut,
        },
        changes: createChanges,
        apply: {
          kind: "CREATE",
          phase,
          nom,
          ordre: updateData.ordre ?? existingSnap.ordre,
          date_cible: finalDate,
          date_reelle: updateData.clear_date_reelle
            ? null
            : updateData.date_reelle !== undefined
              ? updateData.date_reelle
              : existingSnap.date_reelle || null,
          statut: updateData.statut ?? existingSnap.statut,
          description: updateData.description ?? existingSnap.description,
          livrables: updateData.livrables ?? existingSnap.livrables,
          commentaire: updateData.commentaire ?? existingSnap.commentaire,
        },
      });
      return;
    }

    if (changes.length === 0) {
      previewRows.push({
        line,
        action: "SKIP",
        errors: [],
        warnings,
        phase,
        nom,
        display,
        changes: [],
      });
      return;
    }

    previewRows.push({
      line,
      action: "UPDATE",
      errors: [],
      warnings,
      phase,
      nom,
      display,
      changes,
      apply: {
        kind: "UPDATE",
        id: existingSnap.id,
        phase,
        nom,
        data: updateData,
      },
    });
  });

  // Case 1: template rows not mentioned in file → still CREATE with template defaults
  if (willApplyTemplate) {
    const mentioned = new Set(
      previewRows
        .filter((r) => r.action !== "ERROR" && r.phase && r.nom)
        .map((r) => normalizeJalonKey(r.phase, r.nom))
    );
    // Also track ERROR keys so we don't double-create
    for (const t of templates) {
      const key = normalizeJalonKey(t.phase, t.nom);
      if (mentioned.has(key)) continue;
      // Already added via CREATE path if file mentioned it
      const alreadyInPreview = previewRows.some(
        (r) =>
          r.action === "CREATE" &&
          normalizeJalonKey(r.phase, r.nom) === key
      );
      if (alreadyInPreview) continue;

      const snap = snapshotFromTemplate(t, dateDebut, dateFin);
      // Only add implicit template creates once — as synthetic lines (line 0)
      previewRows.push({
        line: 0,
        action: "CREATE",
        errors: [],
        warnings: ["Template (non présent dans le fichier)"],
        phase: snap.phase,
        nom: snap.nom,
        display: {
          chantier_code: chantierCode,
          phase: snap.phase,
          nom: snap.nom,
          ordre: String(snap.ordre),
          date_cible: displayDate(snap.date_cible),
          date_reelle: "",
          statut: snap.statut,
          description: "",
          livrables: "",
          commentaire: "",
        },
        changes: [
          { field: "date_cible", from: "—", to: displayDate(snap.date_cible) },
          { field: "source", from: "—", to: "template" },
        ],
        apply: {
          kind: "CREATE",
          phase: snap.phase,
          nom: snap.nom,
          ordre: snap.ordre,
          date_cible: snap.date_cible,
          date_reelle: null,
          statut: "Planifié",
          description: "",
          livrables: "",
          commentaire: "",
        },
      });
    }
  }

  // Sort: file lines first, then template extras; errors mixed by line
  previewRows.sort((a, b) => {
    if (a.line === 0 && b.line !== 0) return 1;
    if (b.line === 0 && a.line !== 0) return -1;
    return a.line - b.line || a.nom.localeCompare(b.nom, "fr");
  });

  return emptyReport(previewRows);
}

function maxOrdreInPhase(
  baseMap: Map<string, JalonSnapshot>,
  phase: string
): number {
  let max = 0;
  for (const snap of baseMap.values()) {
    if (normalizeText(snap.phase) === normalizeText(phase)) {
      if (snap.ordre > max) max = snap.ordre;
    }
  }
  return max;
}

/** Default templates if DB empty */
export function fallbackTemplates(): TemplateRow[] {
  return JALON_TEMPLATES.map((t) => ({
    phase: t.phase,
    nom: t.nom,
    ordre: t.ordre,
    offsetPct: t.offsetPct,
  }));
}
