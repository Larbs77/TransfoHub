/**
 * Catalog of application pages that can be granted to roles.
 * Keep paths stable — they are stored in AppRole.pages.
 *
 * `writeable`: Accès vues may offer Écriture (CRUD / validation métier).
 * If false, only Aucun / Lecture will be proposed.
 */
export type AppPage = {
  path: string;
  label: string;
  section: string;
  writeable: boolean;
};

/** Coarse page access for Accès vues. Write implies read. */
export const PAGE_ACCESS_MODES = [
  {
    value: "none",
    label: "Aucun",
    description: "Écran absent du menu, accès refusé",
  },
  {
    value: "read",
    label: "Lecture",
    description: "Consulter l'écran, sans créer ni modifier",
  },
  {
    value: "write",
    label: "Écriture",
    description: "Consulter et modifier, sous réserve des autorisations métier",
  },
] as const;

export type PageAccessMode = (typeof PAGE_ACCESS_MODES)[number]["value"];

export const APP_PAGES: AppPage[] = [
  { path: "/", label: "Tableau de bord", section: "Général", writeable: false },
  {
    path: "/mon-tableau-de-bord",
    label: "Mon Tableau de bord",
    section: "Général",
    writeable: false,
  },
  {
    path: "/chantiers",
    label: "Chantiers",
    section: "Suivi Opérationnel",
    writeable: true,
  },
  {
    path: "/adherences",
    label: "Adhérences",
    section: "Suivi Opérationnel",
    writeable: true,
  },
  { path: "/raid", label: "RAID", section: "Suivi Opérationnel", writeable: true },
  {
    path: "/jalons",
    label: "Jalons",
    section: "Suivi Opérationnel",
    writeable: true,
  },
  {
    path: "/gantt",
    label: "Gantt Portefeuille",
    section: "Suivi Opérationnel",
    writeable: false,
  },
  {
    path: "/saisie-temps",
    label: "Saisie Temps",
    section: "Suivi Opérationnel",
    writeable: true,
  },
  {
    path: "/consultation-backlog",
    label: "Backlog Q&A",
    section: "Suivi Opérationnel",
    writeable: true,
  },
  {
    path: "/favoris",
    label: "Favoris",
    section: "Suivi Opérationnel",
    writeable: false,
  },
  { path: "/comites", label: "Comités", section: "Gouvernance", writeable: true },
  {
    path: "/dashboards",
    label: "Dashboards",
    section: "Gouvernance",
    writeable: false,
  },
  { path: "/rmds", label: "RMD", section: "Gouvernance", writeable: true },
  {
    path: "/calendrier",
    label: "Calendrier",
    section: "Gouvernance",
    writeable: false,
  },
  {
    path: "/workflow/demandes",
    label: "Centre de Validation",
    section: "Workflow",
    writeable: false,
  },
  {
    path: "/workflow/historique",
    label: "Historique des demandes",
    section: "Workflow",
    writeable: false,
  },
  {
    path: "/workflow/dashboard",
    label: "Dashboard Workflow",
    section: "Workflow",
    writeable: false,
  },
  { path: "/ressources", label: "Ressources", section: "Ressources", writeable: true },
  { path: "/profils", label: "Profils", section: "Ressources", writeable: true },
  {
    path: "/capacite",
    label: "Capacité",
    section: "Ressources",
    writeable: false,
  },
  {
    path: "/admin/users",
    label: "Utilisateurs",
    section: "Administration",
    writeable: true,
  },
  {
    path: "/admin/roles",
    label: "Rôles",
    section: "Administration",
    writeable: true,
  },
  {
    path: "/admin/equipes",
    label: "Équipes",
    section: "Administration",
    writeable: true,
  },
  {
    path: "/admin/comites-parametres",
    label: "Paramètres comités",
    section: "Administration",
    writeable: true,
  },
  {
    path: "/settings",
    label: "Paramètres",
    section: "Administration",
    writeable: true,
  },
  {
    path: "/admin/messagerie",
    label: "Serveur De Messagerie",
    section: "Technique",
    writeable: true,
  },
  {
    path: "/admin/donnees",
    label: "Import / Purge",
    section: "Technique",
    writeable: true,
  },
];

export const ALL_PAGE_PATHS = APP_PAGES.map((p) => p.path);

export const APP_PAGE_BY_PATH = Object.fromEntries(
  APP_PAGES.map((p) => [p.path, p])
) as Record<string, AppPage>;

export function isAppPageWriteable(path: string): boolean {
  return APP_PAGE_BY_PATH[path]?.writeable ?? false;
}

/** Most specific permission entry owning a route. */
export function getOwningAppPagePath(path: string): string | null {
  return (
    ALL_PAGE_PATHS.filter(
      (page) => page === path || (page !== "/" && path.startsWith(page + "/"))
    ).sort((a, b) => b.length - a.length)[0] ?? null
  );
}

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

/** Permission to create RAID entries (role management). */
export const RAID_CREATE_SCOPES = [
  {
    value: "none",
    label: "Non autorisé",
    description: "L'utilisateur ne peut pas créer d'entrées RAID",
  },
  {
    value: "chantier",
    label: "Niveau Chantier",
    description:
      "Peut créer des entrées RAID uniquement pour les chantiers où il est rattaché en tant que ressource",
  },
  {
    value: "programme",
    label: "Niveau Programme",
    description: "Peut créer des entrées RAID pour tous les chantiers",
  },
] as const;

export type RaidCreateScope = (typeof RAID_CREATE_SCOPES)[number]["value"];

/** Default page sets for the four built-in roles (migration seed). */
export const DEFAULT_ROLE_PAGES: Record<string, string[]> = {
  Admin: [...ALL_PAGE_PATHS],
  Programme_Office: [
    "/",
    "/mon-tableau-de-bord",
    "/chantiers",
    "/adherences",
    "/raid",
    "/jalons",
    "/gantt",
    "/saisie-temps",
    "/consultation-backlog",
    "/favoris",
    "/comites",
    "/dashboards",
    "/workflow/demandes",
    "/workflow/historique",
    "/workflow/dashboard",
    "/rmds",
    "/calendrier",
    "/ressources",
    "/capacite",
  ],
  PMO_Chantier: [
    "/",
    "/mon-tableau-de-bord",
    "/chantiers",
    "/adherences",
    "/raid",
    "/jalons",
    "/gantt",
    "/saisie-temps",
    "/consultation-backlog",
    "/favoris",
    "/comites",
    "/workflow/demandes",
    "/workflow/historique",
    "/calendrier",
  ],
  Workforce_Manager: [
    "/",
    "/mon-tableau-de-bord",
    "/saisie-temps",
    "/calendrier",
    "/ressources",
    "/profils",
    "/capacite",
  ],
};
