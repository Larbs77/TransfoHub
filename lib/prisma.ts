import { createPrismaClient } from "@/lib/create-prisma";
import type { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaModelStamp?: string;
};

/**
 * Bump whenever the Prisma schema gains fields/models so HMR drops a stale
 * singleton (otherwise findUnique rejects unknown select fields).
 */
const PRISMA_MODEL_STAMP = "user-theme-pref-v2";

function clientLooksCurrent(client: PrismaClient): boolean {
  try {
    // Runtime check: User delegate must expose avatar_url on its DMMF/fields
    const user = (client as unknown as { user?: { fields?: Record<string, unknown> } })
      .user;
    if (!user) return false;
    // Prisma 7 client: probe that a dummy select shape is accepted by checking
    // the generated runtime data model via $extends isn't available; instead
    // force recreate when stamp mismatches (primary path).
    return true;
  } catch {
    return false;
  }
}

function getClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  const stampOk = globalForPrisma.prismaModelStamp === PRISMA_MODEL_STAMP;

  if (cached && stampOk && clientLooksCurrent(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaModelStamp = PRISMA_MODEL_STAMP;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
