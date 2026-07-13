import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  getRoleByCode,
  resolveRaidCreateScope,
  roleCanAccessPage,
  type RaidCreateScope,
} from "@/lib/roles";

// ── Types ──────────────────────────────────────────────

/** Role code (dynamic — matches AppRole.code). */
export type Role = string;

export type DashboardType = "complete" | "limited";

export interface SessionData {
  userId: string;
  username: string;
  role: Role;
  mustChangePwd: boolean;
  ressourceId: string | null;
  dashboardType: DashboardType;
  /** File-based system maintenance user (not in DB). */
  isMaintenance?: boolean;
}

// ── iron-session config ────────────────────────────────

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "pmo_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8, // 8 hours
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// ── Password utilities ─────────────────────────────────

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

export function validatePasswordComplexity(password: string): string | null {
  if (!PASSWORD_REGEX.test(password)) {
    return "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Brute-force protection ─────────────────────────────

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function checkAndIncrementAttempts(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return true;

  if (user.locked_until && user.locked_until > new Date()) {
    return true;
  }

  if (user.failed_attempts + 1 >= MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        locked_until: new Date(Date.now() + LOCK_DURATION_MS),
        failed_attempts: 0,
      },
    });
    return true;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { failed_attempts: { increment: 1 } },
  });
  return false;
}

export async function resetAttempts(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { failed_attempts: 0, locked_until: null },
  });
}

// ── Auth guards ────────────────────────────────────────

export function isMaintenanceSession(
  session: Partial<SessionData> | null | undefined
): boolean {
  return !!session?.isMaintenance;
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  // Maintenance user is confined to /maintenance/*
  if (session.isMaintenance) {
    redirect("/maintenance/db");
  }
  if (session.mustChangePwd) {
    redirect("/change-password");
  }
  return session as SessionData;
}

/** Auth for the critical DB maintenance console only. */
export async function requireMaintenanceAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId || !session.isMaintenance) {
    redirect("/login");
  }
  return session as SessionData;
}

/**
 * Maps legacy requireRole(...codes) call signatures to a page capability.
 * Custom roles gain access when they have the corresponding page permission.
 */
function capabilityPageForRoles(allowedRoles: string[]): string | null {
  const set = new Set(allowedRoles);
  const has = (...codes: string[]) => codes.every((c) => set.has(c));

  // Admin only
  if (set.size === 1 && set.has("Admin")) return "/admin/users";

  // Admin + Workforce only
  if (has("Admin", "Workforce_Manager") && set.size === 2) return "/profils";

  // Admin + Programme + Workforce (no PMO)
  if (
    has("Admin", "Programme_Office", "Workforce_Manager") &&
    !set.has("PMO_Chantier")
  ) {
    return "/ressources";
  }

  // All standard operational roles
  if (
    has("Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager") ||
    (has("Admin", "Programme_Office", "PMO_Chantier") && set.has("Workforce_Manager"))
  ) {
    return "/";
  }

  // Programme + PMO style (no workforce exclusive)
  if (has("Admin", "Programme_Office", "PMO_Chantier")) return "/chantiers";

  // Programme office + Admin
  if (has("Admin", "Programme_Office") && set.size === 2) return "/dashboards";

  // Fallback: first non-admin code or home
  return "/";
}

/**
 * Guard by role codes (backward compatible) OR by mapped page permission
 * so custom dynamic roles work when granted the right pages.
 */
export async function requireRole(
  ...allowedRoles: string[]
): Promise<SessionData> {
  const session = await requireAuth();

  if (allowedRoles.includes(session.role)) {
    return session;
  }

  // Admin always allowed when Admin is among the accepted roles
  if (session.role === "Admin" && allowedRoles.includes("Admin")) {
    return session;
  }

  const page = capabilityPageForRoles(allowedRoles);
  if (page) {
    const role = await getRoleByCode(session.role);
    if (roleCanAccessPage(role, page)) {
      return session;
    }
  }

  throw new Error("Accès non autorisé");
}

/** Guard by explicit page path(s) — preferred for new code. */
export async function requirePageAccess(
  ...paths: string[]
): Promise<SessionData> {
  const session = await requireAuth();
  const role = await getRoleByCode(session.role);

  for (const path of paths) {
    if (roleCanAccessPage(role, path)) {
      return session;
    }
  }

  throw new Error("Accès non autorisé");
}

export async function requireChantierAccess(
  chantierId: string
): Promise<SessionData> {
  const session = await requireAuth();
  const role = await getRoleByCode(session.role);

  if (!role || !role.is_active) {
    throw new Error("Accès au chantier non autorisé");
  }

  if (role.chantier_scope === "all" || role.code === "Admin") {
    return session;
  }

  if (role.chantier_scope === "assigned" && session.ressourceId) {
    const membre = await prisma.membreEquipe.findFirst({
      where: {
        chantierId,
        ressourceId: session.ressourceId,
      },
    });
    if (membre) return session;
  }

  // Legacy fallback for known codes if role row missing scope
  if (session.role === "Admin" || session.role === "Programme_Office") {
    return session;
  }
  if (session.role === "PMO_Chantier" && session.ressourceId) {
    const membre = await prisma.membreEquipe.findFirst({
      where: { chantierId, ressourceId: session.ressourceId },
    });
    if (membre) return session;
  }

  throw new Error("Accès au chantier non autorisé");
}

/**
 * Guard for creating RAID entries based on AppRole.raid_create_scope.
 * - programme: any chantier (including none)
 * - chantier: only if chantierId is set and user is MembreEquipe via their Ressource
 * - none: denied
 */
export async function requireRaidCreateAccess(
  chantierId: string | null | undefined
): Promise<SessionData> {
  const session = await requireAuth();
  const role = await getRoleByCode(session.role);
  const scope = resolveRaidCreateScope(role);

  if (scope === "none") {
    throw new Error(
      "Création RAID non autorisée pour votre rôle. Contactez un administrateur."
    );
  }

  if (scope === "programme") {
    return session;
  }

  // Niveau Chantier
  if (!chantierId) {
    throw new Error(
      "Sélectionnez un chantier : votre rôle ne permet la création RAID qu'au niveau des chantiers auxquels vous êtes rattaché."
    );
  }
  if (!session.ressourceId) {
    throw new Error(
      "Votre compte n'est lié à aucune ressource : impossible de créer une entrée RAID au niveau chantier."
    );
  }

  const membre = await prisma.membreEquipe.findFirst({
    where: { chantierId, ressourceId: session.ressourceId },
    select: { id: true },
  });
  if (!membre) {
    throw new Error(
      "Vous n'êtes pas rattaché à ce chantier en tant que ressource : création RAID refusée."
    );
  }

  return session;
}

export async function getRaidCreateScopeForSession(): Promise<RaidCreateScope> {
  const session = await requireAuth();
  const role = await getRoleByCode(session.role);
  return resolveRaidCreateScope(role);
}

// ── Helper: get user's accessible chantier IDs ─────────

export async function getUserChantierIds(
  session: SessionData
): Promise<string[] | "all"> {
  const role = await getRoleByCode(session.role);

  const scope =
    role?.chantier_scope ??
    (session.role === "Admin" || session.role === "Programme_Office"
      ? "all"
      : session.role === "PMO_Chantier"
        ? "assigned"
        : "none");

  if (scope === "all") return "all";

  if (scope === "assigned" && session.ressourceId) {
    const membres = await prisma.membreEquipe.findMany({
      where: { ressourceId: session.ressourceId },
      select: { chantierId: true },
    });
    return membres.map((m) => m.chantierId);
  }

  return [];
}
