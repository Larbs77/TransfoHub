"use server";

import { requireMaintenanceAuth } from "@/lib/auth";
import {
  exportDumpJson,
  exportSqlFile,
  exportCsvZip,
  getDbStats,
  verifyImportPayload,
  restoreDropSchema,
  restoreRunMigrations,
  restoreTruncateAll,
  insertDumpTable,
  restoreExecuteSqlBatch,
  type RestoreMode,
  type VerifyResult,
  type TableDump,
} from "@/lib/db-maintenance";

export async function getMaintenanceDbStats() {
  await requireMaintenanceAuth();
  return getDbStats();
}

export async function exportDbDumpAction() {
  await requireMaintenanceAuth();
  return exportDumpJson();
}

export async function exportDbSqlAction() {
  await requireMaintenanceAuth();
  return exportSqlFile();
}

export async function exportDbCsvZipAction() {
  await requireMaintenanceAuth();
  return exportCsvZip();
}

export async function verifyDbImportAction(
  fileName: string,
  content: string,
  mode: RestoreMode
): Promise<VerifyResult> {
  await requireMaintenanceAuth();
  if (!content || content.length > 60_000_000) {
    return {
      ok: false,
      kind: "unknown",
      mode,
      errors: ["Fichier vide ou trop volumineux (max. ~60 Mo)."],
      warnings: [],
      summary: "Rejeté",
    };
  }
  return verifyImportPayload(fileName, content, mode);
}

/** Step: DROP SCHEMA + CREATE SCHEMA (mode drop only). */
export async function restoreStepDropSchemaAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requireMaintenanceAuth();
  try {
    await restoreDropSchema();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Step: prisma migrate deploy (create tables). */
export async function restoreStepMigrateAction(): Promise<{
  ok: boolean;
  output?: string;
  error?: string;
}> {
  await requireMaintenanceAuth();
  try {
    const output = await restoreRunMigrations();
    return { ok: true, output: output.trim().slice(0, 800) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Step: TRUNCATE all application tables. */
export async function restoreStepTruncateAction(): Promise<{
  ok: boolean;
  tableCount?: number;
  error?: string;
}> {
  await requireMaintenanceAuth();
  try {
    const tableCount = await restoreTruncateAll();
    return { ok: true, tableCount };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Step: load one dump table. */
export async function restoreStepImportTableAction(
  table: TableDump
): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  await requireMaintenanceAuth();
  try {
    if (!table?.name || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      return { ok: false, error: "Table dump invalide." };
    }
    const inserted = await insertDumpTable(table);
    return { ok: true, inserted };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Step: execute a slice of SQL statements (for progressive progress). */
export async function restoreStepSqlBatchAction(
  sql: string,
  offset: number,
  limit = 40
): Promise<{
  ok: boolean;
  executed?: number;
  total?: number;
  done?: boolean;
  error?: string;
}> {
  await requireMaintenanceAuth();
  try {
    if (!sql?.trim()) return { ok: false, error: "SQL vide." };
    const result = await restoreExecuteSqlBatch(sql, offset, limit);
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
