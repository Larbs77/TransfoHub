import {
  getUserChantierIds,
  getUserMemberChantierIds,
  type SessionData,
} from "@/lib/auth";
import { getRoleByCode } from "@/lib/roles";
import {
  isComiteNiveauOperationnel,
  isComiteSupprime,
  STATUT_COMITE_SUPPRIME,
} from "@/lib/comite-niveau";

export const COMITE_ACTIF_WHERE = {
  statut: { not: STATUT_COMITE_SUPPRIME },
} as const;

export function whereComitesActifs<T extends object>(
  extra?: T
): typeof COMITE_ACTIF_WHERE | { AND: [T, typeof COMITE_ACTIF_WHERE] } {
  if (!extra) return COMITE_ACTIF_WHERE;
  return { AND: [extra, COMITE_ACTIF_WHERE] };
}

export function assertComiteSeanceActive(comite: {
  statut?: string | null;
} | null): void {
  if (!comite) throw new Error("Comité introuvable.");
  if (isComiteSupprime(comite.statut)) {
    throw new Error("Cette séance de comité est supprimée.");
  }
}

/** Admin, or the user who created the séance. */
export function assertCanDeleteComiteSeance(
  session: SessionData,
  comite: { createdByUserId?: string | null }
): void {
  if (session.role === "Admin") return;
  if (comite.createdByUserId && comite.createdByUserId === session.userId) {
    return;
  }
  throw new Error(
    "Seul un administrateur ou le créateur de cette séance peut la supprimer."
  );
}

/** Admin / Bureau Programme / rôle « tous les chantiers ». */
export async function canManageGouvernanceComites(
  session: SessionData
): Promise<boolean> {
  if (session.role === "Admin" || session.role === "Programme_Office") {
    return true;
  }
  const role = await getRoleByCode(session.role);
  return !!(role?.is_active && role.chantier_scope === "all");
}

/** Operational séance on a chantier the user can access, or « tous les chantiers ». */
export async function canManageOperationalComite(
  session: SessionData,
  chantierId: string
): Promise<boolean> {
  if (await canManageGouvernanceComites(session)) return true;
  if (!chantierId) return false;
  const ids = await getUserMemberChantierIds(session);
  if (ids === "all") return true;
  return ids.includes(chantierId);
}

export async function assertCanManageComiteSeance(
  session: SessionData,
  opts: { niveau: string; chantierId: string | null }
): Promise<void> {
  if (isComiteNiveauOperationnel(opts.niveau)) {
    if (!opts.chantierId) {
      throw new Error(
        "Un chantier est obligatoire pour un comité opérationnel."
      );
    }
    const ok = await canManageOperationalComite(session, opts.chantierId);
    if (!ok) {
      throw new Error(
        "Vous ne pouvez agir que sur les comités opérationnels des chantiers auxquels vous êtes rattaché."
      );
    }
    return;
  }
  const ok = await canManageGouvernanceComites(session);
  if (!ok) {
    throw new Error(
      "Les comités de gouvernance sont réservés aux profils « tous les chantiers »."
    );
  }
}

/** Gouvernance (no chantier) + operational séances on accessible chantiers. */
export async function comiteListWhereForSession(session: SessionData): Promise<{
  OR: Array<{ chantierId: null } | { chantierId: { in: string[] } }>;
} | undefined> {
  const ids = await getUserChantierIds(session);
  if (ids === "all") return undefined;
  return {
    OR: [{ chantierId: null }, { chantierId: { in: ids } }],
  };
}

/** Committees the user may attach a RAID to (create/update). Assigned: operational only. */
export async function comiteWritableWhereForSession(
  session: SessionData
): Promise<{ chantierId: { in: string[] } } | undefined> {
  const ids = await getUserMemberChantierIds(session);
  if (ids === "all") return undefined;
  return { chantierId: { in: ids.length ? ids : ["__none__"] } };
}
