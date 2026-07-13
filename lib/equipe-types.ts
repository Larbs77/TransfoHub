/** Equipe kinds in TransfoHub. */
export const EQUIPE_TYPES = {
  institutionnelle: "institutionnelle",
  fonctionnelle: "fonctionnelle",
} as const;

export type EquipeType = (typeof EQUIPE_TYPES)[keyof typeof EQUIPE_TYPES];

export const EQUIPE_TYPE_LABELS: Record<EquipeType, string> = {
  institutionnelle: "Institutionnelle",
  fonctionnelle: "Fonctionnelle",
};

export const EQUIPE_TYPE_DESCRIPTIONS: Record<EquipeType, string> = {
  institutionnelle:
    "Organisation de la banque (hiérarchie RH / unités). Chaque ressource y est rattachée.",
  fonctionnelle:
    "Équipe programme d'un chantier. Créée automatiquement à la création du chantier ; les membres sont les personnes affectées au chantier.",
};

export function isEquipeType(value: unknown): value is EquipeType {
  return value === "institutionnelle" || value === "fonctionnelle";
}

export function functionalTeamName(code: string, nom: string): string {
  const c = code.trim();
  const n = nom.trim();
  const base = n ? `Équipe ${c} — ${n}` : `Équipe ${c}`;
  return base.length > 120 ? base.slice(0, 117) + "…" : base;
}

export function functionalTeamDescription(code: string, nom: string): string {
  return `Équipe fonctionnelle (programme) du chantier ${code.trim()} — ${nom.trim() || "sans nom"}.`;
}
