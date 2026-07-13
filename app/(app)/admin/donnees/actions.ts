"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requirePageAccess } from "@/lib/auth";
import {
  type DataTableKey,
  type LookupMaps,
  type PreviewReport,
  DATA_TABLE_META,
  DATA_TABLE_KEYS,
  getTemplateCsv,
  rowsToCsv,
  buildPreviewReport,
  RESSOURCE_CSV_COLUMNS,
  RAID_CSV_COLUMNS,
} from "@/lib/csv-data-admin";
import {
  allocateNextRaidCode,
  bumpRaidCodeSequenceIfNeeded,
  parseRaidCodeNumber,
} from "@/lib/raid-code";

async function requireDataAdmin() {
  await requireRole("Admin");
  await requirePageAccess("/admin/donnees");
}

function isDataTableKey(v: string): v is DataTableKey {
  return (DATA_TABLE_KEYS as string[]).includes(v);
}

async function loadLookups(): Promise<LookupMaps> {
  const [chantiers, ressources, profils] = await Promise.all([
    prisma.chantier.findMany({ select: { id: true, code: true } }),
    prisma.ressource.findMany({ select: { id: true, email: true } }),
    prisma.profilRessource.findMany({ select: { id: true, nom: true } }),
  ]);

  const chantierByCode = new Map<string, string>();
  for (const c of chantiers) {
    chantierByCode.set(c.code.toUpperCase(), c.id);
  }

  const ressourceByEmail = new Map<string, string>();
  for (const r of ressources) {
    if (r.email?.trim()) {
      ressourceByEmail.set(r.email.trim().toLowerCase(), r.id);
    }
  }

  const profilByName = new Map<string, string>();
  for (const p of profils) {
    profilByName.set(p.nom.trim().toLowerCase(), p.id);
  }

  return { chantierByCode, ressourceByEmail, profilByName };
}

export async function getDataTableCounts(): Promise<
  Record<DataTableKey, number>
> {
  await requireDataAdmin();
  const [ressources, raid] = await Promise.all([
    prisma.ressource.count(),
    prisma.raid.count(),
  ]);
  return { ressources, raid };
}

