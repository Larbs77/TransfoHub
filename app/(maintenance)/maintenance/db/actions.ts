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

/**
 * React 19 Flight (Server Actions) encodes arguments as an array.
 * When that array has more than one element, string lengths inside it
 * count toward a ~1e6 "array nesting" budget. A prod .thdump.json (~5 Mo)
 * passed as a sibling arg then throws:
 *   "Maximum array nesting exceeded. Large nested arrays can be dangerous."
 * Nested `rows: unknown[][]` hit the same limit (Notification in prod).
 * Large payloads must travel as fields of a **single object** argument,
 * with table rows sent as a JSON string rather than live nested arrays.
 */
const MAX_IMPORT_CHARS = 60_000_000;

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

export async function verifyDbImportAction(payload: {
  fileName: string;
  content: string;
  mode: RestoreMode;
}): Promise<VerifyResult> {
  await requireMaintenanceAuth();
  const fileName = payload?.fileName ?? "";
  const content = payload?.content ?? "";
  const mode = payload?.mode ?? "truncate";
  if (!content || content.length > MAX_IMPORT_CHARS) {
    return {
      ok: false,
      kind: "unknown",
      mode,
      errors: ["Fichier vide ou trop volumineux (max. ~60 Mo)."],
      warnings: [],
      summary: "Rejeté",
    };
  }
  const result = verifyImportPayload(fileName, content, mode);
  // Strip dump/SQL bodies: nested row arrays + multi-MB strings trip React Flight.
  return {
    ok: result.ok,
    kind: result.kind,
    mode: result.mode,
    errors: result.errors,
    warnings: result.warnings,
    summary: result.summary,
    tableCount: result.tableCount,
    rowCount: result.rowCount,
  };
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

/** Step: load one dump table (or a row chunk). Payload is JSON to avoid Flight nested-array limits. */
export async function restoreStepImportTableAction(payload: {
  tableJson: string;
}): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  await requireMaintenanceAuth();
  try {
    const raw = payload?.tableJson;
    if (!raw || typeof raw !== "string") {
      return { ok: false, error: "Table dump invalide." };
    }
    if (raw.length > MAX_IMPORT_CHARS) {
      return { ok: false, error: "Table trop volumineuse (max. ~60 Mo)." };
    }
    let table: TableDump;
    try {
      table = JSON.parse(raw) as TableDump;
    } catch {
      return { ok: false, error: "JSON de table illisible." };
    }
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
export async function restoreStepSqlBatchAction(payload: {
  sql: string;
  offset: number;
  limit?: number;
}): Promise<{
  ok: boolean;
  executed?: number;
  total?: number;
  done?: boolean;
  error?: string;
}> {
  await requireMaintenanceAuth();
  try {
    const sql = payload?.sql ?? "";
    const offset = payload?.offset ?? 0;
    const limit = payload?.limit ?? 40;
    if (!sql.trim()) return { ok: false, error: "SQL vide." };
    const result = await restoreExecuteSqlBatch(sql, offset, limit);
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
