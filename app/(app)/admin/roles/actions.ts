"use server";

import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ALL_PAGE_PATHS } from "@/lib/app-pages";
import {
  normalizeRaidCreateScope,
  parsePages,
  slugifyRoleCode,
  type RaidCreateScope,
} from "@/lib/roles";
import {
  isWorkflowMode,
  type WorkflowMode,
} from "@/lib/workflow-shared";

async function requireRolesAdmin() {
  return requirePageAccess("/admin/roles", "/admin/users");
}

export async function getRolesForAdmin() {
  await requireRolesAdmin();
  const roles = await prisma.appRole.findMany({
    orderBy: [{ is_system: "desc" }, { label: "asc" }],
  });

  const usage = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });
  const usageMap = Object.fromEntries(
    usage.map((u) => [u.role, u._count._all])
  );

  return roles.map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    description: r.description,
    color: r.color,
    is_active: r.is_active,
    is_system: r.is_system,
    chantier_scope: r.chantier_scope,
    raid_create_scope: normalizeRaidCreateScope(r.raid_create_scope),
    jalon_create_mode: r.jalon_create_mode ?? "DIRECT",
    jalon_update_mode: r.jalon_update_mode ?? "DIRECT",
    jalon_delete_mode: r.jalon_delete_mode ?? "DIRECT",
    workflow_can_approve: !!r.workflow_can_approve,
    workflow_can_reject: !!r.workflow_can_reject,
    workflow_can_view_requests: !!r.workflow_can_view_requests,
    workflow_can_view_history: !!r.workflow_can_view_history,
    workflow_can_view_kpi: !!r.workflow_can_view_kpi,
    pages: parsePages(r.pages),
    userCount: usageMap[r.code] ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getActiveRolesForSelect() {
  // Used by user management — admin users page
  await requirePageAccess("/admin/users", "/admin/roles");
  return prisma.appRole.findMany({
    where: { is_active: true },
    orderBy: [{ is_system: "desc" }, { label: "asc" }],
    select: {
      code: true,
      label: true,
      color: true,
      chantier_scope: true,
    },
  });
}

function normalizePages(pages: string[]): string[] {
  const allowed = new Set(ALL_PAGE_PATHS);
  // Preserve admin choices exactly — do not force-add "/" (Tableau de bord).
  // That was re-enabling home access every time a role was saved without it.
  return [...new Set(pages.filter((p) => allowed.has(p)))];
}

function validateScope(scope: string): string {
  if (scope === "all" || scope === "assigned" || scope === "none") return scope;
  throw new Error("Périmètre chantier invalide.");
}

function validateRaidCreateScope(scope: string): RaidCreateScope {
  if (scope === "none" || scope === "chantier" || scope === "programme") {
    return scope;
  }
  throw new Error("Niveau de création RAID invalide.");
}

function validateWorkflowMode(mode: string, label: string): WorkflowMode {
  if (isWorkflowMode(mode)) return mode;
  throw new Error(`Mode workflow invalide pour ${label}.`);
}

