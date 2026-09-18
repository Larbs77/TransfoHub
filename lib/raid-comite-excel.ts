import ExcelJS from "exceljs";
import {
  RAID_TYPES,
  RAID_TYPE_LABELS,
  getStatutsForType,
  getStatutsFromConfig,
  actionRequiresEcheance,
  raidRisqueSaisieError,
  PROBABILITE_LABELS,
  IMPACT_LABELS,
  NIVEAU_MAITRISE_VALUES,
  STRATEGIE_LIST,
  CATEGORIE_LIST,
  DOMAINE_LIST,
  getLabelsForKind,
  type StatusConfigItem,
  type RaidFieldOptionItem,
} from "@/lib/raid-labels";

export const RAID_COMITE_CANEVAS_SHEET = "RAID";

export const RAID_COMITE_CANEVAS_HEADERS = [
  "Type",
  "Libellé",
  "Description",
  "Catégorie",
  "Domaine",
  "Statut",
  "Code chantier",
  "Responsable",
  "Probabilité",
  "Impact",
  "Niveau de maîtrise",
  "Stratégie",
  "Mitigation",
  "Date révision",
  "Échéance initiale",
] as const;

export type RaidComiteCanevasHeader =
  (typeof RAID_COMITE_CANEVAS_HEADERS)[number];

export type RaidComiteParsedRow = {
  excelRow: number;
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  domaine: string;
  statut: string;
  chantierCode: string;
  responsable: string;
  probabiliteRaw: string;
  impactRaw: string;
  niveau_maitrise: string;
  strategie: string;
  mitigation: string;
  date_revision: string | null;
  date_echeance: string | null;
};

export type RaidComitePreviewLine = {
  excelRow: number;
  ok: boolean;
  errors: string[];
  type: string;
  intitule: string;
  statut: string;
};

export type RaidComiteCreatePayload = {
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  domaine: string;
  statut: string;
  chantierId: string | null;
  responsable: string;
  responsableRessourceId: string | null;
  probabilite: number | null;
  impact: number | null;
  niveau_maitrise: string;
  strategie: string;
  mitigation: string;
  date_identification: string;
  date_revision: string | null;
  date_echeance: string | null;
  commentaires: string;
  comiteId: string;
};

