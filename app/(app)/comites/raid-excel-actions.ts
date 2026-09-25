"use server";

import ExcelJS from "exceljs";
import { format } from "date-fns";
import { requireAuth, requirePageWrite, requireRaidCreateAccess } from "@/lib/auth";
import { canDeleteRaid } from "@/lib/raid-collaboration";
import { prisma } from "@/lib/prisma";
import {
  assertCanManageComiteSeance,
  assertComiteSeanceActive,
} from "@/lib/comite-access";

import {
  getLabelsForKind,
  getStatutsForType,
  getStatutsFromConfig,
  RAID_TYPES,
} from "@/lib/raid-labels";
import {
  buildRaidComiteCanevasBase64,
  parseCanevasWorkbook,
  validateCanevasRow,
  type RaidComiteCreatePayload,
  type RaidComitePreviewLine,
} from "@/lib/raid-comite-excel";
import { createRaid } from "@/app/(app)/actions";
import { revalidatePath } from "next/cache";

const MAX_ROWS = 150;
const MAX_B64 = 8_000_000;

function comiteDateIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

async function loadComiteForImport(comiteId: string) {
  await requirePageWrite("/raid");
  const session = await requireAuth();
  const comite = await prisma.comite.findUnique({
    where: { id: comiteId },
    select: {
      id: true,
      instance: true,
      numero: true,
      date: true,
      chantierId: true,
      statut: true,
    },
  });
  if (!comite) throw new Error("Comité introuvable.");
  assertComiteSeanceActive(comite);
  const param = await prisma.comiteParametre.findUnique({
    where: { name: comite.instance },
    select: { niveau: true, short_label: true },
  });
  await assertCanManageComiteSeance(session, {
    niveau: param?.niveau ?? "gouvernance",
    chantierId: comite.chantierId,
  });
  await requireRaidCreateAccess(comite.chantierId);
  if (!(await canDeleteRaid(session))) {
    throw new Error(
      "Canevas et import Excel réservés aux rôles avec le périmètre « tous les chantiers »."
    );
  }
  return { session, comite, param };
}

async function catalogs() {
  const [options, statusConfigs, chantiers, ressources] = await Promise.all([
    prisma.raidFieldOption.findMany({
      orderBy: [{ kind: "asc" }, { position: "asc" }],
      select: { id: true, kind: true, label: true, color: true, position: true },
    }),
    prisma.statusConfig.findMany({
      orderBy: [{ type: "asc" }, { position: "asc" }],
    }),
    prisma.chantier.findMany({
      select: { id: true, code: true },
    }),
    prisma.ressource.findMany({
      select: { id: true, nom_complet: true, email: true },
    }),
  ]);
  const categories =
    getLabelsForKind("categorie", options).length > 0
      ? getLabelsForKind("categorie", options)
      : [];
  const domaines =
    getLabelsForKind("domaine", options).length > 0
      ? getLabelsForKind("domaine", options)
      : [];
  const statutsByType: Record<string, string[]> = {};
  for (const t of RAID_TYPES) {
    const fromDb = getStatutsFromConfig(t, statusConfigs);
    statutsByType[t] = fromDb.length ? fromDb : [...getStatutsForType(t)];
  }
  const chantiersByCode = new Map(
    chantiers.map((c) => [c.code.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase(), c])
  );
  return { options, categories, domaines, statutsByType, chantiersByCode, ressources };
}

function decodeBase64(raw: string): Buffer {
  const clean = raw.replace(/^data:.*?;base64,/, "").replace(/\s/g, "");
  if (!clean) throw new Error("Fichier vide.");
  if (clean.length > MAX_B64) throw new Error("Fichier trop volumineux (max. 5 Mo).");
  return Buffer.from(clean, "base64");
}

