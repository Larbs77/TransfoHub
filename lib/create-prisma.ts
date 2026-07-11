import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Shared Prisma client factory for the app and CLI scripts.
 * Requires DATABASE_URL to be a PostgreSQL connection string.
 */
export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required (PostgreSQL). Example: postgresql://user:pass@localhost:5432/transfodb?schema=public"
    );
  }
  if (connectionString.startsWith("file:")) {
    throw new Error(
      "SQLite file: URLs are no longer supported. Set DATABASE_URL to a PostgreSQL connection string."
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}