const HEADER_INDEX: Record<string, number> = Object.fromEntries(
  RAID_COMITE_CANEVAS_HEADERS.map((h, i) => [normalizeHeader(h), i])
);

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cellText(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) return "";
  if (typeof value === "object" && value && "text" in (value as object)) {
    return String((value as { text: string }).text ?? "").trim();
  }
  if (typeof value === "object" && value && "richText" in (value as object)) {
    const rich = (value as { richText: Array<{ text?: string }> }).richText;
    return rich.map((p) => p.text ?? "").join("").trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

function excelDateToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + value * 86400000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = cellText(value);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (fr) {
    const d = fr[1].padStart(2, "0");
    const m = fr[2].padStart(2, "0");
    return `${fr[3]}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function parseRaidType(raw: string): string | null {
  const k = normKey(raw);
  if (!k) return null;
  for (const t of RAID_TYPES) {
    if (normKey(t) === k) return t;
    if (normKey(RAID_TYPE_LABELS[t] ?? "") === k) return t;
  }
  if (k === "decision") return "Décision";
  if (k === "risque" || k === "risk") return "Risque";
  return null;
}

export function parseScaleLabel(
  raw: string,
  labels: Record<number, string>
): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^[123]$/.test(s)) return Number(s);
  const k = normKey(s);
  for (const [n, label] of Object.entries(labels)) {
    if (normKey(label) === k) return Number(n);
  }
  return null;
}

function matchCatalog(raw: string, catalog: readonly string[]): string | null {
  const s = raw.trim();
  if (!s) return "";
  const k = normKey(s);
  const found = catalog.find((c) => normKey(c) === k);
  return found ?? null;
}

export function parseCanevasWorkbook(
  workbook: ExcelJS.Workbook
): { rows: RaidComiteParsedRow[]; fileError?: string } {
  const sheet =
    workbook.getWorksheet(RAID_COMITE_CANEVAS_SHEET) ?? workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], fileError: "Le fichier Excel ne contient aucune feuille." };
  }
  const headerRow = sheet.getRow(1);
  const colMap: Partial<Record<RaidComiteCanevasHeader, number>> = {};
  headerRow.eachCell((cell, col) => {
    const key = normalizeHeader(cellText(cell.value));
    const idx = HEADER_INDEX[key];
    if (idx != null) {
      colMap[RAID_COMITE_CANEVAS_HEADERS[idx]] = col;
    }
  });
  if (colMap.Type == null || colMap["Libellé"] == null) {
    return {
      rows: [],
      fileError:
        "Canevas invalide : colonnes « Type » et « Libellé » obligatoires (téléchargez le modèle).",
    };
  }

  const rows: RaidComiteParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (h: RaidComiteCanevasHeader) => {
      const col = colMap[h];
      if (!col) return "";
      return cellText(row.getCell(col).value);
    };
    const getDate = (h: RaidComiteCanevasHeader) => {
      const col = colMap[h];
      if (!col) return null;
      return excelDateToIso(row.getCell(col).value);
    };
    const type = get("Type");
    const intitule = get("Libellé");
    const description = get("Description");
    if (!type && !intitule && !description) return;
    rows.push({
      excelRow: rowNumber,
      type,
      intitule,
      description,
      categorie: get("Catégorie"),
      domaine: get("Domaine"),
      statut: get("Statut"),
      chantierCode: get("Code chantier"),
      responsable: get("Responsable"),
      probabiliteRaw: get("Probabilité"),
      impactRaw: get("Impact"),
      niveau_maitrise: get("Niveau de maîtrise"),
      strategie: get("Stratégie"),
      mitigation: get("Mitigation"),
      date_revision: getDate("Date révision"),
      date_echeance: getDate("Échéance initiale"),
    });
  });
  return { rows };
}

export function validateCanevasRow(
  row: RaidComiteParsedRow,
  ctx: {
    comiteChantierId: string | null;
    comiteDateIso: string;
    statutsByType: Record<string, string[]>;
    categories: string[];
    domaines: string[];
    chantiersByCode: Map<string, { id: string; code: string }>;
    ressources: Array<{ id: string; nom_complet: string; email: string }>;
  }
): { ok: boolean; errors: string[]; payload?: RaidComiteCreatePayload } {
  const errors: string[] = [];
  const type = parseRaidType(row.type);
  if (!type) {
    errors.push("Type obligatoire (Action, Risque, Information ou Décision).");
  }
  const intitule = row.intitule.trim();
  if (!intitule) errors.push("Libellé obligatoire.");

  const statutRaw = row.statut.trim();
  if (!statutRaw) errors.push("Statut obligatoire.");
  let statut = statutRaw;
  if (type && statutRaw) {
    const allowed = ctx.statutsByType[type] ?? [...getStatutsForType(type)];
    const matched = allowed.find((s) => normKey(s) === normKey(statutRaw));
    if (!matched) {
      errors.push(
        `Statut « ${statutRaw} » invalide pour un ${type} (${allowed.join(", ")}).`
      );
    } else {
      statut = matched;
    }
  }

  if (row.categorie.trim()) {
    const cat = matchCatalog(row.categorie, ctx.categories);
    if (!cat) {
      errors.push(`Catégorie « ${row.categorie.trim()} » inconnue.`);
    }
  }
  if (row.domaine.trim()) {
    const dom = matchCatalog(row.domaine, ctx.domaines);
    if (!dom) {
      errors.push(`Domaine « ${row.domaine.trim()} » inconnu.`);
    }
  }

  let chantierId = ctx.comiteChantierId;
  const codeCh = row.chantierCode.trim();
  if (ctx.comiteChantierId) {
    if (codeCh) {
      const ch = ctx.chantiersByCode.get(normKey(codeCh));
      if (ch && ch.id !== ctx.comiteChantierId) {
        errors.push(
          "Le comité est opérationnel : le chantier est imposé par la séance (ne pas renseigner un autre code chantier)."
        );
      } else if (!ch) {
        errors.push(`Code chantier « ${codeCh} » introuvable.`);
      }
    }
  } else if (codeCh) {
    const ch = ctx.chantiersByCode.get(normKey(codeCh));
    if (!ch) errors.push(`Code chantier « ${codeCh} » introuvable.`);
    else chantierId = ch.id;
  }

  let responsableRessourceId: string | null = null;
  let responsable = row.responsable.trim();
  if (responsable) {
    const k = normKey(responsable);
    const res = ctx.ressources.find(
      (r) =>
        normKey(r.nom_complet) === k ||
        (r.email && normKey(r.email) === k)
    );
    if (!res) {
      errors.push(
        `Responsable « ${responsable} » introuvable dans le référentiel Ressources.`
      );
    } else {
      responsableRessourceId = res.id;
      responsable = res.nom_complet;
    }
  }

  let probabilite: number | null = null;
  let impact: number | null = null;
  if (row.probabiliteRaw.trim()) {
    probabilite = parseScaleLabel(row.probabiliteRaw, PROBABILITE_LABELS);
    if (probabilite == null) {
      errors.push("Probabilité invalide (Faible, Moyenne, Élevée ou 1–3).");
    }
  }
  if (row.impactRaw.trim()) {
    impact = parseScaleLabel(row.impactRaw, IMPACT_LABELS);
    if (impact == null) {
      errors.push("Impact invalide (Faible, Moyen, Élevé ou 1–3).");
    }
  }

  let maitrise = row.niveau_maitrise.trim();
  if (maitrise) {
    const m = matchCatalog(maitrise, NIVEAU_MAITRISE_VALUES);
    if (!m) {
      errors.push("Niveau de maîtrise invalide (Élevé, Modéré, Faible).");
    } else {
      maitrise = m;
    }
  }

  if (row.strategie.trim()) {
    const st = matchCatalog(row.strategie, STRATEGIE_LIST);
    if (!st) {
      errors.push(
        `Stratégie « ${row.strategie.trim()} » invalide (${STRATEGIE_LIST.join(", ")}).`
      );
    }
  }

  const risqueErr = type
    ? raidRisqueSaisieError({
        type,
        probabilite,
        impact,
        niveau_maitrise: maitrise || null,
      })
    : null;
  if (risqueErr) errors.push(risqueErr);

  if (type === "Action" && statut && actionRequiresEcheance(statut) && !row.date_echeance) {
    errors.push(
      "Une date d'échéance est obligatoire dès que l'action n'est plus « A planifier »."
    );
  }

  if (errors.length || !type) {
    return { ok: false, errors };
  }

  const categorie =
    matchCatalog(row.categorie, ctx.categories) || row.categorie.trim();
  const domaine = matchCatalog(row.domaine, ctx.domaines) || row.domaine.trim();
  const strategie = matchCatalog(row.strategie, STRATEGIE_LIST) || row.strategie.trim();

  return {
    ok: true,
    errors: [],
    payload: {
      type,
      intitule,
      description: row.description.trim(),
      categorie: categorie || "",
      domaine: domaine || "",
      statut,
      chantierId,
      responsable,
      responsableRessourceId,
      probabilite,
      impact,
      niveau_maitrise: maitrise,
      strategie,
      mitigation: row.mitigation.trim(),
      date_identification: ctx.comiteDateIso,
      date_revision: row.date_revision,
      date_echeance: row.date_echeance,
      commentaires: "",
      comiteId: "",
    },
  };
}

export async function buildRaidComiteCanevasBase64(opts: {
  categories: string[];
  domaines: string[];
  comiteLabel: string;
}): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TransfoHub";
  wb.created = new Date();

  const guide = wb.addWorksheet("Guide");
  guide.columns = [{ width: 28 }, { width: 88 }];
  guide.addRow(["Canevas import RAID — comité"]);
  guide.getRow(1).font = { bold: true, size: 14, color: { argb: "FF0A3C74" } };
  guide.addRow([]);
  guide.addRow([
    "Usage",
    `Remplir la feuille « RAID » puis importer depuis la séance ${opts.comiteLabel}. Création uniquement — pas de mise à jour.`,
  ]);
  guide.addRow([
    "Rattachement",
    "Chaque ligne est rattachée au comité ouvert. Date d'identification = date de la séance. Créateur = utilisateur connecté.",
  ]);
  guide.addRow(["Type", RAID_TYPES.join(" / ")]);
  guide.addRow(["Statut", "Doit correspondre au type (listes Paramètres / défaut métier)."]);
  guide.addRow([
    "Risque",
    "Probabilité, Impact et Niveau de maîtrise obligatoires (Faible / Moyenne|Moyen / Élevée|Élevé — maîtrise : Élevé, Modéré, Faible).",
  ]);
  guide.addRow([
    "Action",
    "Échéance initiale obligatoire dès que le statut n'est plus « A planifier ».",
  ]);
  guide.addRow([
    "Code chantier",
    "Inutile si le comité est opérationnel (chantier de la séance). Sinon code existant (ex. CH_023).",
  ]);
  guide.addRow([
    "Responsable",
    "Nom complet ou e-mail d'une ressource TransfoHub. Laisser vide si non assigné.",
  ]);
  guide.addRow(["Dates", "JJ/MM/AAAA"]);
  guide.addRow([
    "Chargement",
    "Toutes les lignes doivent être valides. Sinon rien n'est créé.",
  ]);

  const sheet = wb.addWorksheet(RAID_COMITE_CANEVAS_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = RAID_COMITE_CANEVAS_HEADERS.map((header) => ({
    header,
    width: header === "Libellé" || header === "Description" || header === "Mitigation" ? 36 : 18,
  }));
  const headerRow = sheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0A3C74" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  const example = sheet.addRow([
    "Action",
    "Exemple — à supprimer avant import",
    "Description courte",
    opts.categories[0] ?? "",
    opts.domaines[0] ?? "",
    "A planifier",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  example.font = { italic: true, color: { argb: "FF64748B" } };

  const lists = wb.addWorksheet("Listes");
  const typeCol = RAID_TYPES.map((t) => [t]);
  typeCol.forEach((v, i) => {
    lists.getCell(i + 1, 1).value = v[0];
  });
  NIVEAU_MAITRISE_VALUES.forEach((v, i) => {
    lists.getCell(i + 1, 2).value = v;
  });
  Object.values(PROBABILITE_LABELS).forEach((v, i) => {
    lists.getCell(i + 1, 3).value = v;
  });
  Object.values(IMPACT_LABELS).forEach((v, i) => {
    lists.getCell(i + 1, 4).value = v;
  });
  STRATEGIE_LIST.forEach((v, i) => {
    lists.getCell(i + 1, 5).value = v;
  });
  opts.categories.forEach((v, i) => {
    lists.getCell(i + 1, 6).value = v;
  });
  opts.domaines.forEach((v, i) => {
    lists.getCell(i + 1, 7).value = v;
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}

