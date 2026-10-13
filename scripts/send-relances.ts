/**
 * Scheduled chantier reminders.
 * No-ops outside Monday/Thursday 02:00–08:00 Africa/Casablanca.
 *
 *   npm run mail:relances
 */
import "dotenv/config";
import pg from "pg";
import { prisma } from "../lib/prisma";
import { runScheduledRelances } from "../lib/mail-relances";

const LOCK_KEY = "814202613";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("relance: DATABASE_URL manquant");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const locked = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1::bigint) AS locked",
      [LOCK_KEY]
    );
    if (!locked.rows[0]?.locked) {
      console.log("relance: déjà en cours, abandon");
      return;
    }
    try {
      const result = await runScheduledRelances();
      console.log(
        `relance: ${result.outcome} — ${result.message} (envoyés ${result.sent}, échecs ${result.failed})`
      );
    } finally {
      await client.query("SELECT pg_advisory_unlock($1::bigint)", [LOCK_KEY]);
    }
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error("relance:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
