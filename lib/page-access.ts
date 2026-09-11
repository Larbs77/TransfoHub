/**
 * Accès vues — règles officielles (lecture / écriture par écran).
 *
 * 1. Trois états par écran : Aucun | Lecture | Écriture.
 *    Écriture implique lecture. Aucun = pas de menu, accès refusé.
 *
 * 2. Écrans `writeable: false` (catalogue APP_PAGES) : seulement Aucun / Lecture.
 *    Centre de Validation : pas de mode écriture ici — approuver / rejeter
 *    reste dans l'onglet Autorisations (flags workflow).
 *
 * 3. RAID — 3 surfaces (registre, fiche chantier, comité) :
 *    - Aucun : pas de mutations RAID.
 *    - Lecture : consultation ; pas de création ; pas d'action sur les RAID
 *      des autres ; **exception** : le responsable (ressource du compte)
 *      peut agir sur « son » RAID (statut, champs, kanban, commentaires).
 *      Pas de suppression, pas de réaffectation, pas d'auto-assignation.
 *    - Écriture : mécanisme actuel inchangé (création tous / assignés,
 *      canEditRaidForm, collaboration, leadership, règles comité).
 *
 * 4. Déploiement (`PAGE_ACCESS_MODE_UI_PATHS`) : sous-lot 1 + RAID,
 *    Chantiers, Comités. Admin & technique : inchangés.
 *
 * 5. Écriture n'annule jamais le périmètre chantier (`all` | `assigned`).
 *    Lecture = pas de mutation. Écriture = mutations **uniquement** sur les
 *    chantiers autorisés par le périmètre.
 */

import {
  ALL_PAGE_PATHS,
  getOwningAppPagePath,
  isAppPageWriteable,
  type PageAccessMode,
} from "@/lib/app-pages";

export type PageGrant = {
  path: string;
  mode: "read" | "write";
};

/** Screens where Accès vues shows Lecture/Écriture and the server enforces it. */
export const PAGE_ACCESS_MODE_UI_PATHS = [
  "/rmds",
  "/profils",
  "/ressources",
  "/saisie-temps",
  "/adherences",
  "/jalons",
  "/consultation-backlog",
  "/raid",
  "/chantiers",
  "/comites",
] as const;

export function showsPageAccessMode(path: string): boolean {
  return (PAGE_ACCESS_MODE_UI_PATHS as readonly string[]).includes(path);
}

export function isPageWriteEnforced(path: string): boolean {
  const owning = getOwningAppPagePath(path) ?? path;
  return showsPageAccessMode(owning);
}

function isGrant(value: unknown): value is PageGrant {
  if (!value || typeof value !== "object") return false;
  const v = value as { path?: unknown; mode?: unknown };
  return (
    typeof v.path === "string" && (v.mode === "read" || v.mode === "write")
  );
}

/** Legacy string[] = write. Mixed arrays accepted. */
export function parsePageGrants(pages: unknown): PageGrant[] {
  let raw: unknown[] = [];
  if (Array.isArray(pages)) {
    raw = pages;
  } else if (typeof pages === "string") {
    try {
      const parsed = JSON.parse(pages) as unknown;
      raw = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else {
    return [];
  }

  const seen = new Set<string>();
  const grants: PageGrant[] = [];
  for (const item of raw) {
    let path: string | null = null;
    let mode: "read" | "write" = "write";
    if (typeof item === "string") {
      path = item;
      mode = "write";
    } else if (isGrant(item)) {
      path = item.path;
      mode = item.mode;
    }
    if (!path || seen.has(path)) continue;
    seen.add(path);
    if (!isAppPageWriteable(path)) mode = "read";
    grants.push({ path, mode });
  }
  return grants;
}

export function serializePageGrants(
  paths: string[],
  modes: Record<string, "read" | "write">
): PageGrant[] {
  const allowed = new Set(ALL_PAGE_PATHS);
  const unique = [...new Set(paths.filter((p) => allowed.has(p)))];
  return unique.map((path) => {
    if (!isAppPageWriteable(path)) return { path, mode: "read" as const };
    return {
      path,
      mode: modes[path] === "read" ? ("read" as const) : ("write" as const),
    };
  });
}

export function grantsToPaths(grants: PageGrant[]): string[] {
  return grants.map((g) => g.path);
}

export function grantsToModeMap(
  grants: PageGrant[]
): Record<string, "read" | "write"> {
  return Object.fromEntries(grants.map((g) => [g.path, g.mode]));
}

export function pageGrantMode(
  grants: PageGrant[],
  path: string
): PageAccessMode {
  const owning = getOwningAppPagePath(path) ?? path;
  const grant = grants.find((g) => g.path === owning);
  if (!grant) return "none";
  return grant.mode;
}
