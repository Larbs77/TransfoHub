import { prisma } from "@/lib/prisma";
import {
  EQUIPE_TYPES,
  functionalTeamDescription,
  functionalTeamName,
} from "@/lib/equipe-types";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Db = typeof prisma | Tx;

/**
 * Ensure a functional Equipe exists for the chantier (1:1).
 * Updates name/description when chantier code/nom change.
 */
export async function ensureChantierFunctionalTeam(
  chantierId: string,
  db: Db = prisma
): Promise<{ id: string; name: string }> {
  const chantier = await db.chantier.findUnique({
    where: { id: chantierId },
    select: {
      id: true,
      code: true,
      nom: true,
      equipeFonctionnelle: { select: { id: true, name: true } },
    },
  });
  if (!chantier) throw new Error("Chantier introuvable.");

  const name = functionalTeamName(chantier.code, chantier.nom);
  const description = functionalTeamDescription(chantier.code, chantier.nom);

  if (chantier.equipeFonctionnelle) {
    if (chantier.equipeFonctionnelle.name !== name) {
      // Avoid unique name clash: if another equipe holds the name, keep current name
      const clash = await db.equipe.findFirst({
        where: {
          name,
          NOT: { id: chantier.equipeFonctionnelle.id },
        },
        select: { id: true },
      });
      if (!clash) {
        await db.equipe.update({
          where: { id: chantier.equipeFonctionnelle.id },
          data: { name, description, type: EQUIPE_TYPES.fonctionnelle },
        });
        return { id: chantier.equipeFonctionnelle.id, name };
      }
    }
    await db.equipe.update({
      where: { id: chantier.equipeFonctionnelle.id },
      data: {
        description,
        type: EQUIPE_TYPES.fonctionnelle,
        is_active: true,
      },
    });
    return {
      id: chantier.equipeFonctionnelle.id,
      name: chantier.equipeFonctionnelle.name,
    };
  }

  // Create with unique name fallback
  let finalName = name;
  const existing = await db.equipe.findUnique({ where: { name: finalName } });
  if (existing) {
    finalName = `${name} · ${chantier.id.slice(0, 8)}`;
  }

  const created = await db.equipe.create({
    data: {
      name: finalName,
      description,
      type: EQUIPE_TYPES.fonctionnelle,
      chantierId: chantier.id,
      is_active: true,
      position: 0,
    },
    select: { id: true, name: true },
  });
  return created;
}

/**
 * Sync RessourceEquipeFonctionnelle for a chantier functional team
 * from current MembreEquipe rows (source of truth for functional membership).
 */
export async function syncChantierFunctionalMembership(
  chantierId: string,
  db: Db = prisma
): Promise<void> {
  const team = await ensureChantierFunctionalTeam(chantierId, db);
  const membres = await db.membreEquipe.findMany({
    where: { chantierId },
    select: { ressourceId: true },
  });
  const ressourceIds = [...new Set(membres.map((m) => m.ressourceId))];

  // Remove links no longer on the team
  if (ressourceIds.length === 0) {
    await db.ressourceEquipeFonctionnelle.deleteMany({
      where: { equipeId: team.id },
    });
  } else {
    await db.ressourceEquipeFonctionnelle.deleteMany({
      where: {
        equipeId: team.id,
        ressourceId: { notIn: ressourceIds },
      },
    });
  }

  for (const ressourceId of ressourceIds) {
    await db.ressourceEquipeFonctionnelle.upsert({
      where: {
        ressourceId_equipeId: { ressourceId, equipeId: team.id },
      },
      create: { ressourceId, equipeId: team.id },
      update: {},
    });
  }
}

/**
 * RAID team assignment rule:
 * - If assignee is a member of the RAID's chantier → functional (chantier) team
 * - Else → institutional hierarchy team of the assignee
 */
export async function resolveRaidEquipeId(params: {
  responsableRessourceId: string | null | undefined;
  chantierId: string | null | undefined;
  db?: Db;
}): Promise<{ equipeId: string | null; equipeName: string | null; kind: "fonctionnelle" | "institutionnelle" | null }> {
  const db = params.db ?? prisma;
  const ressourceId = params.responsableRessourceId?.trim() || null;
  if (!ressourceId) {
    return { equipeId: null, equipeName: null, kind: null };
  }

  const chantierId = params.chantierId?.trim() || null;
  if (chantierId) {
    const onTeam = await db.membreEquipe.findFirst({
      where: { chantierId, ressourceId },
      select: { id: true },
    });
    if (onTeam) {
      const team = await ensureChantierFunctionalTeam(chantierId, db);
      return {
        equipeId: team.id,
        equipeName: team.name,
        kind: "fonctionnelle",
      };
    }
  }

  const res = await db.ressource.findUnique({
    where: { id: ressourceId },
    select: {
      equipeHierarchieId: true,
      equipeHierarchie: { select: { id: true, name: true, type: true } },
    },
  });
  if (res?.equipeHierarchieId && res.equipeHierarchie) {
    // Prefer institutional only
    if (
      !res.equipeHierarchie.type ||
      res.equipeHierarchie.type === EQUIPE_TYPES.institutionnelle
    ) {
      return {
        equipeId: res.equipeHierarchie.id,
        equipeName: res.equipeHierarchie.name,
        kind: "institutionnelle",
      };
    }
  }
  return { equipeId: null, equipeName: null, kind: null };
}

/** Backfill functional teams for all chantiers missing one. */
export async function ensureAllChantierFunctionalTeams(): Promise<number> {
  const chantiers = await prisma.chantier.findMany({
    select: { id: true },
    where: { equipeFonctionnelle: null },
  });
  for (const c of chantiers) {
    await ensureChantierFunctionalTeam(c.id);
    await syncChantierFunctionalMembership(c.id);
  }
  // Also resync membership for chantiers that already have a team
  const withTeam = await prisma.chantier.findMany({
    select: { id: true },
    where: { equipeFonctionnelle: { isNot: null } },
  });
  for (const c of withTeam) {
    await syncChantierFunctionalMembership(c.id);
  }
  return chantiers.length + withTeam.length;
}
