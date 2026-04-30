"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword, validatePasswordComplexity } from "@/lib/auth";
import type { Role } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  await requireRole("Admin");
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
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
    },
  });
}

export async function createUser(data: {
  username: string;
  password: string;
  role: Role;
  ressourceId?: string | null;
}) {
  await requireRole("Admin");

  const existing = await prisma.user.findUnique({ where: { username: data.username } });
  if (existing) throw new Error("Ce nom d'utilisateur existe déjà.");

  const complexityError = validatePasswordComplexity(data.password);
  if (complexityError) throw new Error(complexityError);

  const password_hash = await hashPassword(data.password);
  await prisma.user.create({
    data: {
      username: data.username,
      password_hash,
      role: data.role,
      must_change_pwd: true,
      ressourceId: data.ressourceId || null,
    },
  });
  revalidatePath("/admin/users");
}

export async function updateUserRole(id: string, role: Role) {
  await requireRole("Admin");
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/admin/users");
}

export async function updateDashboardType(id: string, dashboardType: "complete" | "limited") {
  await requireRole("Admin");
  await prisma.user.update({ where: { id }, data: { dashboard_type: dashboardType } });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(id: string) {
  await requireRole("Admin");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Utilisateur non trouvé.");
  await prisma.user.update({
    where: { id },
    data: { is_active: !user.is_active },
  });
  revalidatePath("/admin/users");
}

export async function resetUserPassword(id: string, newPassword: string) {
  await requireRole("Admin");
  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) throw new Error(complexityError);

  const password_hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: { password_hash, must_change_pwd: true, failed_attempts: 0, locked_until: null },
  });
  revalidatePath("/admin/users");
}

export async function unlockUser(id: string) {
  await requireRole("Admin");
  await prisma.user.update({
    where: { id },
    data: { failed_attempts: 0, locked_until: null },
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  await requireRole("Admin");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}
