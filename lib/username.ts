import { prisma } from "@/lib/prisma";

/** Prisma client or interactive transaction — username lookup only. */
type UsernameClient = {
  user: {
    findFirst: (typeof prisma)["user"]["findFirst"];
  };
};

export function normalizeUsernameInput(raw: string): string {
  return raw.trim();
}

export async function findUserByUsernameInsensitive(
  username: string,
  db: UsernameClient = prisma
) {
  const value = normalizeUsernameInput(username);
  if (!value) return null;
  return db.user.findFirst({
    where: { username: { equals: value, mode: "insensitive" } },
  });
}

export async function assertUsernameAvailable(
  username: string,
  opts?: { excludeId?: string; db?: UsernameClient }
) {
  const existing = await findUserByUsernameInsensitive(
    username,
    opts?.db ?? prisma
  );
  if (existing && existing.id !== opts?.excludeId) {
    throw new Error("Ce nom d'utilisateur existe déjà.");
  }
}