export async function exportTableCsv(
  table: string
): Promise<{ fileName: string; csv: string }> {
  await requireDataAdmin();
  if (!isDataTableKey(table)) {
    throw new Error("Table non supportée");
  }

  const meta = DATA_TABLE_META[table];
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${meta.fileBase}_export_${date}.csv`;

  if (table === "ressources") {
    const rows = await prisma.ressource.findMany({
      include: { profil: { select: { nom: true } } },
      orderBy: { nom_complet: "asc" },
    });
    const headers = RESSOURCE_CSV_COLUMNS.map((c) => c.header);
    const data = rows.map((r) => [
      r.nom_complet,
      r.email,
      r.telephone,
      r.type,
      r.organisation,
      r.tarif_journalier,
      r.capacite_jours_mois,
      r.actif,
      r.profil?.nom ?? "",
    ]);
    return { fileName, csv: rowsToCsv(headers, data) };
  }

  // raid
  const rows = await prisma.raid.findMany({
    include: {
      chantier: { select: { code: true } },
      responsableRessource: { select: { email: true } },
    },
    orderBy: [{ code: "asc" }, { createdAt: "desc" }],
  });
  const headers = RAID_CSV_COLUMNS.map((c) => c.header);
  const data = rows.map((r) => [
    r.code,
    r.type,
    r.intitule,
    r.description,
    r.categorie,
    r.chantier?.code ?? "",
    r.domaine,
    r.probabilite ?? "",
    r.impact ?? "",
    r.strategie,
    r.mitigation,
    r.responsable,
    r.responsableRessource?.email ?? "",
    r.statut,
    r.date_identification
      ? r.date_identification.toISOString().slice(0, 10)
      : "",
    r.date_revision ? r.date_revision.toISOString().slice(0, 10) : "",
    r.date_echeance ? r.date_echeance.toISOString().slice(0, 10) : "",
    r.commentaires,
  ]);
  return { fileName, csv: rowsToCsv(headers, data) };
}

export async function downloadTemplateCsv(
  table: string
): Promise<{ fileName: string; csv: string }> {
  await requireDataAdmin();
  if (!isDataTableKey(table)) {
    throw new Error("Table non supportée");
  }
  const meta = DATA_TABLE_META[table];
  return {
    fileName: `${meta.fileBase}_modele.csv`,
    csv: getTemplateCsv(table),
  };
}

export async function previewCsvImport(
  table: string,
  csvText: string
): Promise<PreviewReport> {
  await requireDataAdmin();
  if (!isDataTableKey(table)) {
    throw new Error("Table non supportée");
  }
  if (!csvText || !csvText.trim()) {
    throw new Error("Fichier CSV vide");
  }
  // Soft size guard (~2 MB text)
  if (csvText.length > 2_000_000) {
    throw new Error("Fichier trop volumineux (max. ~2 Mo)");
  }

  const lookups = await loadLookups();
  return buildPreviewReport(table, csvText, lookups);
}

export type ImportWriteMode = "append" | "replace";

export type ConfirmImportResult = {
  imported: number;
  skipped: number;
  purged: number;
  mode: ImportWriteMode;
};

async function purgeTableData(table: DataTableKey): Promise<number> {
  if (table === "raid") {
    const result = await prisma.raid.deleteMany({});
    return result.count;
  }

  const count = await prisma.ressource.count();
  await prisma.$transaction(async (tx) => {
    await tx.saisieTemps.deleteMany({});
    await tx.user.updateMany({
      where: { ressourceId: { not: null } },
      data: { ressourceId: null },
    });
    // Team membership requires a Ressource — drop assignments when purging resources
    await tx.membreEquipe.deleteMany({});
    await tx.raid.updateMany({
      where: { responsableRessourceId: { not: null } },
      data: { responsableRessourceId: null },
    });
    await tx.ressource.deleteMany({});
  });
  return count;
}

/**
 * Persist only the OK payloads from a previous preview.
 * mode "append" = insert only; "replace" = purge table then insert.
 * System generates id / createdAt / updatedAt.
 */
export async function confirmCsvImport(
  table: string,
  payloads: Record<string, unknown>[],
  mode: ImportWriteMode = "append"
): Promise<ConfirmImportResult> {
  await requireDataAdmin();
  if (!isDataTableKey(table)) {
    throw new Error("Table non supportée");
  }
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error("Aucune ligne valide à importer");
  }
  if (payloads.length > 5000) {
    throw new Error("Trop de lignes (max. 5000 par import)");
  }
  if (mode !== "append" && mode !== "replace") {
    throw new Error("Mode d'import invalide");
  }

  let purged = 0;
  if (mode === "replace") {
    purged = await purgeTableData(table);
  }

  let imported = 0;

  if (table === "ressources") {
    for (const p of payloads) {
      const nom_complet = String(p.nom_complet ?? "").trim();
      const type = String(p.type ?? "").trim();
      if (!nom_complet || !type) continue;

      await prisma.ressource.create({
        data: {
          nom_complet,
          email: String(p.email ?? ""),
          telephone: String(p.telephone ?? ""),
          type,
          organisation: String(p.organisation ?? ""),
          tarif_journalier: Number(p.tarif_journalier) || 0,
          capacite_jours_mois:
            typeof p.capacite_jours_mois === "number"
              ? p.capacite_jours_mois
              : 20,
          actif: p.actif !== false,
          profilId: (p.profilId as string | null) || null,
        },
      });
      imported++;
    }
    revalidatePath("/ressources");
    revalidatePath("/capacite");
    revalidatePath("/saisie-temps");
    revalidatePath("/admin/users");
    revalidatePath("/admin/donnees");
    revalidatePath("/");
    return { imported, skipped: payloads.length - imported, purged, mode };
  }

  // raid
  const usedCodes = new Set<string>();
  const existingCodes = await prisma.raid.findMany({
    select: { code: true },
  });
  for (const r of existingCodes) usedCodes.add(r.code);

  for (const p of payloads) {
    const type = String(p.type ?? "").trim();
    const intitule = String(p.intitule ?? "").trim();
    if (!type || !intitule) continue;

    const toDate = (v: unknown): Date | null => {
      if (!v || typeof v !== "string") return null;
      const d = new Date(`${v}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    let code =
      typeof p.code === "string" && p.code.trim() ? p.code.trim() : null;
    if (code) {
      if (usedCodes.has(code)) {
        // Skip duplicate codes in file / DB
        continue;
      }
    } else {
      code = await allocateNextRaidCode(type);
      // Avoid rare collision if sequence lags behind explicit codes
      let guard = 0;
      while (usedCodes.has(code) && guard < 20) {
        code = await allocateNextRaidCode(type);
        guard++;
      }
    }
    usedCodes.add(code);
    const num = parseRaidCodeNumber(code);
    if (num != null) await bumpRaidCodeSequenceIfNeeded(type, num);

    await prisma.raid.create({
      data: {
        code,
        type,
        intitule,
        description: String(p.description ?? ""),
        categorie: String(p.categorie ?? ""),
        chantierId: (p.chantierId as string | null) || null,
        domaine: String(p.domaine ?? ""),
        probabilite:
          typeof p.probabilite === "number" ? p.probabilite : null,
        impact: typeof p.impact === "number" ? p.impact : null,
        strategie: String(p.strategie ?? ""),
        mitigation: String(p.mitigation ?? ""),
        responsable: String(p.responsable ?? ""),
        responsableRessourceId:
          (p.responsableRessourceId as string | null) || null,
        statut: String(p.statut ?? ""),
        date_identification: toDate(p.date_identification),
        date_revision: toDate(p.date_revision),
        date_echeance: toDate(p.date_echeance),
        commentaires: String(p.commentaires ?? ""),
        comiteId: null,
      },
    });
    imported++;
  }

  revalidatePath("/raid");
  revalidatePath("/chantiers");
  revalidatePath("/comites");
  revalidatePath("/admin/donnees");
  revalidatePath("/");
  return { imported, skipped: payloads.length - imported, purged, mode };
}

export type PurgeResult = {
  deleted: number;
  table: DataTableKey;
};

/**
 * Purge all rows of a supported table.
 * FK cleanup for Ressources (nullify links, delete timesheets).
 */
export async function purgeTable(table: string): Promise<PurgeResult> {
  await requireDataAdmin();
  if (!isDataTableKey(table)) {
    throw new Error("Table non supportée");
  }

  const deleted = await purgeTableData(table);

  if (table === "raid") {
    revalidatePath("/raid");
    revalidatePath("/chantiers");
    revalidatePath("/comites");
  } else {
    revalidatePath("/ressources");
    revalidatePath("/capacite");
    revalidatePath("/saisie-temps");
    revalidatePath("/admin/users");
  }
  revalidatePath("/admin/donnees");
  revalidatePath("/");
  return { deleted, table };
}
