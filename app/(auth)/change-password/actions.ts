"use server";

import { prisma } from "@/lib/prisma";
import {
  getSession,
  verifyPassword,
  hashPassword,
  validatePasswordComplexity,
} from "@/lib/auth";
import { redirect } from "next/navigation";

export async function changePasswordAction(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const currentPassword = formData.get("current_password") as string;
  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Tous les champs sont requis." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Les mots de passe ne correspondent pas." };
  }

  const complexityError = validatePasswordComplexity(newPassword);
  if (complexityError) return { error: complexityError };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    redirect("/login");
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return { error: "Mot de passe actuel incorrect." };
  }

  const hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: hash, must_change_pwd: false },
  });

  // Update session
  session.mustChangePwd = false;
  await session.save();

  redirect("/");
}
