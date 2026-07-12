"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requirePageAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireComiteParametresAdmin() {
  await requireRole("Admin");
  return requirePageAccess("/admin/comites-parametres");
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function validatePayload(data: {
  name: string;
  description?: string;
  frequency?: string;
  owner?: string;
  short_label?: string;
  color?: string;
  position?: number;
  is_active?: boolean;
}) {
  const name = normalizeName(data.name ?? "");
  if (!name) throw new Error("Le nom du comité est obligatoire.");
  if (name.length > 120) throw new Error("Le nom ne peut pas dépasser 120 caractères.");

  const color = (data.color ?? "#6b7280").trim() || "#6b7280";
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    throw new Error("Couleur invalide (format #RGB ou #RRGGBB).");
  }

  const position =
    typeof data.position === "number" && Number.isFinite(data.position)
      ? Math.max(0, Math.floor(data.position))
      : 0;

  return {
    name,
    description: (data.description ?? "").trim(),
    frequency: (data.frequency ?? "").trim(),
    owner: (data.owner ?? "").trim(),
    short_label: (data.short_label ?? "").trim(),
    color,
    position,
    is_active: data.is_active !== false,
  };
}

export async function getComiteParametresForAdmin() {
  await requireComiteParametresAdmin();
  return prisma.comiteParametre.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

/**
 * Catalog for forms / filters (any role that can open comités).
 * By default returns all rows (active + inactive) so labels/colors stay available
 * for existing meetings; create form filters to active only.
 */
export async function getComiteParametresForSelect(opts?: {
  activeOnly?: boolean;
}) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  return prisma.comiteParametre.findMany({
    where: opts?.activeOnly ? { is_active: true } : undefined,
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      frequency: true,
      owner: true,
      short_label: true,
      color: true,
      position: true,
      is_active: true,
    },
  });
}

export async function createComiteParametre(data: {
  name: string;
  description?: string;
  frequency?: string;
  owner?: string;
  short_label?: string;
  color?: string;
  position?: number;
  is_active?: boolean;
}) {
  await requireComiteParametresAdmin();
  const payload = validatePayload(data);

  const existing = await prisma.comiteParametre.findUnique({
    where: { name: payload.name },
  });
  if (existing) {
    throw new Error("Un type de comité avec ce nom existe déjà.");
  }

  // Default position = end of list
  if (data.position === undefined || data.position === null) {
    const last = await prisma.comiteParametre.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    payload.position = (last?.position ?? -1) + 1;
  }

  await prisma.comiteParametre.create({ data: payload });
  revalidatePath("/admin/comites-parametres");
  revalidatePath("/comites");
  revalidatePath("/calendrier");
}

export async function updateComiteParametre(
  id: string,
  data: {
    name: string;
    description?: string;
    frequency?: string;
    owner?: string;
    short_label?: string;
    color?: string;
    position?: number;
    is_active?: boolean;
  }
) {
  await requireComiteParametresAdmin();
  const payload = validatePayload(data);

  const current = await prisma.comiteParametre.findUnique({ where: { id } });
  if (!current) throw new Error("Type de comité introuvable.");

  const clash = await prisma.comiteParametre.findFirst({
    where: { name: payload.name, NOT: { id } },
  });
  if (clash) {
    throw new Error("Un type de comité avec ce nom existe déjà.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.comiteParametre.update({
      where: { id },
      data: payload,
    });
    // Keep meeting rows in sync when the instance name changes
    if (current.name !== payload.name) {
      await tx.comite.updateMany({
        where: { instance: current.name },
        data: { instance: payload.name },
      });
    }
  });

  revalidatePath("/admin/comites-parametres");
  revalidatePath("/comites");
  revalidatePath("/calendrier");
  revalidatePath("/raid");
}

export async function setComiteParametreActive(id: string, is_active: boolean) {
  await requireComiteParametresAdmin();
  await prisma.comiteParametre.update({
    where: { id },
    data: { is_active },
  });
  revalidatePath("/admin/comites-parametres");
  revalidatePath("/comites");
}

export async function deleteComiteParametre(id: string) {
  await requireComiteParametresAdmin();
  const current = await prisma.comiteParametre.findUnique({ where: { id } });
  if (!current) throw new Error("Type de comité introuvable.");

  const usage = await prisma.comite.count({
    where: { instance: current.name },
  });
  if (usage > 0) {
    throw new Error(
      `Impossible de supprimer : ${usage} séance(s) de comité utilisent encore « ${current.name} ». Désactivez-le ou renommez les séances.`
    );
  }

  await prisma.comiteParametre.delete({ where: { id } });
  revalidatePath("/admin/comites-parametres");
  revalidatePath("/comites");
}
