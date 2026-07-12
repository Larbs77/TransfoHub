"use server";

import { prisma } from "@/lib/prisma";
import {
  requirePageAccess,
  hashPassword,
  validatePasswordComplexity,
} from "@/lib/auth";
import { identityFromRessource } from "@/lib/ressource-user";
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
      ressource: {
        select: {
          id: true,
          nom_complet: true,
          email: true,
          telephone: true,
          equipeHierarchie: { select: { id: true, name: true } },
          equipesFonctionnelles: {
            select: { equipe: { select: { id: true, name: true } } },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** Active resources without an app account — for user creation link. */
export async function getRessourcesWithoutAccount() {
  await requireUsersAdmin();
  return prisma.ressource.findMany({
    where: { user: null, actif: true },
    orderBy: { nom_complet: "asc" },
    select: {
      id: true,
      nom_complet: true,
      email: true,
      telephone: true,
      type: true,
      equipeHierarchieId: true,
    },
  });
}

export type NewRessourcePayload = {
  nom_complet: string;
  email?: string;
  telephone?: string;
  type: string;
  organisation?: string;
  tarif_journalier?: number;
  capacite_jours_mois?: number;
  profilId?: string | null;
  equipeHierarchieId: string;
  equipeFonctionnelleIds?: string[];
};

export async function createUser(data: {
  username: string;
  password: string;
  role: string;
  /** Link to an existing resource without account (required if not creating resource). */
  ressourceId?: string | null;
  /** Create a new resource and attach the account. */
  newRessource?: NewRessourcePayload | null;
}) {
  await requireUsersAdmin();

  const username = data.username.trim();
  if (!username) throw new Error("Le nom d'utilisateur est obligatoire.");

  const existing = await prisma.user.findUnique({
    where: { username },
  });
  if (existing) throw new Error("Ce nom d'utilisateur existe déjà.");

  const appRole = await prisma.appRole.findUnique({
    where: { code: data.role },
  });
  if (!appRole || !appRole.is_active) {
    throw new Error("Rôle invalide ou désactivé.");
  }

  const complexityError = validatePasswordComplexity(data.password);
  if (complexityError) throw new Error(complexityError);

  const hasExisting = !!data.ressourceId?.trim();
  const hasNew = !!data.newRessource?.nom_complet?.trim();
  if (!hasExisting && !hasNew) {
    throw new Error(
      "Choisissez une ressource existante ou créez-en une pour ce compte."
    );
  }
  if (hasExisting && hasNew) {
    throw new Error(
      "Choisissez soit une ressource existante, soit une nouvelle ressource — pas les deux."
    );
  }

  const password_hash = await hashPassword(data.password);

  await prisma.$transaction(async (tx) => {
    let ressourceId: string;
    let identity: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };

    if (hasExisting) {
      const ressource = await tx.ressource.findUnique({
        where: { id: data.ressourceId!.trim() },
        include: { user: { select: { id: true } } },
      });
      if (!ressource) throw new Error("Ressource introuvable.");
      if (ressource.user) {
        throw new Error("Cette ressource a déjà un compte applicatif.");
      }
      ressourceId = ressource.id;
      identity = identityFromRessource(ressource);
    } else {
      const nr = data.newRessource!;
      const equipeId = nr.equipeHierarchieId?.trim();
      if (!equipeId) {
        throw new Error("L'équipe hiérarchique de la ressource est obligatoire.");
      }
      const equipe = await tx.equipe.findUnique({ where: { id: equipeId } });
      if (!equipe || !equipe.is_active) {
        throw new Error("Équipe hiérarchique invalide ou inactive.");
      }
      const nom = nr.nom_complet.trim();
      if (!nom) throw new Error("Le nom de la ressource est obligatoire.");

      const created = await tx.ressource.create({
        data: {
          nom_complet: nom,
          email: (nr.email ?? "").trim(),
          telephone: (nr.telephone ?? "").trim(),
          type: nr.type || "Interne",
          organisation: (nr.organisation ?? "").trim(),
          tarif_journalier: nr.tarif_journalier ?? 0,
          capacite_jours_mois: nr.capacite_jours_mois ?? 20,
          actif: true,
          profilId: nr.profilId || null,
          equipeHierarchieId: equipeId,
        },
      });
      const fnIds = [...new Set((nr.equipeFonctionnelleIds ?? []).filter(Boolean))];
      if (fnIds.length > 0) {
        await tx.ressourceEquipeFonctionnelle.createMany({
          data: fnIds.map((eid) => ({
            ressourceId: created.id,
            equipeId: eid,
          })),
        });
      }
      ressourceId = created.id;
      identity = identityFromRessource(created);
    }

    await tx.user.create({
      data: {
        username,
        password_hash,
        role: data.role,
        must_change_pwd: true,
        ressourceId,
        ...identity,
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/ressources");
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
    /** Changing linked resource is not supported when identity lives on ressource. */
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

  const current = await prisma.user.findUnique({
    where: { id },
    select: { ressourceId: true },
  });

  const first_name = data.first_name.trim();
  const last_name = data.last_name.trim();
  const phone = data.phone.trim();
  const email = normalizeEmail(data.email);
  const nom_complet = `${first_name} ${last_name}`.trim();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        first_name,
        last_name,
        phone,
        email,
        ...(data.role ? { role: data.role } : {}),
        ...(data.dashboard_type
          ? { dashboard_type: data.dashboard_type }
          : {}),
        // Keep existing ressourceId; do not allow unlinking
      },
    });

    // Mirror identity onto the linked resource (master people data)
    if (current?.ressourceId) {
      await tx.ressource.update({
        where: { id: current.ressourceId },
        data: {
          nom_complet: nom_complet || first_name,
          email,
          telephone: phone,
        },
      });
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/ressources");
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
