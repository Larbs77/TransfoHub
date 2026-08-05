/**
 * Asserts serveur pour la clôture en cascade (Prisma — ne pas importer côté client).
 */
import { prisma } from "@/lib/prisma";
import {
  allChildrenAtteint,
  formatCannotAtteintMessage,
} from "@/lib/planning-status-rules";

/** Client Prisma minimal (app ou transaction). */
type DbLike = {
  activite: {
    findMany: (args: {
      where: { workstreamId: string };
      select: { nom: true; statut: true };
      orderBy: { ordre: "asc" };
    }) => Promise<{ nom: string; statut: string }[]>;
  };
  workstream: {
    findMany: (args: {
      where: { jalonId: string };
      select: { nom: true; statut: true };
      orderBy: { ordre: "asc" };
    }) => Promise<{ nom: string; statut: string }[]>;
  };
};

export async function assertWorkstreamCanBeAtteint(
  workstreamId: string,
  db: DbLike = prisma as unknown as DbLike
): Promise<void> {
  const acts = await db.activite.findMany({
    where: { workstreamId },
    select: { nom: true, statut: true },
    orderBy: { ordre: "asc" },
  });
  const { ok, pending } = allChildrenAtteint(acts);
  if (ok) return;
  throw new Error(formatCannotAtteintMessage("workstream", pending));
}

export async function assertJalonCanBeAtteint(
  jalonId: string,
  db: DbLike = prisma as unknown as DbLike
): Promise<void> {
  const streams = await db.workstream.findMany({
    where: { jalonId },
    select: { nom: true, statut: true },
    orderBy: { ordre: "asc" },
  });
  const { ok, pending } = allChildrenAtteint(streams);
  if (ok) return;
  throw new Error(formatCannotAtteintMessage("jalon", pending));
}
