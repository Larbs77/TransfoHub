import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ALL_PAGE_PATHS } from "@/lib/app-pages";

export type RaidCreateScope = "none" | "chantier" | "programme";

export type RoleRecord = {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
  is_active: boolean;
  is_system: boolean;
  chantier_scope: string;
  /** programme | chantier | none — who may create RAID entries */
  raid_create_scope: RaidCreateScope;
  /** Jalon workflow: DIRECT | VALIDATION | INTERDIT */
  jalon_create_mode: string;
  jalon_update_mode: string;
  jalon_delete_mode: string;
  workflow_can_approve: boolean;
  workflow_can_reject: boolean;
  workflow_can_view_requests: boolean;
  workflow_can_view_history: boolean;
  workflow_can_view_kpi: boolean;
  pages: string[];
  createdAt: Date;
  updatedAt: Date;
};

export function normalizeRaidCreateScope(value: unknown): RaidCreateScope {
  if (value === "programme" || value === "chantier" || value === "none") {
    return value;
  }
  return "none";
}

/**
 * Effective RAID create permission for a role.
 * Admin always has programme-level create (full rights).
 */
export function resolveRaidCreateScope(
  role: RoleRecord | null | undefined
): RaidCreateScope {
  if (!role || !role.is_active) return "none";
  if (role.code === "Admin") return "programme";
  return normalizeRaidCreateScope(role.raid_create_scope);
}

export function parsePages(pages: unknown): string[] {
  if (Array.isArray(pages)) {
    return pages.filter((p): p is string => typeof p === "string");
  }
  if (typeof pages === "string") {
    try {
      const parsed = JSON.parse(pages) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((p): p is string => typeof p === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRole(row: {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
  is_active: boolean;
  is_system: boolean;
  chantier_scope: string;
  raid_create_scope?: string | null;
  jalon_create_mode?: string | null;
  jalon_update_mode?: string | null;
  jalon_delete_mode?: string | null;
  workflow_can_approve?: boolean | null;
  workflow_can_reject?: boolean | null;
  workflow_can_view_requests?: boolean | null;
  workflow_can_view_history?: boolean | null;
  workflow_can_view_kpi?: boolean | null;
  pages: unknown;
  createdAt: Date;
  updatedAt: Date;
}): RoleRecord {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    color: row.color,
    is_active: row.is_active,
    is_system: row.is_system,
    chantier_scope: row.chantier_scope,
    raid_create_scope: normalizeRaidCreateScope(row.raid_create_scope),
    jalon_create_mode: row.jalon_create_mode ?? "DIRECT",
    jalon_update_mode: row.jalon_update_mode ?? "DIRECT",
    jalon_delete_mode: row.jalon_delete_mode ?? "DIRECT",
    workflow_can_approve: !!row.workflow_can_approve,
    workflow_can_reject: !!row.workflow_can_reject,
    workflow_can_view_requests: !!row.workflow_can_view_requests,
    workflow_can_view_history: !!row.workflow_can_view_history,
    workflow_can_view_kpi: !!row.workflow_can_view_kpi,
    pages: parsePages(row.pages),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const getAllRoles = cache(async (): Promise<RoleRecord[]> => {
  const rows = await prisma.appRole.findMany({
    orderBy: [{ is_system: "desc" }, { label: "asc" }],
  });
  return rows.map(mapRole);
});

export const getActiveRoles = cache(async (): Promise<RoleRecord[]> => {
  const rows = await prisma.appRole.findMany({
    where: { is_active: true },
    orderBy: [{ is_system: "desc" }, { label: "asc" }],
  });
  return rows.map(mapRole);
});

export const getRoleByCode = cache(
  async (code: string): Promise<RoleRecord | null> => {
    const row = await prisma.appRole.findUnique({ where: { code } });
    return row ? mapRole(row) : null;
  }
);

export function roleCanAccessPage(
  role: RoleRecord | null | undefined,
  path: string
): boolean {
  if (!role || !role.is_active) return false;
  // Built-in Admin always has full access
  if (role.code === "Admin") return true;

  const pages = role.pages.length ? role.pages : [];
  if (pages.includes(path)) return true;
  // Prefix match for nested routes (e.g. /chantiers/123, /raid/risques)
  return pages.some(
    (p) => p !== "/" && (path === p || path.startsWith(p + "/"))
  );
}

export function resolveAllowedPages(role: RoleRecord | null): string[] {
  if (!role || !role.is_active) return [];
  if (role.code === "Admin") return [...ALL_PAGE_PATHS];
  return role.pages;
}

export function slugifyRoleCode(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  const cleaned = base || "role";
  // Preserve leading capital style for readability; ensure not empty
  return cleaned
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("_");
}
