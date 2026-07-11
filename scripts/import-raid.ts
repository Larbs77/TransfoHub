import { createPrismaClient } from "../lib/create-prisma";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = createPrismaClient();

function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val === "number") {
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (val instanceof Date) return val;
  return null;
}

function str(val: any): string {
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

function num(val: any): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = parseInt(String(val));
  return isNaN(n) ? null : n;
}

async function main() {
  const filePath = path.join(__dirname, "..", "Data", "RAID.xlsx");
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets["RAID"];

  if (!sheet) {
    console.error("Sheet 'RAID' not found");
    process.exit(1);
  }

  // Headers at row 14 (0-indexed range: 13)
  const rawData = XLSX.utils.sheet_to_json(sheet, { range: 13 }) as any[];

  console.log(`Found ${rawData.length} rows in RAID sheet`);

  let imported = 0;
  let skipped = 0;

  for (const row of rawData) {
    const type = str(row["Type"]);
    const intitule = str(row["Intitulé"]);

    if (!type || !intitule) {
      skipped++;
      continue;
    }

    // Find column keys (may have trailing spaces)
    const descKey = Object.keys(row).find(k => k.trim() === "Description") ?? "Description";
    const catKey = Object.keys(row).find(k => k.trim() === "Catégorie") ?? "Catégorie";
    const stratKey = Object.keys(row).find(k => k.trim() === "Stratégie") ?? "Stratégie";
    const mitKey = Object.keys(row).find(k => k.trim() === "Mitigation") ?? "Mitigation";
    const statKey = Object.keys(row).find(k => k.trim() === "Statut") ?? "Statut";
    const dateIdentKey = Object.keys(row).find(k => k.trim() === "Date_Ident.") ?? "Date_Ident.";
    const dateRevKey = Object.keys(row).find(k => k.trim() === "Date_Rev.") ?? "Date_Rev.";
    const commKey = Object.keys(row).find(k => k.trim() === "Commentaires") ?? "Commentaires";

    await prisma.raid.create({
      data: {
        type,
        intitule,
        description: str(row[descKey]),
        categorie: str(row[catKey]),
        domaine: str(row["Domaine"]),
        probabilite: num(row["Probabilité"]),
        impact: num(row["Impact"]),
        strategie: str(row[stratKey]),
        mitigation: str(row[mitKey]),
        responsable: str(row["Responsable"]),
        statut: str(row[statKey]),
        date_identification: parseExcelDate(row[dateIdentKey]),
        date_revision: parseExcelDate(row[dateRevKey]),
        commentaires: str(row[commKey]),
      },
    });
    imported++;
  }

  console.log(`Import terminé: ${imported} éléments importés, ${skipped} ignorés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
