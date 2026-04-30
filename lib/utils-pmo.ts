/**
 * Calcule le score de criticité d'un risque : Impact × Probabilité.
 * Résultat entre 1 (minimal) et 25 (critique).
 */
export function scoreCriticite(impact: number, probabilite: number): number {
  return impact * probabilite;
}

/**
 * Formate un montant en MAD avec séparateur de milliers (espace).
 * Ex: 1250000 → "1 250 000 MAD", 0 → "—"
 */
export function formatMAD(amount: number): string {
  if (!amount || amount === 0) return "—";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(Math.round(amount)) + " MAD"
  );
}

/**
 * Formate un montant en MAD abrégé (K/M).
 * Ex: 1250000 → "1.3M MAD", 45000 → "45K MAD", 0 → "—"
 */
export function formatMADCompact(amount: number): string {
  if (!amount || amount === 0) return "—";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M MAD`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K MAD`;
  return `${amount} MAD`;
}

/**
 * Formate un nombre de JH (jours-hommes).
 * Ex: 1800 → "1 800 JH"
 */
export function formatJH(jh: number): string {
  if (!jh || jh === 0) return "—";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(Math.round(jh)) + " JH"
  );
}
