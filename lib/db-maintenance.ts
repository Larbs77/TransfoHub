import pg from "pg";
import { rowsToCsv } from "@/lib/csv-data-admin";

const { Client } = pg;

export const DUMP_FORMAT = "transfohub-dump-v1" as const;

export type RestoreMode = "truncate" | "drop";

export type TableDump = {
  name: string;
  columns: string[];
  rows: unknown[][];
  rowCount: number;
};

export type TransfoDump = {
  format: typeof DUMP_FORMAT;
  exportedAt: string;
  schema: string;
  tables: TableDump[];
};

export type FileKind = "dump" | "sql" | "unknown";

export type VerifyResult = {
  ok: boolean;
  kind: FileKind;
  mode: RestoreMode;
  errors: string[];
  warnings: string[];
  summary: string;
  tableCount?: number;
  rowCount?: number;
  /** Parsed dump if kind === dump */
  dump?: TransfoDump;
  /** Normalized SQL text if kind === sql */
  sql?: string;
};

export type ImportResult = {
  ok: boolean;
  message: string;
  details: string[];
};

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  return url;
}

function getSchema(): string {
  try {
    const u = new URL(getConnectionString());
    return u.searchParams.get("schema") || "public";
  } catch {
    return "public";
  }
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** List user tables in the app schema (excludes Prisma migrations). */
export async function listAppTables(): Promise<string[]> {
  const schema = getSchema();
  return withClient(async (client) => {
    const res = await client.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = $1
         AND tablename NOT LIKE '_prisma%'
       ORDER BY tablename`,
      [schema]
    );
    return res.rows.map((r) => r.tablename);
  });
}

async function getTableColumns(
  client: pg.Client,
  schema: string,
  table: string
): Promise<string[]> {
  const meta = await getTableColumnMeta(client, schema, table);
  return meta.map((c) => c.name);
}

type ColumnMeta = {
  name: string;
  /** PostgreSQL udt_name: json, jsonb, timestamp, text, _text, etc. */
  udt: string;
  dataType: string;
};

async function getTableColumnMeta(
  client: pg.Client,
  schema: string,
  table: string
): Promise<ColumnMeta[]> {
  const res = await client.query<{
    column_name: string;
    udt_name: string;
    data_type: string;
  }>(
    `SELECT column_name, udt_name, data_type
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return res.rows.map((r) => ({
    name: r.column_name,
    udt: r.udt_name,
    dataType: r.data_type,
  }));
}

/**
 * Coerce dump cell values to what node-pg + PostgreSQL expect.
 * Critical: JS arrays/objects must be JSON.stringify'd for json/jsonb
 * (otherwise node-pg sends them as PG arrays → "syntaxe invalide pour json").
 */
function coerceForInsert(value: unknown, udt: string): unknown {
  if (value === null || value === undefined) return null;

  const u = udt.toLowerCase();

  // json / jsonb
  if (u === "json" || u === "jsonb") {
    if (typeof value === "string") {
      // Already a JSON string — validate; keep as string for pg
      try {
        JSON.parse(value);
        return value;
      } catch {
        // Plain string that is not JSON → store as JSON string scalar
        return JSON.stringify(value);
      }
    }
    return JSON.stringify(value);
  }

  // booleans
  if (u === "bool") {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "t" || value === 1 || value === "1")
      return true;
    if (value === "false" || value === "f" || value === 0 || value === "0")
      return false;
    return Boolean(value);
  }

  // integers
  if (
    u === "int2" ||
    u === "int4" ||
    u === "int8" ||
    u === "oid" ||
    u === "integer"
  ) {
    if (typeof value === "number") return Math.trunc(value);
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
    return value;
  }

  // floats
  if (u === "float4" || u === "float8" || u === "numeric" || u === "money") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value.replace(",", "."));
      if (Number.isFinite(n)) return n;
    }
    return value;
  }

  // timestamps / dates — ISO strings from dump are fine
  if (
    u === "timestamp" ||
    u === "timestamptz" ||
    u === "date" ||
    u === "time" ||
    u === "timetz"
  ) {
    if (value instanceof Date) return value.toISOString();
    return value;
  }

  // Native PG arrays (udt starts with _) — stringify only if we got a JS array
  // and the target is NOT json. For app tables we rarely use native arrays.
  if (u.startsWith("_") && Array.isArray(value)) {
    // Let node-pg handle JS arrays as PG arrays
    return value;
  }

  // Objects accidentally present on text columns
  if (typeof value === "object" && !(value instanceof Date)) {
    return JSON.stringify(value);
  }

  return value;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }
  if (typeof value === "object") {
    // JSON / arrays from pg
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  const s = String(value);
  return `'${s.replace(/'/g, "''")}'`;
}

