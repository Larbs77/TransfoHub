/**
 * Catalog of application pages that can be granted to roles.
 * Keep paths stable — they are stored in AppRole.pages.
 */
export type AppPage = {
  path: string;
  label: string;
  section: string;
};

export const APP_PAGES: AppPage[] = [
  { path: "/", label: "Tableau de bord", section: "Général" },
  { path: "/chantiers", label: "Chantiers", section: "Suivi Opérationnel" },
  { path: "/adherences", label: "Adhérences", section: "Suivi Opérationnel" },
  { path: "/raid", label: "RAID", section: "Suivi Opérationnel" },
  { path: "/jalons", label: "Jalons", section: "Suivi Opérationnel" },
  { path: "/saisie-temps", label: "Saisie Temps", section: "Suivi Opérationnel" },
  { path: "/consultation-backlog", label: "Backlog Q&A", section: "Suivi Opérationnel" },
  { path: "/favoris", label: "Favoris", section: "Suivi Opérationnel" },
  { path: "/comites", label: "Comités", section: "Gouvernance" },
  { path: "/dashboards", label: "Dashboards", section: "Gouvernance" },
  { path: "/rmds", label: "RMD", section: "Gouvernance" },
  { path: "/calendrier", label: "Calendrier", section: "Gouvernance" },
  { path: "/ressources", label: "Ressources", section: "Ressources" },
  { path: "/profils", label: "Profils", section: "Ressources" },
  { path: "/capacite", label: "Capacité", section: "Ressources" },
  { path: "/admin/users", label: "Utilisateurs", section: "Administration" },
  { path: "/admin/roles", label: "Rôles", section: "Administration" },
  {
    path: "/admin/comites-parametres",
    label: "Paramètres comités",
    section: "Administration",
  },
  { path: "/settings", label: "Paramètres", section: "Administration" },
  {
    path: "/admin/messagerie",
    label: "Serveur De Messagerie",
    section: "Technique",
  },
  {
    path: "/admin/donnees",
    label: "Import / Purge",
    section: "Technique",
  },
];

export const ALL_PAGE_PATHS = APP_PAGES.map((p) => p.path);

export const CHANTIER_SCOPES = [
  {
    value: "all",
    label: "Tous les chantiers",
    description: "Accès global aux données chantiers",
  },
  {
    value: "assigned",
    label: "Chantiers assignés",
    description: "Uniquement les chantiers liés à la ressource de l'utilisateur",
  },
  {
    value: "none",
    label: "Aucun",
    description: "Pas d'accès aux données chantier (hors pages explicitement autorisées)",
  },
] as const;

export type ChantierScope = (typeof CHANTIER_SCOPES)[number]["value"];

/** Default page sets for the four built-in roles (migration seed). */
export const DEFAULT_ROLE_PAGES: Record<string, string[]> = {
  Admin: [...ALL_PAGE_PATHS],
  Programme_Office: [
    "/",
    "/chantiers",
    "/adherences",
    "/raid",
    "/jalons",
    "/saisie-temps",
    "/consultation-backlog",
    "/favoris",
    "/comites",
    "/dashboards",
    "/rmds",
    "/calendrier",
    "/ressources",
    "/capacite",
  ],
  PMO_Chantier: [
    "/",
    "/chantiers",
    "/adherences",
    "/raid",
    "/jalons",
    "/saisie-temps",
    "/consultation-backlog",
    "/favoris",
    "/comites",
    "/calendrier",
  ],
  Workforce_Manager: [
    "/",
    "/saisie-temps",
    "/calendrier",
    "/ressources",
    "/profils",
    "/capacite",
  ],
};
