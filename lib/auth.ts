import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// ── Types ──────────────────────────────────────────────

export type Role = "Admin" | "Programme_Office" | "PMO_Chantier" | "Workforce_Manager";

export type DashboardType = "complete" | "limited";

export interface SessionData {
  userId: string;
  username: string;
  role: Role;
  mustChangePwd: boolean;
  ressourceId: string | null;
  dashboardType: DashboardType;
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

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  if (session.mustChangePwd) {
    redirect("/change-password");
  }
  return session as SessionData;
}

export async function requireRole(
  ...allowedRoles: Role[]
): Promise<SessionData> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    throw new Error("Accès non autorisé");
  }
  return session;
}

export async function requireChantierAccess(
  chantierId: string
): Promise<SessionData> {
  const session = await requireAuth();

  // Admin and Programme_Office have global access
  if (session.role === "Admin" || session.role === "Programme_Office") {
    return session;
  }

  // PMO_Chantier: check MembreEquipe link via ressourceId
  if (session.role === "PMO_Chantier" && session.ressourceId) {
    const membre = await prisma.membreEquipe.findFirst({
      where: {
        chantierId,
        ressourceId: session.ressourceId,
      },
    });
    if (membre) return session;
  }

  throw new Error("Accès au chantier non autorisé");
}

// ── Helper: get user's accessible chantier IDs ─────────

export async function getUserChantierIds(
  session: SessionData
): Promise<string[] | "all"> {
  if (session.role === "Admin" || session.role === "Programme_Office") {
    return "all";
  }

  if (session.role === "PMO_Chantier" && session.ressourceId) {
    const membres = await prisma.membreEquipe.findMany({
      where: { ressourceId: session.ressourceId },
      select: { chantierId: true },
    });
    return membres.map((m) => m.chantierId);
  }

  // Workforce_Manager: no chantier access by default
  return [];
}
