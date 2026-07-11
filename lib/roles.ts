import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ALL_PAGE_PATHS } from "@/lib/app-pages";

export type RoleRecord = {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
  is_active: boolean;
  is_system: boolean;
  chantier_scope: string;
  pages: string[];
  createdAt: Date;
  updatedAt: Date;
};

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