async function parseAndValidate(comiteId: string, fileBase64: string) {
  const { comite, param } = await loadComiteForImport(comiteId);
  const { categories, domaines, statutsByType, chantiersByCode, ressources } =
    await catalogs();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(decodeBase64(fileBase64) as unknown as ArrayBuffer);
  const parsed = parseCanevasWorkbook(wb);
  if (parsed.fileError) {
    return {
      comite,
      param,
      fileError: parsed.fileError,
      lines: [] as RaidComitePreviewLine[],
      payloads: [] as RaidComiteCreatePayload[],
      allOk: false,
    };
  }
  const dataRows = parsed.rows.filter(
    (r) => !r.intitule.toLowerCase().startsWith("exemple")
  );
  if (dataRows.length === 0) {
    return {
      comite,
      param,
      fileError: "Aucune ligne à importer (hors ligne d'exemple).",
      lines: [] as RaidComitePreviewLine[],
      payloads: [] as RaidComiteCreatePayload[],
      allOk: false,
    };
  }
  if (dataRows.length > MAX_ROWS) {
    return {
      comite,
      param,
      fileError: `Trop de lignes (${dataRows.length}). Maximum ${MAX_ROWS}.`,
      lines: [] as RaidComitePreviewLine[],
      payloads: [] as RaidComiteCreatePayload[],
      allOk: false,
    };
  }
  const dateIso = comiteDateIso(comite.date);
  const lines: RaidComitePreviewLine[] = [];
  const payloads: RaidComiteCreatePayload[] = [];
  for (const row of dataRows) {
    const result = validateCanevasRow(row, {
      comiteChantierId: comite.chantierId,
      comiteDateIso: dateIso,
      statutsByType,
      categories: categories.length ? categories : [row.categorie].filter(Boolean),
      domaines: domaines.length ? domaines : [row.domaine].filter(Boolean),
      chantiersByCode,
      ressources,
    });
    lines.push({
      excelRow: row.excelRow,
      ok: result.ok,
      errors: result.errors,
      type: result.payload?.type || row.type,
      intitule: result.payload?.intitule || row.intitule,
      statut: result.payload?.statut || row.statut,
    });
    if (result.payload) {
      payloads.push({ ...result.payload, comiteId: comite.id });
    }
  }
  const allOk = lines.length > 0 && lines.every((l) => l.ok);
  return { comite, param, fileError: undefined as string | undefined, lines, payloads, allOk };
}

export async function downloadRaidComiteCanevas(comiteId: string) {
  const { comite, param } = await loadComiteForImport(comiteId);
  const { categories, domaines } = await catalogs();
  const cats = categories.length
    ? categories
    : ["Budget", "Technique", "Planning"];
  const doms = domaines.length ? domaines : ["Programme Office"];
  const label = `${param?.short_label || comite.instance} #${comite.numero}`;
  const base64 = await buildRaidComiteCanevasBase64({
    categories: cats,
    domaines: doms,
    comiteLabel: label,
  });
  const slug = `${comite.instance}-${comite.numero}`.replace(/\s+/g, "_");
  return {
    fileName: `canevas_raid_${slug}.xlsx`,
    base64,
  };
}

export async function previewRaidComiteExcel(
  comiteId: string,
  fileBase64: string
): Promise<{
  allOk: boolean;
  fileError?: string;
  accepted: number;
  rejected: number;
  lines: RaidComitePreviewLine[];
  comiteLabel: string;
}> {
  const result = await parseAndValidate(comiteId, fileBase64);
  const label = `${result.comite.instance} #${result.comite.numero}`;
  return {
    allOk: result.allOk,
    fileError: result.fileError,
    accepted: result.lines.filter((l) => l.ok).length,
    rejected: result.lines.filter((l) => !l.ok).length,
    lines: result.lines,
    comiteLabel: label,
  };
}

export async function commitRaidComiteExcel(
  comiteId: string,
  fileBase64: string
): Promise<{
  created: Array<{ code: string; type: string; intitule: string }>;
  comiteLabel: string;
}> {
  const result = await parseAndValidate(comiteId, fileBase64);
  if (result.fileError || !result.allOk) {
    throw new Error(
      "Le fichier n'est pas intégralement valide. Corrigez-le avant de charger."
    );
  }
  const created: Array<{ code: string; type: string; intitule: string }> = [];
  for (const p of result.payloads) {
    const row = await createRaid({
      type: p.type,
      intitule: p.intitule,
      description: p.description,
      categorie: p.categorie,
      chantierId: p.chantierId,
      domaine: p.domaine,
      probabilite: p.probabilite,
      impact: p.impact,
      niveau_maitrise: p.niveau_maitrise,
      strategie: p.strategie,
      mitigation: p.mitigation,
      responsable: p.responsable,
      responsableRessourceId: p.responsableRessourceId,
      statut: p.statut,
      date_identification: p.date_identification,
      date_revision: p.date_revision,
      date_echeance: p.date_echeance,
      commentaires: "",
      comiteId: p.comiteId,
    });
    created.push({
      code: row.code,
      type: row.type,
      intitule: row.intitule,
    });
  }
  revalidatePath("/comites");
  return {
    created,
    comiteLabel: `${result.comite.instance} #${result.comite.numero}`,
  };
}
