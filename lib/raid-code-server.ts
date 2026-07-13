/**
 * Server-only RAID code allocation (uses Prisma / PostgreSQL).
 * Do not import this module from Client Components.
 */
import { prisma } from "@/lib/prisma";
import {
  formatRaidCode,
  raidCodePrefixForType,
} from "@/lib/raid-code";

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
