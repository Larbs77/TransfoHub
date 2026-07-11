"use server";

import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  getSession,
  verifyPassword,
  hashPassword,
  validatePasswordComplexity,
} from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getRoleByCode } from "@/lib/roles";
import {
  deleteAvatarFile,
  removeAvatarFilesForUser,
  saveAvatarFile,
} from "@/lib/avatar";

function validatePhone(phone: string): string | null {
  const value = phone.trim();
  if (!value) return null;
  if (!/^[0-9+\-\s().]{6,30}$/.test(value)) {
    return "Numéro de téléphone invalide.";
  }
  return null;
}

function revalidateProfile() {
  revalidatePath("/profil");
  revalidatePath("/");
}

export type ThemePreference = "light" | "dark";

function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "dark" ? "dark" : "light";
}

export async function getMyProfile() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
      phone: true,
      email: true,
      avatar_url: true,
      theme_preference: true,
      role: true,
      dashboard_type: true,
      last_login: true,
      createdAt: true,
      updatedAt: true,
      ressource: { select: { id: true, nom_complet: true } },
    },
  });
  if (!user) throw new Error("Utilisateur introuvable.");

  const role = await getRoleByCode(user.role);

  return {
    ...user,
    theme_preference: normalizeThemePreference(user.theme_preference),
    roleLabel: role?.label ?? user.role,
    roleColor: role?.color ?? "#6b7280",
  };
}

export async function updateMyPhone(phone: string) {
  const session = await requireAuth();
  const phoneError = validatePhone(phone);
  if (phoneError) throw new Error(phoneError);

  await prisma.user.update({
    where: { id: session.userId },
    data: { phone: phone.trim() },
  });

  revalidateProfile();
}

export async function updateMyThemePreference(theme: ThemePreference) {
  const session = await requireAuth();
  const theme_preference = normalizeThemePreference(theme);

  await prisma.user.update({
    where: { id: session.userId },
    data: { theme_preference },
  });

  revalidateProfile();
  return { theme_preference };
}

export async function uploadMyAvatar(formData: FormData) {
  const session = await requireAuth();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Veuillez sélectionner une image.");
  }

  const avatar_url = await saveAvatarFile(session.userId, file);

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatar_url },
  });

  revalidateProfile();
  return { avatar_url };
}

export async function deleteMyAvatar() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatar_url: true },
  });

  if (user?.avatar_url) {
    await deleteAvatarFile(user.avatar_url);
  }
  await removeAvatarFilesForUser(session.userId);

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatar_url: "" },
  });

  revalidateProfile();
}

export async function changeMyPassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const session = await requireAuth();

  if (
    !data.currentPassword ||
    !data.newPassword ||
    !data.confirmPassword
  ) {
    throw new Error("Tous les champs sont requis.");
  }

  if (data.newPassword !== data.confirmPassword) {
    throw new Error("Les mots de passe ne correspondent pas.");
  }

  if (data.currentPassword === data.newPassword) {
    throw new Error(
      "Le nouveau mot de passe doit être différent de l'actuel."
    );
  }

  const complexityError = validatePasswordComplexity(data.newPassword);
  if (complexityError) throw new Error(complexityError);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user) throw new Error("Utilisateur introuvable.");

  const valid = await verifyPassword(
    data.currentPassword,
    user.password_hash
  );
  if (!valid) {
    throw new Error("Mot de passe actuel incorrect.");
  }

  const password_hash = await hashPassword(data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash, must_change_pwd: false },
  });

  const iron = await getSession();
  iron.mustChangePwd = false;
  await iron.save();

  revalidatePath("/profil");
}