// ── Export ────────────────────────────────────────────

export async function buildDump(): Promise<TransfoDump> {
  const schema = getSchema();
  return withClient(async (client) => {
    const tables = await listAppTablesInner(client, schema);
    const dumps: TableDump[] = [];

    for (const name of tables) {
      const columns = await getTableColumns(client, schema, name);
      if (columns.length === 0) continue;
      const colList = columns.map(quoteIdent).join(", ");
      const res = await client.query(
        `SELECT ${colList} FROM ${quoteIdent(schema)}.${quoteIdent(name)}`
      );
      const rows = res.rows.map((row) =>
        columns.map((c) => {
          const v = row[c];
          if (v instanceof Date) return v.toISOString();
          return v;
        })
      );
      dumps.push({
        name,
        columns,
        rows,
        rowCount: rows.length,
      });
    }

    return {
      format: DUMP_FORMAT,
      exportedAt: new Date().toISOString(),
      schema,
      tables: dumps,
    };
  });
}

async function listAppTablesInner(
  client: pg.Client,
  schema: string
): Promise<string[]> {
  const res = await client.query<{ tablename: string }>(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = $1
       AND tablename NOT LIKE '_prisma%'
     ORDER BY tablename`,
    [schema]
  );
  return res.rows.map((r) => r.tablename);
}

export async function exportDumpJson(): Promise<{
  fileName: string;
  content: string;
  mime: string;
}> {
  const dump = await buildDump();
  const date = new Date().toISOString().slice(0, 10);
  return {
    fileName: `transfodb_dump_${date}.thdump.json`,
    content: JSON.stringify(dump, null, 2),
    mime: "application/json",
  };
}

export async function exportSqlFile(): Promise<{
  fileName: string;
  content: string;
  mime: string;
}> {
  const dump = await buildDump();
  const schema = dump.schema;
  const lines: string[] = [
    `-- TransfoHub SQL export`,
    `-- exportedAt: ${dump.exportedAt}`,
    `-- schema: ${schema}`,
    `-- format: data-only (INSERT). Compatible with mode "truncate".`,
    `-- For mode "drop", prefer a full dump + migrations or a schema-aware SQL.`,
    ``,
    `SET session_replication_role = replica;`,
    `BEGIN;`,
    ``,
  ];

  for (const table of dump.tables) {
    lines.push(`-- Table ${table.name} (${table.rowCount} rows)`);
    if (table.rowCount === 0) {
      lines.push(`-- (empty)`);
      lines.push("");
      continue;
    }
    const colList = table.columns.map(quoteIdent).join(", ");
    for (const row of table.rows) {
      const values = row.map(sqlLiteral).join(", ");
      lines.push(
        `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(table.name)} (${colList}) VALUES (${values});`
      );
    }
    lines.push("");
  }

  lines.push(`COMMIT;`);
  lines.push(`SET session_replication_role = DEFAULT;`);
  lines.push("");

  const date = new Date().toISOString().slice(0, 10);
  return {
    fileName: `transfodb_data_${date}.sql`,
    content: lines.join("\n"),
    mime: "application/sql",
  };
}

/** Minimal ZIP (STORE) builder for CSV multi-file export. */
function buildZipStore(
  files: { name: string; data: Uint8Array }[]
): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  };
  const u32 = (n: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  };
  const concat = (chunks: Uint8Array[]) => {
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  };

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0), // crc optional 0 for store in many readers; better compute
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      file.data,
    ]);
    // CRC32
    const crc = crc32(file.data);
    // patch crc in local header
    new DataView(local.buffer, local.byteOffset, local.byteLength).setUint32(
      14,
      crc,
      true
    );

    parts.push(local);

    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    central.push(centralHeader);
    offset += local.length;
  }

  const centralDir = concat(central);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...parts, centralDir, end]);
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

export async function exportCsvZip(): Promise<{
  fileName: string;
  contentBase64: string;
  mime: string;
}> {
  const dump = await buildDump();
  const enc = new TextEncoder();
  const files = dump.tables.map((t) => {
    const header = t.columns;
    const body = t.rows.map((row) =>
      row.map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (typeof cell === "object") return JSON.stringify(cell);
        return String(cell);
      })
    );
    // Include technical columns in full DB CSV export
    const csv = rowsToCsv(header, body);
    return {
      name: `${t.name}.csv`,
      data: enc.encode(csv),
    };
  });

  // manifest
  files.unshift({
    name: "_manifest.json",
    data: enc.encode(
      JSON.stringify(
        {
          format: DUMP_FORMAT,
          exportedAt: dump.exportedAt,
          schema: dump.schema,
          tables: dump.tables.map((t) => ({
            name: t.name,
            columns: t.columns,
            rowCount: t.rowCount,
          })),
        },
        null,
        2
      )
    ),
  });

  const zip = buildZipStore(files);
  const date = new Date().toISOString().slice(0, 10);
  return {
    fileName: `transfodb_csv_${date}.zip`,
    contentBase64: Buffer.from(zip).toString("base64"),
    mime: "application/zip",
  };
}

// ── Detect / verify ───────────────────────────────────

const DDL_PATTERN =
  /\b(CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|COMMENT\s+ON)\b/i;
const DANGEROUS_PATTERN =
  /\b(DROP\s+DATABASE|DROP\s+SCHEMA|CREATE\s+DATABASE)\b/i;

export function detectFileKind(
  fileName: string,
  content: string
): FileKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".thdump.json") || lower.endsWith(".dump.json")) {
    return "dump";
  }
  if (lower.endsWith(".sql")) return "sql";

  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed);
      if (j && j.format === DUMP_FORMAT && Array.isArray(j.tables)) {
        return "dump";
      }
    } catch {
      /* ignore */
    }
  }
  if (
    /^\s*--/.test(trimmed) ||
    /\bINSERT\s+INTO\b/i.test(trimmed) ||
    /\bCREATE\s+TABLE\b/i.test(trimmed) ||
    /\bCOPY\s+/i.test(trimmed)
  ) {
    return "sql";
  }
  return "unknown";
}

export function verifyImportPayload(
  fileName: string,
  content: string,
  mode: RestoreMode
): VerifyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const kind = detectFileKind(fileName, content);

  if (kind === "unknown") {
    return {
      ok: false,
      kind,
      mode,
      errors: [
        "Format non reconnu. Utilisez un dump TransfoHub (.thdump.json) ou un fichier SQL (.sql).",
      ],
      warnings: [],
      summary: "Fichier non reconnu",
    };
  }

  if (kind === "dump") {
    let dump: TransfoDump;
    try {
      dump = JSON.parse(content) as TransfoDump;
    } catch {
      return {
        ok: false,
        kind,
        mode,
        errors: ["JSON dump illisible."],
        warnings: [],
        summary: "JSON invalide",
      };
    }
    if (dump.format !== DUMP_FORMAT) {
      errors.push(
        `Format dump attendu « ${DUMP_FORMAT} », reçu « ${String(dump.format)} ».`
      );
    }
    if (!Array.isArray(dump.tables)) {
      errors.push("Le dump ne contient pas de liste de tables.");
    }
    const tableCount = dump.tables?.length ?? 0;
    const rowCount =
      dump.tables?.reduce((s, t) => s + (t.rowCount ?? t.rows?.length ?? 0), 0) ??
      0;

    if (mode === "truncate") {
      warnings.push(
        "Mode TRUNCATE : les tables existantes seront vidées puis rechargées. La structure (DDL) n'est pas modifiée."
      );
      if (tableCount === 0) {
        errors.push("Dump sans tables — rien à importer en mode truncate.");
      }
    } else {
      warnings.push(
        "Mode DROP : schéma détruit → migrations Prisma → TRUNCATE des seeds (ex. AppRole) → chargement du dump."
      );
    }

    return {
      ok: errors.length === 0,
      kind,
      mode,
      errors,
      warnings,
      summary: `Dump TransfoHub — ${tableCount} table(s), ${rowCount} ligne(s)`,
      tableCount,
      rowCount,
      dump: errors.length === 0 ? dump : undefined,
    };
  }

  // SQL
  const sql = content.replace(/^\uFEFF/, "");
  if (!sql.trim()) {
    errors.push("Fichier SQL vide.");
  }
  if (DANGEROUS_PATTERN.test(sql)) {
    errors.push(
      "SQL refusé : commandes DROP/CREATE DATABASE ou DROP SCHEMA globales non autorisées via l'interface."
    );
  }

  const hasDdl = DDL_PATTERN.test(sql);
  const hasInsert = /\bINSERT\s+INTO\b/i.test(sql) || /\bCOPY\s+/i.test(sql);

  if (mode === "truncate") {
    if (hasDdl) {
      errors.push(
        "Mode TRUNCATE : le fichier SQL ne doit contenir que des données (INSERT/COPY). DDL (CREATE/DROP/ALTER/TRUNCATE) détecté — utilisez le mode DROP ou un export « data-only »."
      );
    }
    if (!hasInsert && !errors.length) {
      warnings.push(
        "Aucun INSERT/COPY détecté — le fichier pourrait ne rien charger."
      );
    }
  } else {
    // drop mode
    if (!hasDdl && hasInsert) {
      warnings.push(
        "Mode DROP avec SQL data-only : le schéma sera recréé via migrations Prisma, puis le SQL sera exécuté."
      );
    }
    if (hasDdl) {
      warnings.push(
        "SQL avec DDL : exécuté après reset du schéma. Vérifiez la cohérence avec le schéma Prisma."
      );
    }
  }

  const insertCount = (sql.match(/\bINSERT\s+INTO\b/gi) || []).length;

  return {
    ok: errors.length === 0,
    kind: "sql",
    mode,
    errors,
    warnings,
    summary: `SQL — ~${insertCount} INSERT, DDL=${hasDdl ? "oui" : "non"}`,
    sql: errors.length === 0 ? sql : undefined,
  };
}

// ── Import ────────────────────────────────────────────

async function truncateAllTables(client: pg.Client, schema: string) {
  const tables = await listAppTablesInner(client, schema);
  if (tables.length === 0) return;
  const list = tables
    .map((t) => `${quoteIdent(schema)}.${quoteIdent(t)}`)
    .join(", ");
  await client.query(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`
  );
}

