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

async function resolveOwnerFromEquipe(equipeId: string | null | undefined) {
  if (!equipeId) {
    return { equipeId: null as string | null, owner: "" };
  }
  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } });
  if (!equipe) {
    throw new Error(
      "Équipe introuvable. Créez-la dans Administration → Équipes."
    );
  }
  if (!equipe.is_active) {
    // Allow keeping inactive team on existing rows; creation path checks separately
  }
  return { equipeId: equipe.id, owner: equipe.name };
}

function validatePayload(data: {
  name: string;
  description?: string;
  frequency?: string;
  equipeId?: string | null;
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
    equipeId: data.equipeId?.trim() || null,
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
    include: {
      equipe: {
        select: { id: true, name: true, is_active: true },
      },
    },
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
      equipeId: true,
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
  equipeId?: string | null;
  short_label?: string;
  color?: string;
  position?: number;
  is_active?: boolean;
}) {
  await requireComiteParametresAdmin();
  const base = validatePayload(data);

  if (!base.equipeId) {
    throw new Error("Le propriétaire (équipe) est obligatoire.");
  }

  const existing = await prisma.comiteParametre.findUnique({
    where: { name: base.name },
  });
  if (existing) {
    throw new Error("Un type de comité avec ce nom existe déjà.");
  }

  const equipe = await prisma.equipe.findUnique({
    where: { id: base.equipeId },
  });
  if (!equipe || !equipe.is_active) {
    throw new Error(
      "Sélectionnez une équipe active (Administration → Équipes)."
    );
  }

  // Default position = end of list
  let position = base.position;
  if (data.position === undefined || data.position === null) {
    const last = await prisma.comiteParametre.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = (last?.position ?? -1) + 1;
  }

  await prisma.comiteParametre.create({
    data: {
      name: base.name,
      description: base.description,
      frequency: base.frequency,
      short_label: base.short_label,
      color: base.color,
      position,
      is_active: base.is_active,
      equipeId: equipe.id,
      owner: equipe.name,
    },
  });
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
    equipeId?: string | null;
    short_label?: string;
    color?: string;
    position?: number;
    is_active?: boolean;
  }
) {
  await requireComiteParametresAdmin();
  const base = validatePayload(data);

  const current = await prisma.comiteParametre.findUnique({ where: { id } });
  if (!current) throw new Error("Type de comité introuvable.");

  if (!base.equipeId) {
    throw new Error("Le propriétaire (équipe) est obligatoire.");
  }

  const clash = await prisma.comiteParametre.findFirst({
    where: { name: base.name, NOT: { id } },
  });
  if (clash) {
    throw new Error("Un type de comité avec ce nom existe déjà.");
  }

  const { equipeId, owner } = await resolveOwnerFromEquipe(base.equipeId);
  // When changing team, require active; when keeping same inactive team, allow
  if (equipeId && equipeId !== current.equipeId) {
    const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } });
    if (!equipe?.is_active) {
      throw new Error(
        "Sélectionnez une équipe active (Administration → Équipes)."
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.comiteParametre.update({
      where: { id },
      data: {
        name: base.name,
        description: base.description,
        frequency: base.frequency,
        short_label: base.short_label,
        color: base.color,
        position: base.position,
        is_active: base.is_active,
        equipeId,
        owner,
      },
    });
    // Keep meeting rows in sync when the instance name changes
    if (current.name !== base.name) {
      await tx.comite.updateMany({
        where: { instance: current.name },
        data: { instance: base.name },
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
