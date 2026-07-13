"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requirePageAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { EQUIPE_TYPES, isEquipeType, type EquipeType } from "@/lib/equipe-types";

async function requireEquipesAdmin() {
  await requireRole("Admin");
  return requirePageAccess("/admin/equipes");
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function validateInstitutionnellePayload(data: {
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
    type: EQUIPE_TYPES.institutionnelle as EquipeType,
  };
}

export async function getEquipesForAdmin() {
  await requireEquipesAdmin();
  const rows = await prisma.equipe.findMany({
    orderBy: [{ type: "asc" }, { position: "asc" }, { name: "asc" }],
    include: {
      chantier: { select: { id: true, code: true, nom: true } },
      raidCategorieAccess: {
        select: {
          raidFieldOptionId: true,
          raidFieldOption: {
            select: { id: true, label: true, color: true, kind: true },
          },
        },
      },
      _count: {
        select: {
          comiteParametres: true,
          ressourcesHierarchie: true,
          ressourcesFonctionnelles: true,
          raids: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    position: r.position,
    is_active: r.is_active,
    type: (isEquipeType(r.type) ? r.type : EQUIPE_TYPES.institutionnelle) as EquipeType,
    chantierId: r.chantierId,
    chantier: r.chantier,
    comiteCount: r._count.comiteParametres,
    hierarchieCount: r._count.ressourcesHierarchie,
    fonctionnelCount: r._count.ressourcesFonctionnelles,
    raidCount: r._count.raids,
    /** Special RAID category option IDs (institutionnelle only). */
    raidCategorieOptionIds: r.raidCategorieAccess
      .filter((a) => a.raidFieldOption.kind === "categorie")
      .map((a) => a.raidFieldOptionId),
    raidCategorieLabels: r.raidCategorieAccess
      .filter((a) => a.raidFieldOption.kind === "categorie")
      .map((a) => ({
        id: a.raidFieldOption.id,
        label: a.raidFieldOption.label,
        color: a.raidFieldOption.color,
      })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

async function syncInstitutionalRaidCategorieAccess(
  equipeId: string,
  optionIds: string[] | undefined
) {
  if (optionIds === undefined) return;

  const unique = [...new Set(optionIds.map((id) => id.trim()).filter(Boolean))];

  if (unique.length === 0) {
    await prisma.equipeRaidCategorieAccess.deleteMany({ where: { equipeId } });
    return;
  }

  const valid = await prisma.raidFieldOption.findMany({
    where: { id: { in: unique }, kind: "categorie" },
    select: { id: true },
  });
  const validIds = new Set(valid.map((v) => v.id));
  const toKeep = unique.filter((id) => validIds.has(id));

  await prisma.$transaction(async (tx) => {
    await tx.equipeRaidCategorieAccess.deleteMany({
      where: {
        equipeId,
        ...(toKeep.length > 0
          ? { raidFieldOptionId: { notIn: toKeep } }
          : {}),
      },
    });
    for (const raidFieldOptionId of toKeep) {
      await tx.equipeRaidCategorieAccess.upsert({
        where: {
          equipeId_raidFieldOptionId: { equipeId, raidFieldOptionId },
        },
        create: { equipeId, raidFieldOptionId },
        update: {},
      });
    }
  });
}

/**
 * Teams catalog for selects (ressources hierarchy, comités).
 * Defaults to institutionnelle only — functional teams are chantier-bound.
 */
export async function getEquipesForSelect(opts?: {
  activeOnly?: boolean;
  type?: EquipeType | "all";
}) {
  await requireRole(
    "Admin",
    "Programme_Office",
    "Workforce_Manager",
    "PMO_Chantier"
  );
  const typeFilter =
    opts?.type === "all"
      ? undefined
      : opts?.type === EQUIPE_TYPES.fonctionnelle
        ? EQUIPE_TYPES.fonctionnelle
        : EQUIPE_TYPES.institutionnelle;

  return prisma.equipe.findMany({
    where: {
      ...(opts?.activeOnly === false ? {} : { is_active: true }),
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      position: true,
      is_active: true,
      type: true,
      chantierId: true,
    },
  });
}

export async function createEquipe(data: {
  name: string;
  description?: string;
  position?: number;
  is_active?: boolean;
  /** RaidFieldOption IDs (kind=categorie). Default none. */
  raidCategorieOptionIds?: string[];
}) {
  await requireEquipesAdmin();
  const payload = validateInstitutionnellePayload(data);

  const existing = await prisma.equipe.findUnique({
    where: { name: payload.name },
  });
  if (existing) throw new Error("Une équipe avec ce nom existe déjà.");

  if (data.position === undefined || data.position === null) {
    const last = await prisma.equipe.findFirst({
      where: { type: EQUIPE_TYPES.institutionnelle },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    payload.position = (last?.position ?? -1) + 1;
  }

  const created = await prisma.equipe.create({ data: payload });
  await syncInstitutionalRaidCategorieAccess(
    created.id,
    data.raidCategorieOptionIds ?? []
  );
  revalidatePath("/admin/equipes");
  revalidatePath("/admin/comites-parametres");
  revalidatePath("/raid");
}

export async function updateEquipe(
  id: string,
  data: {
    name: string;
    description?: string;
    position?: number;
    is_active?: boolean;
    /** RaidFieldOption IDs (kind=categorie). Only for institutionnelle. */
    raidCategorieOptionIds?: string[];
  }
) {
  await requireEquipesAdmin();
  const current = await prisma.equipe.findUnique({ where: { id } });
  if (!current) throw new Error("Équipe introuvable.");

  if (current.type === EQUIPE_TYPES.fonctionnelle) {
    // Functional teams: only description / is_active (name follows chantier)
    // No special RAID category access on functional teams.
    await prisma.equipe.update({
      where: { id },
      data: {
        description: (data.description ?? "").trim(),
        is_active: data.is_active !== false,
      },
    });
    revalidatePath("/admin/equipes");
    return;
  }

  const payload = validateInstitutionnellePayload(data);

  const clash = await prisma.equipe.findFirst({
    where: { name: payload.name, NOT: { id } },
  });
  if (clash) throw new Error("Une équipe avec ce nom existe déjà.");

  await prisma.$transaction(async (tx) => {
    await tx.equipe.update({ where: { id }, data: payload });
    if (current.name !== payload.name) {
      await tx.comiteParametre.updateMany({
        where: { equipeId: id },
        data: { owner: payload.name },
      });
    }
  });

  if (data.raidCategorieOptionIds !== undefined) {
    await syncInstitutionalRaidCategorieAccess(id, data.raidCategorieOptionIds);
  }

  revalidatePath("/admin/equipes");
  revalidatePath("/admin/comites-parametres");
  revalidatePath("/comites");
  revalidatePath("/raid");
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

  if (current.type === EQUIPE_TYPES.fonctionnelle) {
    throw new Error(
      "Les équipes fonctionnelles sont liées à un chantier. Supprimez ou archivez le chantier pour les retirer."
    );
  }

  const usage = await prisma.comiteParametre.count({
    where: { equipeId: id },
  });
  if (usage > 0) {
    throw new Error(
      `Impossible de supprimer : ${usage} type(s) de comité utilisent encore « ${current.name} ». Désactivez l'équipe ou réassignez les propriétaires.`
    );
  }

  const hierarchie = await prisma.ressource.count({
    where: { equipeHierarchieId: id },
  });
  if (hierarchie > 0) {
    throw new Error(
      `Impossible de supprimer : ${hierarchie} ressource(s) sont encore rattachées hiérarchiquement à cette équipe.`
    );
  }

  await prisma.equipe.delete({ where: { id } });
  revalidatePath("/admin/equipes");
  revalidatePath("/admin/comites-parametres");
}
