export const COMITE_NIVEAU_GOUVERNANCE = "gouvernance";
export const COMITE_NIVEAU_OPERATIONNEL = "operationnel";

export const COMITE_NIVEAU_LABELS: Record<string, string> = {
  [COMITE_NIVEAU_GOUVERNANCE]: "Gouvernance",
  [COMITE_NIVEAU_OPERATIONNEL]: "Opérationnel",
};

export const COMITE_OWNER_EQUIPE_CHANTIER = "Équipe chantier";

export function isComiteNiveauOperationnel(
  niveau: string | null | undefined
): boolean {
  return (niveau ?? "").trim().toLowerCase() === COMITE_NIVEAU_OPERATIONNEL;
}

export function isComiteNiveauGouvernance(
  niveau: string | null | undefined
): boolean {
  return !isComiteNiveauOperationnel(niveau);
}

/** Client-side: who may edit/delete a séance. */
export function canActOnComiteSeance(
  comite: { instance: string; chantierId?: string | null },
  ctx: {
    chantierScope: "all" | "assigned" | "none";
    instances?: { name: string; niveau?: string }[];
    consultationChantierIds?: string[];
  }
): boolean {
  if (ctx.chantierScope === "all") return true;
  if (
    comite.chantierId &&
    ctx.consultationChantierIds?.includes(comite.chantierId)
  ) {
    return false;
  }
  if (ctx.chantierScope !== "assigned") return false;
  const param = ctx.instances?.find((p) => p.name === comite.instance);
  return isComiteNiveauOperationnel(param?.niveau) && !!comite.chantierId;
}