async function dropAndRecreateSchema(client: pg.Client, schema: string) {
  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schema)} CASCADE`);
  await client.query(`CREATE SCHEMA ${quoteIdent(schema)}`);
  // Ensure public grants for app role
  await client.query(
    `GRANT ALL ON SCHEMA ${quoteIdent(schema)} TO CURRENT_USER`
  );
}

async function runPrismaMigrations(): Promise<string> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  const isWin = process.platform === "win32";
  const npx = isWin ? "npx.cmd" : "npx";
  try {
    const { stdout, stderr } = await execFileAsync(
      npx,
      ["prisma", "migrate", "deploy"],
      {
        cwd: process.cwd(),
        env: process.env,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        shell: isWin,
      }
    );
    return (stdout || "") + (stderr || "");
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `Échec prisma migrate deploy: ${err.stderr || err.stdout || err.message || e}`
    );
  }
}

/** Insert one table from a dump (FK checks relaxed for the transaction session). */
export async function insertDumpTable(table: TableDump): Promise<number> {
  const schema = getSchema();
  if (!table.rows?.length) return 0;

  return withClient(async (client) => {
    await client.query("SET session_replication_role = replica");
    try {
      return await insertDumpTableWithClient(client, schema, table);
    } finally {
      await client.query("SET session_replication_role = DEFAULT").catch(
        () => undefined
      );
    }
  });
}

async function insertDumpTableWithClient(
  client: pg.Client,
  schema: string,
  table: TableDump
): Promise<number> {
  let inserted = 0;
  if (!table.rows?.length) return 0;

  const meta = await getTableColumnMeta(client, schema, table.name);
  const metaByName = new Map(meta.map((m) => [m.name, m]));

  // Only insert columns that exist in the live schema (dump may be older/newer)
  const columns = table.columns.filter((c) => metaByName.has(c));
  if (columns.length === 0) {
    throw new Error(
      `Table « ${table.name} » : aucune colonne du dump ne correspond au schéma actuel.`
    );
  }
  const missingInDb = table.columns.filter((c) => !metaByName.has(c));
  if (missingInDb.length > 0) {
    console.warn(
      `[db-maintenance] ${table.name}: colonnes ignorées (absentes en base): ${missingInDb.join(", ")}`
    );
  }

  const colList = columns.map(quoteIdent).join(", ");
  const colIndexes = columns.map((c) => table.columns.indexOf(c));

  for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
    const row = table.rows[rowIdx];
    const placeholders = columns
      .map((c, i) => {
        const udt = metaByName.get(c)!.udt.toLowerCase();
        // Explicit cast for json/jsonb so a string payload is accepted
        if (udt === "json") return `$${i + 1}::json`;
        if (udt === "jsonb") return `$${i + 1}::jsonb`;
        return `$${i + 1}`;
      })
      .join(", ");

    const values = colIndexes.map((srcIdx, i) => {
      const colName = columns[i];
      const udt = metaByName.get(colName)!.udt;
      return coerceForInsert(row[srcIdx], udt);
    });

    try {
      await client.query(
        `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(table.name)} (${colList}) VALUES (${placeholders})`,
        values
      );
      inserted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Échec INSERT « ${table.name} » ligne dump #${rowIdx + 1}/${table.rows.length}: ${msg}`
      );
    }
  }
  return inserted;
}

