/**
 * Règles de clôture en cascade (helpers purs — safe client + serveur) :
 * - Workstream « Atteint » seulement si toutes ses activités sont « Atteint »
 * - Jalon « Atteint » seulement si tous ses workstreams sont « Atteint »
 *
 * (Liste vide = autorisé : pas de sous-élément bloquant.)
 *
 * Les asserts Prisma sont dans `planning-status-assert.ts` (serveur uniquement).
 */

const ATTEINT = "Atteint";

export function isAtteintStatut(statut: string | null | undefined): boolean {
  return (statut ?? "").trim() === ATTEINT;
}

/** Vérifie en mémoire (UI / preview) si tous les sous-statuts sont Atteint. */
export function allChildrenAtteint(
  children: { statut?: string | null; nom?: string }[]
): { ok: boolean; pending: { nom: string; statut: string }[] } {
  const pending = children
    .filter((c) => !isAtteintStatut(c.statut))
    .map((c) => ({
      nom: (c.nom ?? "").trim() || "—",
      statut: (c.statut ?? "Planifié").trim() || "Planifié",
    }));
  return { ok: pending.length === 0, pending };
}

export function formatCannotAtteintMessage(
  kind: "workstream" | "jalon",
  pending: { nom: string; statut: string }[]
): string {
  const childLabel =
    kind === "workstream" ? "activité" : "workstream";
  const childLabelPlural =
    kind === "workstream" ? "activités" : "workstreams";
  const sample = pending
    .slice(0, 3)
    .map((p) => `« ${p.nom} » (${p.statut})`)
    .join(", ");
  const more =
    pending.length > 3 ? ` et ${pending.length - 3} autre(s)` : "";
  if (kind === "workstream") {
    return `Impossible de passer le workstream à « Atteint » : toutes les activités doivent être au statut Atteint. Encore ${pending.length} ${pending.length > 1 ? childLabelPlural : childLabel} non atteinte(s) : ${sample}${more}.`;
  }
  return `Impossible de passer le jalon à « Atteint » : tous les workstreams doivent être au statut Atteint. Encore ${pending.length} ${pending.length > 1 ? childLabelPlural : childLabel} non atteint(s) : ${sample}${more}.`;
}
