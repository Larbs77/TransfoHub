/**
 * Helpers linking Ressource (people master data) and User (app account).
 */

export function splitNomComplet(nomComplet: string): {
  first_name: string;
  last_name: string;
} {
  const parts = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

export function identityFromRessource(r: {
  nom_complet: string;
  email?: string | null;
  telephone?: string | null;
}) {
  const { first_name, last_name } = splitNomComplet(r.nom_complet);
  return {
    first_name,
    last_name,
    email: (r.email ?? "").trim().toLowerCase(),
    phone: (r.telephone ?? "").trim(),
  };
}