async function insertDumpData(
  client: pg.Client,
  dump: TransfoDump
): Promise<number> {
  const schema = dump.schema || getSchema();
  let inserted = 0;
  await client.query("SET session_replication_role = replica");
  try {
    for (const table of dump.tables) {
      if (!table.rows?.length) continue;
      inserted += await insertDumpTableWithClient(client, schema, table);
    }
  } finally {
    await client.query("SET session_replication_role = DEFAULT").catch(
      () => undefined
    );
  }
  return inserted;
}

// ── Stepwise restore (for live progress UI) ───────────

export async function restoreDropSchema(): Promise<void> {
  const schema = getSchema();
  await withClient(async (client) => {
    await dropAndRecreateSchema(client, schema);
  });
}

export async function restoreRunMigrations(): Promise<string> {
  return runPrismaMigrations();
}

export async function restoreTruncateAll(): Promise<number> {
  const schema = getSchema();
  let count = 0;
  await withClient(async (client) => {
    const tables = await listAppTablesInner(client, schema);
    count = tables.length;
    await truncateAllTables(client, schema);
  });
  return count;
}

export async function restoreExecuteSqlBatch(
  sql: string,
  offset: number,
  limit: number
): Promise<{ executed: number; total: number; done: boolean }> {
  const statements = splitSqlStatements(sql).filter((s) => {
    const t = s.replace(/^\s*--.*$/gm, "").trim();
    return t.length > 0;
  });
  const total = statements.length;
  const slice = statements.slice(offset, offset + limit);
  if (slice.length === 0) {
    return { executed: 0, total, done: true };
  }
  await withClient(async (client) => {
    for (const stmt of slice) {
      await client.query(stmt);
    }
  });
  const next = offset + slice.length;
  return {
    executed: slice.length,
    total,
    done: next >= total,
  };
}

