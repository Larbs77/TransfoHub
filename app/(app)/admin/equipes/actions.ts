"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requirePageAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireEquipesAdmin() {
  await requireRole("Admin");
  return requirePageAccess("/admin/equipes");
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function validatePayload(data: {
  name: string;
  description?: string;
  position?: number;
  is_active?: boolean;
}) {
  const name = normalizeName(data.name ?? "");
  if (!name) throw new Error("Le nom de l'équipe est obligatoire.");
  if (name.length > 120) {
    throw new Error("Le nom ne peut pas dépasser 120 caractères.");
  }

  const position =
    typeof data.position === "number" && Number.isFinite(data.position)
      ? Math.max(0, Math.floor(data.position))
      : 0;

  return {
    name,
    description: (data.description ?? "").trim(),
    position,
    is_active: data.is_active !== false,
  };
}

export async function getEquipesForAdmin() {
  await requireEquipesAdmin();
  const rows = await prisma.equipe.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { comiteParametres: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    position: r.position,
    is_active: r.is_active,
    comiteCount: r._count.comiteParametres,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Teams catalog for selects (ressources, comités, users).
 * Readable by roles that manage people or governance catalogs.
 */
export async function getEquipesForSelect(opts?: { activeOnly?: boolean }) {
  await requireRole(
    "Admin",
    "Programme_Office",
    "Workforce_Manager",
    "PMO_Chantier"
  );
  return prisma.equipe.findMany({
    where: opts?.activeOnly === false ? undefined : { is_active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      position: true,
      is_active: true,
    },
  });
}

export async function createEquipe(data: {
  name: string;
  description?: string;
  position?: number;
  is_active?: boolean;
}) {
  await requireEquipesAdmin();
  const payload = validatePayload(data);

  const existing = await prisma.equipe.findUnique({
    where: { name: payload.name },
  });
  if (existing) throw new Error("Une équipe avec ce nom existe déjà.");

  if (data.position === undefined || data.position === null) {
    const last = await prisma.equipe.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    payload.position = (last?.position ?? -1) + 1;
  }

  await prisma.equipe.create({ data: payload });
  revalidatePath("/admin/equipes");
  revalidatePath("/admin/comites-parametres");
}

export async function updateEquipe(
  id: string,
  data: {
    name: string;
    description?: string;
    position?: number;
    is_active?: boolean;
  }
) {
  await requireEquipesAdmin();
  const payload = validatePayload(data);

  const current = await prisma.equipe.findUnique({ where: { id } });
  if (!current) throw new Error("Équipe introuvable.");

  const clash = await prisma.equipe.findFirst({
    where: { name: payload.name, NOT: { id } },
  });
  if (clash) throw new Error("Une équipe avec ce nom existe déjà.");

  await prisma.$transaction(async (tx) => {
    await tx.equipe.update({ where: { id }, data: payload });
    // Keep denormalized owner on committee types in sync
    if (current.name !== payload.name) {
      await tx.comiteParametre.updateMany({
        where: { equipeId: id },
        data: { owner: payload.name },
      });
    }
  });

  revalidatePath("/admin/equipes");
  revalidatePath("/admin/comites-parametres");
  revalidatePath("/comites");
}

export async function setEquipeActive(id: string, is_active: boolean) {
  await requireEquipesAdmin();
  await prisma.equipe.update({
    where: { id },
    data: { is_active },
  });
  revalidatePath("/admin/equipes");
  revalidatePath("/admin/comites-parametres");
}

export async function deleteEquipe(id: string) {
  await requireEquipesAdmin();
  const current = await prisma.equipe.findUnique({ where: { id } });
  if (!current) throw new Error("Équipe introuvable.");

  const usage = await prisma.comiteParametre.count({
    where: { equipeId: id },
  });
  if (usage > 0) {
    throw new Error(
      `Impossible de supprimer : ${usage} type(s) de comité utilisent encore « ${current.name} ». Désactivez l'équipe ou réassignez les propriétaires.`
    );
  }

  await prisma.equipe.delete({ where: { id } });
  revalidatePath("/admin/equipes");
  revalidatePath("/admin/comites-parametres");
}
