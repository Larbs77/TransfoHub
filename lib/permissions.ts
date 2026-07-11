import type { RoleRecord } from "@/lib/roles";
import { APP_PAGES } from "@/lib/app-pages";

/** Role code stored on User.role — free-form string (dynamic roles). */
export type Role = string;

/** Fallback labels when a role is missing from DB (legacy sessions). */
export const LEGACY_ROLE_LABELS: Record<string, string> = {
  Admin: "Administrateur",
  Programme_Office: "Bureau Programme",
  PMO_Chantier: "PMO Chantier",
  Workforce_Manager: "Gestionnaire Ressources",
};

export const LEGACY_ROLE_COLORS: Record<string, string> = {
  Admin: "#dc2626",
  Programme_Office: "#2563eb",
  PMO_Chantier: "#059669",
  Workforce_Manager: "#7c3aed",
};

export function roleLabel(
  code: string,
  roles?: Pick<RoleRecord, "code" | "label">[]
): string {
  const fromDb = roles?.find((r) => r.code === code)?.label;
  return fromDb ?? LEGACY_ROLE_LABELS[code] ?? code;
}

export function roleColor(
  code: string,
  roles?: Pick<RoleRecord, "code" | "color">[]
): string {
  const fromDb = roles?.find((r) => r.code === code)?.color;
  return fromDb ?? LEGACY_ROLE_COLORS[code] ?? "#6b7280";
}

/** @deprecated Static matrix — kept for reference; runtime uses AppRole.pages */
export const ROUTE_PERMISSIONS: Record<string, string[]> = Object.fromEntries(
  APP_PAGES.map((p) => [p.path, [] as string[]])
);

/** @deprecated Use roleLabel() / roles from DB */
export const ROLE_LABELS = LEGACY_ROLE_LABELS;

/** @deprecated Use roleColor() / roles from DB */
export const ROLE_COLORS = LEGACY_ROLE_COLORS;