/**
 * Split SQL into statements — basic, good enough for our generated exports.
 * Does not handle complex dollar-quoting edge cases perfectly.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += c;
      if (c === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      current += c;
      if (c === "*" && next === "/") {
        current += "/";
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingle) {
      current += c;
      if (c === "'" && next === "'") {
        current += "'";
        i++;
        continue;
      }
      if (c === "'") inSingle = false;
      continue;
    }

    if (c === "-" && next === "-") {
      inLineComment = true;
      current += c;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      current += c;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      current += c;
      continue;
    }
    if (c === ";") {
      const s = current.trim();
      if (s) statements.push(s);
      current = "";
      continue;
    }
    current += c;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function executeSqlScript(
  client: pg.Client,
  sql: string
): Promise<number> {
  const statements = splitSqlStatements(sql).filter((s) => {
    const t = s.replace(/^\s*--.*$/gm, "").trim();
    return t.length > 0;
  });
  let n = 0;
  for (const stmt of statements) {
    // Skip session helpers we might re-set
    await client.query(stmt);
    n++;
  }
  return n;
}

export async function executeVerifiedImport(
  verified: VerifyResult
): Promise<ImportResult> {
  if (!verified.ok) {
    return {
      ok: false,
      message: "Import refusé : validation échouée.",
      details: verified.errors,
    };
  }

  const schema = getSchema();
  const details: string[] = [];

  try {
    if (verified.mode === "drop") {
      details.push("Suppression du schéma…");
      await withClient(async (client) => {
        await dropAndRecreateSchema(client, schema);
      });
      details.push("Schéma recréé.");
      details.push("Application des migrations Prisma…");
      const mig = await runPrismaMigrations();
      if (mig.trim()) details.push(mig.trim().slice(0, 500));
      details.push("Migrations appliquées.");
      // Migrations may seed rows (e.g. AppRole defaults). Clear them so the
      // dump/SQL can reload the exact production snapshot without unique conflicts.
      details.push(
        "Vidage des tables applicatives (données seed des migrations)…"
      );
      await withClient(async (client) => {
        await truncateAllTables(client, schema);
      });
      details.push("Tables vidées — prêt pour le chargement du dump/SQL.");
    } else {
      details.push("TRUNCATE de toutes les tables applicatives…");
      await withClient(async (client) => {
        await truncateAllTables(client, schema);
      });
      details.push("Tables vidées.");
    }

    if (verified.kind === "dump" && verified.dump) {
      details.push("Chargement du dump JSON…");
      const count = await withClient((client) =>
        insertDumpData(client, verified.dump!)
      );
      details.push(`${count} ligne(s) insérée(s).`);
      return {
        ok: true,
        message: `Import dump terminé (${verified.mode}).`,
        details,
      };
    }

    if (verified.kind === "sql" && verified.sql) {
      details.push("Exécution du script SQL…");
      const n = await withClient((client) =>
        executeSqlScript(client, verified.sql!)
      );
      details.push(`${n} instruction(s) SQL exécutée(s).`);
      return {
        ok: true,
        message: `Import SQL terminé (${verified.mode}).`,
        details,
      };
    }

    return {
      ok: false,
      message: "Aucune charge utile à importer.",
      details,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Échec de l'import",
      details,
    };
  }
}

export async function getDbStats(): Promise<{
  schema: string;
  tables: { name: string; approxRows: number }[];
}> {
  const schema = getSchema();
  return withClient(async (client) => {
    const tables = await listAppTablesInner(client, schema);
    const out: { name: string; approxRows: number }[] = [];
    for (const name of tables) {
      const res = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM ${quoteIdent(schema)}.${quoteIdent(name)}`
      );
      out.push({ name, approxRows: Number(res.rows[0]?.c ?? 0) });
    }
    return { schema, tables: out };
  });
}

