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
const PRISMA_MODEL_STAMP = "comite-parametre-v1";

function clientLooksCurrent(client: PrismaClient): boolean {
  try {
    const c = client as unknown as {
      user?: unknown;
      mailServerConfig?: { findFirst?: unknown };
      comiteParametre?: { findMany?: unknown };
    };
    // Force recreate when new models are missing (stale HMR singleton).
    if (!c.user) return false;
    if (typeof c.mailServerConfig?.findFirst !== "function") return false;
    if (typeof c.comiteParametre?.findMany !== "function") return false;
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
