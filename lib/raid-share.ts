import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/auth";
import { EQUIPE_TYPES } from "@/lib/equipe-types";

/** Functional teams (chantier membership) of a ressource. */
export async function getMyFunctionalEquipeIds(
  ressourceId: string | null | undefined
): Promise<string[]> {
  if (!ressourceId) return [];
  const rows = await prisma.equipe.findMany({
    where: {
      type: EQUIPE_TYPES.fonctionnelle,
      chantier: { membres: { some: { ressourceId } } },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function getOwnerFunctionalEquipeId(
  chantierId: string | null | undefined
): Promise<string | null> {
  if (!chantierId) return null;
  const team = await prisma.equipe.findUnique({
    where: { chantierId },
    select: { id: true },
  });
  return team?.id ?? null;
}

/**
 * Incoming share: one of my functional teams received the RAID,
 * and that team is not the owner chantier team.
 */
export function raidIsSharedWithMe(
  partageEquipeIds: string[],
  ownerEquipeId: string | null,
  myEquipeIds: string[]
): boolean {
  if (myEquipeIds.length === 0 || partageEquipeIds.length === 0) return false;
  const mine = new Set(myEquipeIds);
  return partageEquipeIds.some((id) => mine.has(id) && id !== ownerEquipeId);
}

export async function isRaidSharedWithSession(
  session: SessionData,
  raid: { id: string; chantierId: string | null }
): Promise<boolean> {
  const myIds = await getMyFunctionalEquipeIds(session.ressourceId);
  if (myIds.length === 0) return false;
  const ownerId = await getOwnerFunctionalEquipeId(raid.chantierId);
  const incoming = myIds.filter((id) => id !== ownerId);
  if (incoming.length === 0) return false;
  const hit = await prisma.raidPartage.findFirst({
    where: { raidId: raid.id, equipeId: { in: incoming } },
    select: { id: true },
  });
  return !!hit;
}

/** Prisma OR-clause so shared RAIDs appear in scoped lists. Null when none. */
export async function sharedRaidVisibilityOr(
  ressourceId: string | null | undefined
): Promise<{ partages: { some: { equipeId: { in: string[] } } } } | null> {
  const ids = await getMyFunctionalEquipeIds(ressourceId);
  if (ids.length === 0) return null;
  return { partages: { some: { equipeId: { in: ids } } } };
}

export type RaidMentionCandidate = {
  id: string;
  nom_complet: string;
  role: string;
  equipeName: string;
  hasAccount: boolean;
};

type MentionAcc = {
  id: string;
  nom_complet: string;
  roles: Set<string>;
  equipes: Set<string>;
};

function pushMention(
  map: Map<string, MentionAcc>,
  ressource: { id: string; nom_complet: string },
  role: string,
  equipeName: string
) {
  const name = ressource.nom_complet?.trim();
  if (!name) return;
  let row = map.get(ressource.id);
  if (!row) {
    row = { id: ressource.id, nom_complet: name, roles: new Set(), equipes: new Set() };
    map.set(ressource.id, row);
  }
  if (role.trim()) row.roles.add(role.trim());
  if (equipeName.trim()) row.equipes.add(equipeName.trim());
}

/**
 * People who can be @mentioned: members of the responsible team(s)
 * (owner functional team, plus the institutional linked team when the
 * assignee is outside the chantier) and members of teams the RAID is shared with.
 */
export async function listRaidMentionCandidates(raid: {
  id: string;
  chantierId: string | null;
  equipeId: string | null;
}): Promise<RaidMentionCandidate[]> {
  const map = new Map<string, MentionAcc>();
  const ownerId = await getOwnerFunctionalEquipeId(raid.chantierId);

  const partages = await prisma.raidPartage.findMany({
    where: { raidId: raid.id },
    select: { equipeId: true },
  });
  const functionalIds = new Set<string>();
  if (ownerId) functionalIds.add(ownerId);
  for (const p of partages) functionalIds.add(p.equipeId);

  if (functionalIds.size > 0) {
    const teams = await prisma.equipe.findMany({
      where: {
        id: { in: [...functionalIds] },
        type: EQUIPE_TYPES.fonctionnelle,
        chantierId: { not: null },
      },
      select: { id: true, name: true, chantierId: true },
    });
    const teamByChantier = new Map(
      teams
        .filter((t) => t.chantierId)
        .map((t) => [t.chantierId as string, t])
    );
    const chantierIds = [...teamByChantier.keys()];
    if (chantierIds.length > 0) {
      const membres = await prisma.membreEquipe.findMany({
        where: { chantierId: { in: chantierIds } },
        select: {
          role: true,
          chantierId: true,
          ressource: {
            select: { id: true, nom_complet: true, actif: true },
          },
        },
      });
      for (const m of membres) {
        if (!m.ressource.actif) continue;
        const team = teamByChantier.get(m.chantierId);
        if (!team) continue;
        pushMention(map, m.ressource, m.role, team.name);
      }
    }
  }

  if (raid.equipeId && raid.equipeId !== ownerId) {
    const linked = await prisma.equipe.findUnique({
      where: { id: raid.equipeId },
      select: { id: true, name: true, type: true },
    });
    if (linked && linked.type === EQUIPE_TYPES.institutionnelle) {
      const ressources = await prisma.ressource.findMany({
        where: { equipeHierarchieId: linked.id, actif: true },
        select: { id: true, nom_complet: true },
      });
      for (const r of ressources) {
        pushMention(map, r, "", linked.name);
      }
    }
  }

  const ids = [...map.keys()];
  const users =
    ids.length === 0
      ? []
      : await prisma.user.findMany({
          where: { ressourceId: { in: ids }, is_active: true },
          select: { ressourceId: true },
        });
  const withAccount = new Set(
    users.map((u) => u.ressourceId).filter((id): id is string => !!id)
  );

  return [...map.values()]
    .map((row) => ({
      id: row.id,
      nom_complet: row.nom_complet,
      role: [...row.roles].join(" · "),
      equipeName: [...row.equipes].join(" · "),
      hasAccount: withAccount.has(row.id),
    }))
    .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, "fr"));
}

export type RaidShareTarget = {
  id: string;
  name: string;
  chantierCode: string;
  chantierNom: string;
  domaine: string;
  statut: string;
  priorite: string;
  avancement: number;
  membres: number;
  directeur: string;
  dateDebut: string;
  dateFin: string;
};

/** Other active functional teams this RAID can be shared with. */
export async function listRaidShareTargets(raid: {
  chantierId: string | null;
  id: string;
}): Promise<RaidShareTarget[]> {
  if (!raid.chantierId) return [];
  const [ownerId, existing] = await Promise.all([
    getOwnerFunctionalEquipeId(raid.chantierId),
    prisma.raidPartage.findMany({
      where: { raidId: raid.id },
      select: { equipeId: true },
    }),
  ]);
  const taken = new Set(existing.map((p) => p.equipeId));
  if (ownerId) taken.add(ownerId);

  const teams = await prisma.equipe.findMany({
    where: {
      type: EQUIPE_TYPES.fonctionnelle,
      is_active: true,
      chantierId: { not: null },
      ...(taken.size > 0 ? { id: { notIn: [...taken] } } : {}),
    },
    select: {
      id: true,
      name: true,
      chantier: {
        select: {
          code: true,
          nom: true,
          domaine: true,
          statut: true,
          priorite: true,
          avancement: true,
          directeur: true,
          date_debut: true,
          date_fin: true,
          _count: { select: { membres: true } },
          membres: {
            where: { is_directeur: true },
            select: { ressource: { select: { nom_complet: true } } },
          },
        },
      },
    },
    orderBy: { chantier: { code: "asc" } },
  });

  return teams
    .filter((t) => t.chantier)
    .map((t) => {
      const chantier = t.chantier!;
      const directeurs = chantier.membres
        .map((m) => m.ressource?.nom_complet?.trim() ?? "")
        .filter(Boolean);
      return {
        id: t.id,
        name: t.name,
        chantierCode: chantier.code,
        chantierNom: chantier.nom,
        domaine: chantier.domaine,
        statut: chantier.statut,
        priorite: chantier.priorite,
        avancement: chantier.avancement ?? 0,
        membres: chantier._count.membres,
        directeur: directeurs.join(" · ") || chantier.directeur.trim(),
        dateDebut: chantier.date_debut.toISOString(),
        dateFin: chantier.date_fin.toISOString(),
      };
    });
}
