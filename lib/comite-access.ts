import {
  getUserChantierIds,
  getUserMemberChantierIds,
  type SessionData,
} from "@/lib/auth";
import { getRoleByCode } from "@/lib/roles";
import { isComiteNiveauOperationnel } from "@/lib/comite-niveau";

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
