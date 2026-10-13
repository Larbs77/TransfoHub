/**
 * Write a TransfoHub .thdump.json (same format as the maintenance console).
 * Compact JSON (no indent) to keep files small.
 *
 * Usage: npx tsx scripts/backup-dump-json.ts /path/to/out.thdump.json
 */
import fs from "fs";
import path from "path";
import { buildDump } from "../lib/db-maintenance";

async function main() {
  const out = process.argv[2];
  if (!out) {
    console.error("Usage: npx tsx scripts/backup-dump-json.ts <fichier.thdump.json>");
    process.exit(1);
  }
  const dump = await buildDump();
  const json = JSON.stringify(dump);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json, "utf8");
  const kb = (Buffer.byteLength(json) / 1024).toFixed(1);
  const tables = dump.tables.length;
  const rows = dump.tables.reduce((s, t) => s + t.rowCount, 0);
  console.log(`JSON ${out} (${kb} KiB, ${tables} tables, ${rows} rows)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
