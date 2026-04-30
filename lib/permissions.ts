import type { Role } from "./auth";
export type { Role };

// Route-level access matrix
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  "/": ["Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager"],
  "/chantiers": ["Admin", "Programme_Office", "PMO_Chantier"],
  "/adherences": ["Admin", "Programme_Office", "PMO_Chantier"],
  "/raid": ["Admin", "Programme_Office", "PMO_Chantier"],
  "/jalons": ["Admin", "Programme_Office", "PMO_Chantier"],
  "/saisie-temps": ["Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager"],
  "/consultation-backlog": ["Admin", "Programme_Office", "PMO_Chantier"],
  "/favoris": ["Admin", "Programme_Office", "PMO_Chantier"],
  "/comites": ["Admin", "Programme_Office", "PMO_Chantier"],
  "/dashboards": ["Admin", "Programme_Office"],
  "/rmds": ["Admin", "Programme_Office"],
  "/calendrier": ["Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager"],
  "/ressources": ["Admin", "Programme_Office", "Workforce_Manager"],
  "/profils": ["Admin", "Workforce_Manager"],
  "/capacite": ["Admin", "Programme_Office", "Workforce_Manager"],
  "/settings": ["Admin"],
  "/admin/users": ["Admin"],
};

export const ROLE_LABELS: Record<Role, string> = {
  Admin: "Administrateur",
  Programme_Office: "Bureau Programme",
  PMO_Chantier: "PMO Chantier",
  Workforce_Manager: "Gestionnaire Ressources",
};

export const ROLE_COLORS: Record<Role, string> = {
  Admin: "#dc2626",
  Programme_Office: "#2563eb",
  PMO_Chantier: "#059669",
  Workforce_Manager: "#7c3aed",
};
