import { createPrismaClient } from "@/lib/create-prisma";
import type { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaModelStamp?: string;
};

/**
 * Bump whenever the Prisma schema gains fields/models so HMR drops a stale
 * singleton (otherwise findUnique/update rejects unknown fields).
 */
const PRISMA_MODEL_STAMP = "raid-soft-delete-v1";

function clientLooksCurrent(client: PrismaClient): boolean {
  try {
    const c = client as unknown as {
      user?: unknown;
      appRole?: { findFirst?: unknown };
      mailServerConfig?: { findFirst?: unknown };
      comiteParametre?: { findMany?: unknown };
      equipe?: { findMany?: unknown };
      ressourceEquipeFonctionnelle?: { findMany?: unknown };
      raidComment?: { findMany?: unknown };
      raidAuditLog?: { findMany?: unknown };
      raidFieldOption?: { findMany?: unknown };
      equipeRaidCategorieAccess?: { findMany?: unknown };
      raidCodeSequence?: { findFirst?: unknown };
      notification?: { findMany?: unknown };
      workflowRequest?: { findMany?: unknown };
      workstreamTemplate?: { findMany?: unknown };
      activiteTemplate?: { findMany?: unknown };
      workstream?: { findMany?: unknown };
      activite?: { findMany?: unknown };
      userChantierConsultation?: { findMany?: unknown };
      adherenceDependant?: { findMany?: unknown };
      _runtimeDataModel?: {
        models?: Record<
          string,
          { fields?: Record<string, unknown> | Array<{ name: string }> }
        >;
      };
    };
    // Force recreate when new models are missing (stale HMR singleton).
    if (!c.user) return false;
    if (typeof c.appRole?.findFirst !== "function") return false;
    if (typeof c.mailServerConfig?.findFirst !== "function") return false;
    if (typeof c.comiteParametre?.findMany !== "function") return false;
    if (typeof c.equipe?.findMany !== "function") return false;
    if (typeof c.ressourceEquipeFonctionnelle?.findMany !== "function") return false;
    if (typeof c.raidComment?.findMany !== "function") return false;
    if (typeof c.raidAuditLog?.findMany !== "function") return false;
    if (typeof c.raidFieldOption?.findMany !== "function") return false;
    if (typeof c.equipeRaidCategorieAccess?.findMany !== "function") return false;
    if (typeof c.raidCodeSequence?.findFirst !== "function") return false;
    if (typeof c.notification?.findMany !== "function") return false;
    if (typeof c.workflowRequest?.findMany !== "function") return false;
    if (typeof c.workstreamTemplate?.findMany !== "function") return false;
    if (typeof c.activiteTemplate?.findMany !== "function") return false;
    if (typeof c.workstream?.findMany !== "function") return false;
    if (typeof c.activite?.findMany !== "function") return false;
    if (typeof c.userChantierConsultation?.findMany !== "function") return false;
    if (typeof c.adherenceDependant?.findMany !== "function") return false;

    const comiteModel = c._runtimeDataModel?.models?.Comite;
    if (comiteModel?.fields) {
      const fields = comiteModel.fields;
      const hasChantierId = Array.isArray(fields)
        ? fields.some((f) => f.name === "chantierId")
        : "chantierId" in fields;
      if (!hasChantierId) return false;
    }
    const comiteParamModel = c._runtimeDataModel?.models?.ComiteParametre;
    if (comiteParamModel?.fields) {
      const fields = comiteParamModel.fields;
      const hasNiveau = Array.isArray(fields)
        ? fields.some((f) => f.name === "niveau")
        : "niveau" in fields;
      if (!hasNiveau) return false;
    }

    const chantierModel = c._runtimeDataModel?.models?.Chantier;
    if (chantierModel?.fields) {
      const fields = chantierModel.fields;
      const hasLien = Array.isArray(fields)
        ? fields.some((f) => f.name === "lien_espace_documentaire")
        : "lien_espace_documentaire" in fields;
      if (!hasLien) return false;
    }

    const raidModel = c._runtimeDataModel?.models?.Raid;
    if (raidModel?.fields) {
      const fields = raidModel.fields;
      const hasCode = Array.isArray(fields)
        ? fields.some((f) => f.name === "code")
        : "code" in fields;
      if (!hasCode) return false;
      const hasMaitrise = Array.isArray(fields)
        ? fields.some((f) => f.name === "niveau_maitrise")
        : "niveau_maitrise" in fields;
      if (!hasMaitrise) return false;
      const hasRisqueLie = Array.isArray(fields)
        ? fields.some((f) => f.name === "risqueLieId")
        : "risqueLieId" in fields;
      if (!hasRisqueLie) return false;
      const hasRaidDeletedAt = Array.isArray(fields)
        ? fields.some((f) => f.name === "deletedAt")
        : "deletedAt" in fields;
      if (!hasRaidDeletedAt) return false;
    }

    const adherenceModel = c._runtimeDataModel?.models?.Adherence;
    if (adherenceModel?.fields) {
      const fields = adherenceModel.fields;
      const hasDeletedAt = Array.isArray(fields)
        ? fields.some((f) => f.name === "deletedAt")
        : "deletedAt" in fields;
      if (!hasDeletedAt) return false;
    }

    return true;
  } catch {
    return false;
  }
}

function getClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  const stampOk = globalForPrisma.prismaModelStamp === PRISMA_MODEL_STAMP;

  if (cached && stampOk && clientLooksCurrent(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaModelStamp = PRISMA_MODEL_STAMP;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
