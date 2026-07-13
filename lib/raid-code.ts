import { prisma } from "@/lib/prisma";

/** First letter of RAID code by type. */
export const RAID_TYPE_CODE_PREFIX: Record<string, string> = {
  Action: "A",
  Risque: "R",
  Information: "I",
  Décision: "D",
};

export function raidCodePrefixForType(type: string): string | null {
  return RAID_TYPE_CODE_PREFIX[type] ?? null;
}

/** Format e.g. A_00001 (letter + underscore + 5 digits). */
export function formatRaidCode(prefix: string, n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99999) {
    throw new Error(`Numéro de code RAID hors plage (1–99999) : ${n}`);
  }
  return `${prefix.toUpperCase()}_${String(n).padStart(5, "0")}`;
}

/** Normalize user/CSV input to canonical form (e.g. a_12 → A_00012). */
export function normalizeRaidCode(code: string): string {
  const m = /^([A-Za-z])_(\d{1,5})$/.exec(code.trim());
  if (!m) return code.trim().toUpperCase();
  const n = Number(m[2]);
  if (!Number.isFinite(n) || n < 1) return code.trim().toUpperCase();
  return formatRaidCode(m[1], n);
}

export function isValidRaidCodeFormat(code: string): boolean {
  return /^[ADRI]_\d{5}$/.test(code.trim());
}

export function parseRaidCodeNumber(code: string): number | null {
  const m = /^[ADRI]_(\d{5})$/.exec(code.trim());
  if (!m) return null;
  return Number(m[1]);
}

/** Whether the code letter matches the RAID type. */
export function raidCodeMatchesType(code: string, type: string): boolean {
  const prefix = raidCodePrefixForType(type);
  if (!prefix) return false;
  return code.trim().toUpperCase().startsWith(`${prefix}_`);
}

type Queryable = {
  $queryRaw: typeof prisma.$queryRaw;
  $executeRaw: typeof prisma.$executeRaw;
};

/**
 * Atomically allocate the next code for a RAID type (A_00001, R_00002, …).
 * Safe under concurrent creates (Postgres upsert + RETURNING).
 */
export async function allocateNextRaidCode(
  type: string,
  db: Queryable = prisma
): Promise<string> {
  const prefix = raidCodePrefixForType(type);
  if (!prefix) {
    throw new Error(
      `Type RAID inconnu pour code automatique : « ${type} » (Action, Risque, Information, Décision)`
    );
  }

  const rows = await db.$queryRaw<Array<{ last: number }>>`
    INSERT INTO "RaidCodeSequence" ("type", "last")
    VALUES (${type}, 1)
    ON CONFLICT ("type") DO UPDATE
    SET "last" = "RaidCodeSequence"."last" + 1
    RETURNING "last"
  `;
  const last = rows[0]?.last;
  if (last == null || !Number.isFinite(Number(last))) {
    throw new Error("Impossible d'allouer un code RAID");
  }
  return formatRaidCode(prefix, Number(last));
}

/**
 * After importing an explicit code, raise the sequence so auto-codes do not clash.
 */
export async function bumpRaidCodeSequenceIfNeeded(
  type: string,
  number: number,
  db: Queryable = prisma
): Promise<void> {
  if (!Number.isInteger(number) || number < 1) return;
  await db.$executeRaw`
    INSERT INTO "RaidCodeSequence" ("type", "last")
    VALUES (${type}, ${number})
    ON CONFLICT ("type") DO UPDATE
    SET "last" = GREATEST("RaidCodeSequence"."last", EXCLUDED."last")
  `;
}
