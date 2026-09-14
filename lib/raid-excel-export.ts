import ExcelJS from "exceljs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  IMPACT_LABELS,
  PROBABILITE_LABELS,
  RAID_TYPE_LABELS,
  evaluateRaidRisque,
} from "@/lib/raid-labels";
import { INSTANCE_LABELS } from "@/lib/comite-labels";

/** RAID row shape needed for Excel (comments excluded). */
export type RaidExcelSource = {
  id: string;
  code?: string | null;
  type: string;
  intitule: string;
  description?: string | null;
  categorie?: string | null;
  domaine?: string | null;
  statut?: string | null;
  responsable?: string | null;
  probabilite?: number | null;
  impact?: number | null;
  niveau_maitrise?: string | null;
  strategie?: string | null;
  mitigation?: string | null;
  date_identification?: Date | string | null;
  date_revision?: Date | string | null;
  date_echeance?: Date | string | null;
  date_echeance_actualisee?: Date | string | null;
  date_fin_reelle?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  chantier?: { code: string; nom: string } | null;
  comite?: { instance: string; numero: number; date?: Date | string | null } | null;
};

const HEADERS = [
  "Code",
  "Type",
  "Libellé",
  "Description",
  "Catégorie",
  "Domaine",
  "Statut",
  "Code chantier",
  "Chantier",
  "Responsable",
  "Comité",
  "Date comité",
  "Probabilité",
  "Impact",
  "Niveau de risque",
  "Niveau de maîtrise",
  "Criticité",
  "Stratégie",
  "Mitigation",
  "Date identification",
  "Date révision",
  "Échéance initiale",
  "Échéance actualisée",
  "Date fin réelle",
  "Créé le",
  "Mis à jour le",
] as const;

const WIDTHS = [12, 14, 42, 40, 22, 22, 16, 14, 32, 24, 22, 14, 18, 16, 18, 18, 16, 28, 28, 16, 14, 16, 16, 16, 16, 16];

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value: Date | string | null | undefined): string {
  const d = asDate(value);
  return d ? format(d, "dd/MM/yyyy", { locale: fr }) : "";
}

function comiteLabel(co: RaidExcelSource["comite"]): string {
  if (!co) return "";
  return `${INSTANCE_LABELS[co.instance] ?? co.instance} #${co.numero}`;
}

function toRow(r: RaidExcelSource): (string | number)[] {
  const { niveauRisque, criticite } = evaluateRaidRisque(r);
  const probLabel =
    r.probabilite != null
      ? PROBABILITE_LABELS[r.probabilite] ?? String(r.probabilite)
      : "";
  const impactLabel =
    r.impact != null
      ? IMPACT_LABELS[r.impact] ?? String(r.impact)
      : "";

  return [
    r.code ?? "",
    RAID_TYPE_LABELS[r.type] ?? r.type,
    r.intitule ?? "",
    r.description ?? "",
    r.categorie ?? "",
    r.domaine ?? "",
    r.statut ?? "",
    r.chantier?.code ?? "",
    r.chantier?.nom ?? "",
    r.responsable ?? "",
    comiteLabel(r.comite),
    fmtDate(r.comite?.date),
    probLabel,
    impactLabel,
    niveauRisque ?? "",
    r.niveau_maitrise?.trim() || "",
    criticite ?? "",
    r.strategie ?? "",
    r.mitigation ?? "",
    fmtDate(r.date_identification),
    fmtDate(r.date_revision),
    fmtDate(r.date_echeance),
    fmtDate(r.date_echeance_actualisee),
    fmtDate(r.date_fin_reelle),
    fmtDate(r.createdAt),
    fmtDate(r.updatedAt),
  ];
}

export async function buildRaidExcelBase64(rows: RaidExcelSource[]): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TransfoHub";
  wb.created = new Date();

  const sheet = wb.addWorksheet("RAID", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = HEADERS.map((header, i) => ({
    header,
    width: WIDTHS[i] ?? 16,
  }));
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: HEADERS.length },
  };

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

  for (const r of rows) {
    const excelRow = sheet.addRow(toRow(r));
    excelRow.alignment = { vertical: "middle", wrapText: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}

export function raidExcelFileName(
  kind: "all" | "selection" | "comite",
  slug?: string
): string {
  const stamp = format(new Date(), "yyyy-MM-dd");
  if (kind === "comite") {
    const safe = (slug ?? "comite")
      .replace(/[^\w#-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60);
    return `RAID_${safe || "comite"}_${stamp}.xlsx`;
  }
  return kind === "all"
    ? `RAID_complet_${stamp}.xlsx`
    : `RAID_selection_${stamp}.xlsx`;
}