export async function createRole(data: {
  label: string;
  description?: string;
  color?: string;
  chantier_scope: string;
  raid_create_scope?: string;
  jalon_create_mode?: string;
  jalon_update_mode?: string;
  jalon_delete_mode?: string;
  workflow_can_approve?: boolean;
  workflow_can_reject?: boolean;
  workflow_can_view_requests?: boolean;
  workflow_can_view_history?: boolean;
  workflow_can_view_kpi?: boolean;
  pages: string[];
  code?: string;
}) {
  await requireRolesAdmin();

  const label = data.label.trim();
  if (!label) throw new Error("Le libellé est obligatoire.");

  let code = (data.code?.trim() || slugifyRoleCode(label)).replace(
    /[^a-zA-Z0-9_]/g,
    "_"
  );
  if (!code) throw new Error("Code de rôle invalide.");

  const existing = await prisma.appRole.findUnique({ where: { code } });
  if (existing) {
    code = `${code}_${Date.now().toString(36)}`;
  }

  const pages = normalizePages(data.pages);
  if (pages.length === 0) {
    throw new Error("Sélectionnez au moins une page autorisée.");
  }

  await prisma.appRole.create({
    data: {
      code,
      label,
      description: data.description?.trim() ?? "",
      color: data.color?.trim() || "#6b7280",
      is_active: true,
      is_system: false,
      chantier_scope: validateScope(data.chantier_scope),
      // Default: Non autorisé when not provided
      raid_create_scope: validateRaidCreateScope(
        data.raid_create_scope ?? "none"
      ),
      jalon_create_mode: validateWorkflowMode(
        data.jalon_create_mode ?? "DIRECT",
        "création jalon"
      ),
      jalon_update_mode: validateWorkflowMode(
        data.jalon_update_mode ?? "DIRECT",
        "modification jalon"
      ),
      jalon_delete_mode: validateWorkflowMode(
        data.jalon_delete_mode ?? "DIRECT",
        "suppression jalon"
      ),
      workflow_can_approve: !!data.workflow_can_approve,
      workflow_can_reject: !!data.workflow_can_reject,
      workflow_can_view_requests: !!data.workflow_can_view_requests,
      workflow_can_view_history: !!data.workflow_can_view_history,
      workflow_can_view_kpi: !!data.workflow_can_view_kpi,
      pages,
    },
  });

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

export async function updateRole(
  id: string,
  data: {
    label: string;
    description?: string;
    color?: string;
    chantier_scope: string;
    raid_create_scope?: string;
    jalon_create_mode?: string;
    jalon_update_mode?: string;
    jalon_delete_mode?: string;
    workflow_can_approve?: boolean;
    workflow_can_reject?: boolean;
    workflow_can_view_requests?: boolean;
    workflow_can_view_history?: boolean;
    workflow_can_view_kpi?: boolean;
    pages: string[];
  }
) {
  await requireRolesAdmin();

  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) throw new Error("Rôle introuvable.");

  const label = data.label.trim();
  if (!label) throw new Error("Le libellé est obligatoire.");

  let pages = normalizePages(data.pages);
  // Admin always keeps full access
  if (role.code === "Admin") {
    pages = [...ALL_PAGE_PATHS];
  }
  if (pages.length === 0) {
    throw new Error("Sélectionnez au moins une page autorisée.");
  }

  const isAdmin = role.code === "Admin";

  await prisma.appRole.update({
    where: { id },
    data: {
      label,
      description: data.description?.trim() ?? "",
      color: data.color?.trim() || role.color,
      chantier_scope: isAdmin ? "all" : validateScope(data.chantier_scope),
      // Admin always programme-level RAID create
      raid_create_scope: isAdmin
        ? "programme"
        : validateRaidCreateScope(data.raid_create_scope ?? "none"),
      jalon_create_mode: isAdmin
        ? "DIRECT"
        : validateWorkflowMode(
            data.jalon_create_mode ?? "DIRECT",
            "création jalon"
          ),
      jalon_update_mode: isAdmin
        ? "DIRECT"
        : validateWorkflowMode(
            data.jalon_update_mode ?? "DIRECT",
            "modification jalon"
          ),
      jalon_delete_mode: isAdmin
        ? "DIRECT"
        : validateWorkflowMode(
            data.jalon_delete_mode ?? "DIRECT",
            "suppression jalon"
          ),
      workflow_can_approve: isAdmin ? true : !!data.workflow_can_approve,
      workflow_can_reject: isAdmin ? true : !!data.workflow_can_reject,
      workflow_can_view_requests: isAdmin
        ? true
        : !!data.workflow_can_view_requests,
      workflow_can_view_history: isAdmin
        ? true
        : !!data.workflow_can_view_history,
      workflow_can_view_kpi: isAdmin ? true : !!data.workflow_can_view_kpi,
      pages,
    },
  });

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}

export async function setRoleActive(id: string, is_active: boolean) {
  await requireRolesAdmin();

  const role = await prisma.appRole.findUnique({ where: { id } });
  if (!role) throw new Error("Rôle introuvable.");

  if (role.code === "Admin" && !is_active) {
    throw new Error("Le rôle Administrateur ne peut pas être désactivé.");
  }

  if (!is_active) {
    const users = await prisma.user.count({
      where: { role: role.code, is_active: true },
    });
    // Allow disable even with users — they won't log in — but warn via error optional
    // User asked disable/reactivate freely; we allow it.
    void users;
  }

  await prisma.appRole.update({
    where: { id },
    data: { is_active },
  });

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
}
