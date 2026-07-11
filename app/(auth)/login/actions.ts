"use server";

import { prisma } from "@/lib/prisma";
import {
  getSession,
  verifyPassword,
  checkAndIncrementAttempts,
  resetAttempts,
} from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;
  const rawRedirect = formData.get("redirect") as string;

  if (!username || !password) {
    return { error: "Nom d'utilisateur et mot de passe requis." };
  }

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !user.is_active) {
    return { error: "Identifiants invalides." };
  }

  // Role must exist and be active
  const appRole = await prisma.appRole.findUnique({
    where: { code: user.role },
  });
  if (!appRole || !appRole.is_active) {
    return {
      error:
        "Votre rôle est désactivé ou introuvable. Contactez un administrateur.",
    };
  }

  // Check lock
  if (user.locked_until && user.locked_until > new Date()) {
    const minutes = Math.ceil(
      (user.locked_until.getTime() - Date.now()) / 60000
    );
    return {
      error: `Compte verrouillé. Réessayez dans ${minutes} minute(s).`,
    };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const locked = await checkAndIncrementAttempts(user.id);
    if (locked) {
      return {
        error: "Trop de tentatives. Compte verrouillé pour 15 minutes.",
      };
    }
    return { error: "Identifiants invalides." };
  }

  // Success — reset attempts, update last login
  await resetAttempts(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { last_login: new Date() },
  });

  // Create session
  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.role = user.role;
  session.mustChangePwd = user.must_change_pwd;
  session.ressourceId = user.ressourceId;
  session.dashboardType = (user.dashboard_type as "complete" | "limited") || "complete";
  await session.save();

  if (user.must_change_pwd) {
    redirect("/change-password");
  }

  // Prefer home if allowed, else first granted page
  let pages: string[] = [];
  try {
    pages = Array.isArray(appRole.pages)
      ? (appRole.pages as string[])
      : JSON.parse(String(appRole.pages));
  } catch {
    pages = [];
  }
  if (user.role === "Admin") {
    pages = ["/", ...pages];
  }
  const defaultLanding = pages.includes("/")
    ? "/"
    : pages[0] || "/";
  redirect(rawRedirect || defaultLanding);
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
