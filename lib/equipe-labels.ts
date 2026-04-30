export const EQUIPE_LABELS: Record<string, string> = {
  PMO: "PMO",
  AMOA: "AMOA",
  MOE: "MOE",
  Métiers: "Métiers",
  Sécurité: "Sécurité",
  EI: "EI",
};

export const ROLE_PAR_EQUIPE: Record<string, string[]> = {
  PMO: [
    "PMO",
  ],
  AMOA: [
    "Directeur de chantier",
    "Directeur de chantier - suppléant",
    "Directeur projet AMOA",
    "Directeur projet DDG",
    "Chef de projet AMOA",
    "Chef de projet DDG",
    "Chef de projet Orga"
  ],
  MOE: [
    "Directeur de chantier",
    "Directeur de chantier - suppléant",
    "Directeur projet MOE",
    "Chef de projet MOE",
    "Lead Architecte",
  ],
  Métiers: [
    "Directeur de chantier",
    "Directeur de chantier - suppléant",
    "Chef de projet métier",
  ],
  Sécurité: [
    "Représentant RSSI",
  ],
  EI: [
    "Chef de projet EI",
  ],
};

export const EQUIPE_COLORS: Record<string, string> = {
  PMO: "hsl(340, 65%, 50%)",
  AMOA: "hsl(220, 70%, 55%)",
  MOE: "hsl(150, 60%, 45%)",
  Métiers: "hsla(50, 68%, 70%, 1.00)",
  Sécurité: "hsl(35, 85%, 50%)",
  EI: "hsl(280, 60%, 55%)",
};
