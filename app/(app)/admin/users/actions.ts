"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePageAccess,
  hashPassword,
  validatePasswordComplexity,
} from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUsersAdmin() {
  return requirePageAccess("/admin/users");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return null; // optional
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return ok ? null : "Adresse e-mail invalide.";
}

function validatePhone(phone: string): string | null {
  const value = phone.trim();
  if (!value) return null; // optional
  // Allow digits, spaces, +, -, parentheses
  if (!/^[0-9+\-\s().]{6,30}$/.test(value)) {
    return "Numéro de téléphone invalide.";
  }
  return null;
}

export async function getUsers() {
  await requireUsersAdmin();
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
      phone: true,
      email: true,
      avatar_url: true,
      role: true,
      dashboard_type: true,
      is_active: true,
      must_change_pwd: true,
      failed_attempts: true,
      locked_until: true,
      last_login: true,
      ressourceId: true,
      ressource: { select: { id: true, nom_complet: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createUser(data: {
  username: string;
  password: string;
  role: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  ressourceId?: string | null;
}) {
  await requireUsersAdmin();

  const existing = await prisma.user.findUnique({
    where: { username: data.username },
  });
  if (existing) throw new Error("Ce nom d'utilisateur existe déjà.");

  const appRole = await prisma.appRole.findUnique({
    where: { code: data.role },
  });
  if (!appRole || !appRole.is_active) {
    throw new Error("Rôle invalide ou désactivé.");
  }

  const emailError = validateEmail(data.email ?? "");
  if (emailError) throw new Error(emailError);
  const phoneError = validatePhone(data.phone ?? "");
  if (phoneError) throw new Error(phoneError);

  const complexityError = validatePasswordComplexity(data.password);
  if (complexityError) throw new Error(complexityError);

  const password_hash = await hashPassword(data.password);
  await prisma.user.create({
    data: {
      username: data.username,
      password_hash,
      first_name: data.first_name?.trim() ?? "",
      last_name: data.last_name?.trim() ?? "",
      phone: data.phone?.trim() ?? "",
      email: normalizeEmail(data.email ?? ""),
      role: data.role,
      must_change_pwd: true,
      ressourceId: data.ressourceId || null,
    },
  });
  revalidatePath("/admin/users");
}

export async function updateUserProfile(
  id: string,
  data: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    role?: string;
    dashboard_type?: "complete" | "limited";
    ressourceId?: string | null;
  }
) {
  await requireUsersAdmin();

  const emailError = validateEmail(data.email);
  if (emailError) throw new Error(emailError);
  const phoneError = validatePhone(data.phone);
  if (phoneError) throw new Error(phoneError);

  if (data.role) {
    const appRole = await prisma.appRole.findUnique({
      where: { code: data.role },
    });
    if (!appRole || !appRole.is_active) {
      // Allow keeping current role even if inactive
      const current = await prisma.user.findUnique({ where: { id } });
      if (!current || current.role !== data.role) {
        throw new Error("Rôle invalide ou désactivé.");
      }
    }
  }

  await prisma.user.update({
    where: { id },
    data: {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      phone: data.phone.trim(),
      email: normalizeEmail(data.email),
      ...(data.role ? { role: data.role } : {}),
      ...(data.dashboard_type
        ? { dashboard_type: data.dashboard_type }
        : {}),
      ...(data.ressourceId !== undefined
        ? { ressourceId: data.ressourceId || null }
        : {}),
    },
  });
  revalidatePath("/admin/users");
}

export async function updateUserRole(id: string, role: string) {
  await requireUsersAdmin();

  const appRole = await prisma.appRole.findUnique({ where: { code: role } });
  if (!appRole || !appRole.is_active) {
    throw new Error("Rôle invalide ou désactivé.");
  }

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/admin/users");
}

export async function updateDashboardType(
  id: string,
  dashboardType: "complete" | "limited"
) {
  await requireUsersAdmin();
  await prisma.user.update({
    where: { id },
    data: { dashboard_type: dashboardType },
  });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(id: string) {
  await requireUsersAdmin();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Utilisateur non trouvé.");
  await prisma.user.update({
    where: { id },
    data: { is_active: !user.is_active },
  });
  revalidatePath("/admin/users");
}

export async function resetUserPassword(id: string, newPassword: string) {
  await requireUsersAdmin();
  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) throw new Error(complexityError);

  const password_hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: {
      password_hash,
      must_change_pwd: true,
      failed_attempts: 0,
      locked_until: null,
    },
  });
  revalidatePath("/admin/users");
}

export async function unlockUser(id: string) {
  await requireUsersAdmin();
  await prisma.user.update({
    where: { id },
    data: { failed_attempts: 0, locked_until: null },
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireUsersAdmin();
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}
