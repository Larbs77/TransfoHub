import type { SessionData } from "@/lib/auth";
import { isComiteNiveauGouvernance, isComiteSupprime } from "@/lib/comite-niveau";
import { EQUIPE_TYPES } from "@/lib/equipe-types";
import { prisma } from "@/lib/prisma";
import { getRoleByCode } from "@/lib/roles";

export type AssignChantierChoice = {
  id: string;
  code: string;
  nom: string;
  domaine: string;
  statut: string;
  priorite: string;
  role: string;
};

export type AssignRessourceChoice = {
  id: string;
  nom_complet: string;
  organisation: string;
  equipeInstitutionnelleId: string | null;
  equipeInstitutionnelle: string | null;
  chantiers: AssignChantierChoice[];
};

export type RaidAssignmentContext = {
  /** Rôle « Chantiers assignés » : le choix de chantier s'applique. */
  restricted: boolean;
  governanceLock: boolean;
  governanceLabel: string | null;
  currentChantier: { id: string; code: string; nom: string } | null;
  ressources: AssignRessourceChoice[];
};

export async function isChantierAssignedScope(
  session: SessionData
): Promise<boolean> {
  if (session.role === "Admin") return false;
  const role = await getRoleByCode(session.role);
  return !!(role?.is_active && role.chantier_scope === "assigned");
}

/** True when the séance exists and its instance is not operational. */
export async function governanceComiteInfo(
  comiteId: string | null | undefined
): Promise<{ governance: boolean; label: string | null }> {
  if (!comiteId) return { governance: false, label: null };
  const comite = await prisma.comite.findUnique({
    where: { id: comiteId },
    select: { instance: true, numero: true, statut: true },
  });
  if (!comite || isComiteSupprime(comite.statut)) {
    return { governance: false, label: null };
  }
  const param = await prisma.comiteParametre.findUnique({
    where: { name: comite.instance },
    select: { niveau: true },
  });
  return {
    governance: isComiteNiveauGouvernance(param?.niveau),
    label: `${comite.instance} n°${comite.numero}`,
  };
}

export function governanceChantierError(label: string | null): string {
  const which = label ? ` « ${label} »` : "";
  return `Ce RAID vient du comité de gouvernance${which}. Un rôle « Chantiers assignés » ne peut pas en changer le chantier.`;
}

/**
 * Assigned-scope actors cannot move a governance RAID off its chantier.
 * Scope « tous les chantiers » is unchanged.
 */
export async function assertAssignedScopeKeepsGovernanceChantier(params: {
  session: SessionData;
  existingComiteId: string | null;
  currentChantierId: string | null;
  nextChantierId: string | null;
}): Promise<void> {
  if ((params.currentChantierId || null) === (params.nextChantierId || null)) {
    return;
  }
  if (!(await isChantierAssignedScope(params.session))) return;
  const gov = await governanceComiteInfo(params.existingComiteId);
  if (!gov.governance) return;
  throw new Error(governanceChantierError(gov.label));
}

/**
 * Chantier kept or replaced during assignment.
 * Scope « tous » ignores the requested chantier.
 * A member of the current chantier stays on it.
 */
export function resolveAssignChantierTarget(params: {
  restricted: boolean;
  governance: boolean;
  governanceLabel: string | null;
  currentChantierId: string | null;
  requestedChantierId: string | null | undefined;
  memberChantierIds: string[];
}): { chantierId: string | null; moved: boolean } {
  const current = params.currentChantierId || null;
  if (!params.restricted) return { chantierId: current, moved: false };
  const requested = params.requestedChantierId?.trim() || null;
  if (!requested || requested === current) {
    return { chantierId: current, moved: false };
  }
  if (current && params.memberChantierIds.includes(current)) {
    return { chantierId: current, moved: false };
  }
  if (params.governance) {
    throw new Error(governanceChantierError(params.governanceLabel));
  }
  if (!params.memberChantierIds.includes(requested)) {
    throw new Error("Cette personne n'est pas membre du chantier choisi.");
  }
  return { chantierId: requested, moved: true };
}

function memberRoleLabel(role: string, isDirecteur: boolean): string {
  const trimmed = role.trim();
  if (trimmed) return trimmed;
  return isDirecteur ? "Directeur de chantier" : "Membre";
}

export async function loadRaidAssignmentContext(params: {
  session: SessionData;
  chantierId: string | null;
  comiteId: string | null;
}): Promise<RaidAssignmentContext> {
  const [restricted, gov, chantier, ressources] = await Promise.all([
    isChantierAssignedScope(params.session),
    governanceComiteInfo(params.comiteId),
    params.chantierId
      ? prisma.chantier.findUnique({
          where: { id: params.chantierId },
          select: { id: true, code: true, nom: true },
        })
      : Promise.resolve(null),
    prisma.ressource.findMany({
      where: { actif: true },
      orderBy: { nom_complet: "asc" },
      select: {
        id: true,
        nom_complet: true,
        organisation: true,
        equipeHierarchie: {
          select: { id: true, name: true, type: true, is_active: true },
        },
        membres: {
          select: {
            role: true,
            is_directeur: true,
            chantier: {
              select: {
                id: true,
                code: true,
                nom: true,
                domaine: true,
                statut: true,
                priorite: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    restricted,
    governanceLock: gov.governance,
    governanceLabel: gov.governance ? gov.label : null,
    currentChantier: chantier,
    ressources: ressources.map((r) => {
      const team = r.equipeHierarchie;
      const institutional =
        team &&
        team.is_active &&
        (!team.type || team.type === EQUIPE_TYPES.institutionnelle)
          ? team
          : null;
      const chantiers = r.membres
        .filter((m) => m.chantier)
        .map((m) => ({
          id: m.chantier.id,
          code: m.chantier.code,
          nom: m.chantier.nom,
          domaine: m.chantier.domaine,
          statut: m.chantier.statut,
          priorite: m.chantier.priorite,
          role: memberRoleLabel(m.role, m.is_directeur),
        }))
        .sort((a, b) =>
          a.code.localeCompare(b.code, "fr", { numeric: true })
        );
      return {
        id: r.id,
        nom_complet: r.nom_complet,
        organisation: r.organisation,
        equipeInstitutionnelleId: institutional?.id ?? null,
        equipeInstitutionnelle: institutional?.name ?? null,
        chantiers,
      };
    }),
  };
}
