import {
  buildExcelPlanningPreview,
  buildPlanningWorkbookBase64,
  type ExcelTemplateNode,
} from "../lib/jalon-planning-excel";
import ExcelJS from "exceljs";

async function main() {
const start = new Date(Date.UTC(2026, 0, 1));
const nodes: ExcelTemplateNode[] = [
  { id: "", level: "JALON", parentId: null, phase: "Cadrage", jalon: "Jalon test", workstream: "", activite: "", ordre: 1, dateDebut: start, dateFin: new Date(Date.UTC(2026, 1, 1)), dateReelle: null, statut: "Planifié", description: "", livrables: "", commentaire: "" },
  { id: "", level: "WORKSTREAM", parentId: null, phase: "Cadrage", jalon: "Jalon test", workstream: "WS test", activite: "", ordre: 1, dateDebut: start, dateFin: new Date(Date.UTC(2026, 0, 20)), dateReelle: null, statut: "Planifié", description: "", livrables: "", commentaire: "" },
  { id: "", level: "ACTIVITE", parentId: null, phase: "Cadrage", jalon: "Jalon test", workstream: "WS test", activite: "Activité test", ordre: 1, dateDebut: start, dateFin: new Date(Date.UTC(2026, 0, 10)), dateReelle: null, statut: "Planifié", description: "", livrables: "", commentaire: "" },
];

const base64 = await buildPlanningWorkbookBase64({ chantierCode: "CH_TEST", chantierNom: "Test", nodes });
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(Buffer.from(base64, "base64") as unknown as Parameters<typeof workbook.xlsx.load>[0]);
const planningSheet = workbook.getWorksheet("Planning");
if (!planningSheet) throw new Error("Onglet Planning absent");
if (planningSheet.getCell("A2").value !== "Jalon" || planningSheet.getCell("A3").value !== "Workstream" || planningSheet.getCell("A4").value !== "Activité") {
  throw new Error("Ordre hiérarchique Excel invalide");
}
if (planningSheet.getCell("A2").dataValidation.type !== "list" || planningSheet.getCell("B2").dataValidation.type !== "list" || planningSheet.getCell("H2").dataValidation.type !== "list") {
  throw new Error("Listes déroulantes Excel absentes");
}
if (!planningSheet.getColumn(12).hidden || planningSheet.getCell("A2").fill.type !== "pattern") {
  throw new Error("Mise en forme ou colonne technique Excel invalide");
}
const preview = buildExcelPlanningPreview({ chantierId: "test", chantierCode: "CH_TEST", chantierNom: "Test", chantierStart: start, chantierEnd: new Date(Date.UTC(2026, 11, 31)), base64, existing: [] });

if (preview.total !== 3 || preview.createCount !== 3 || preview.errorCount !== 0) {
  throw new Error(`Round-trip Excel invalide: ${JSON.stringify(preview)}`);
}

const updatedAt = new Date(Date.UTC(2026, 0, 1));
const existing = [
  {...nodes[0], id:"j1", updatedAt},
  {...nodes[0], id:"j2", jalon:"Jalon destination", ordre:2, updatedAt},
  {...nodes[1], id:"w1", parentId:"j1", updatedAt},
];
const moveBase64 = await buildPlanningWorkbookBase64({chantierCode:"CH_TEST",chantierNom:"Test",nodes:existing});
const movePreview = buildExcelPlanningPreview({chantierId:"test",chantierCode:"CH_TEST",chantierNom:"Test",chantierStart:start,chantierEnd:new Date(Date.UTC(2026,11,31)),base64:moveBase64,existing});
const movedWorkstream = movePreview.rows.find(row => row.label === "WS test");
if (movedWorkstream?.action !== "UPDATE" || movedWorkstream.apply?.parentRef !== "j2" || !movedWorkstream.changes.some(change => change.field === "rattachement")) {
  throw new Error("Déplacement séquentiel du workstream non détecté");
}
console.log(`OK — ${preview.createCount} créations, ${base64.length} caractères base64`);
}

void main();
