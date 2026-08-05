/**
 * Soft coherence rules for planning tree:
 * Phase → Jalon → Workstream → Activité
 *
 * - Internal: debut ≤ fin when both set
 * - Activité ⊂ Workstream (when both sides have dates)
 * - Workstream fin ≤ Jalon date_cible (model A)
 * - Statut cascade : parent « Atteint » avec enfant non Atteint
 */

export type CoherenceIssue = {
  level: "workstream" | "activite" | "jalon";
  entityId: string;
  message: string;
};

function isAtteint(statut: string | null | undefined): boolean {
  return (statut ?? "").trim() === "Atteint";
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function checkRange(
  debut: Date | string | null | undefined,
  fin: Date | string | null | undefined,
  label: string
): string | null {
  const d = toDate(debut);
  const f = toDate(fin);
  if (d && f && d.getTime() > f.getTime()) {
    return `${label} : date début (${ymd(d)}) postérieure à date fin (${ymd(f)}).`;
  }
  return null;
}

/** fin_ws ≤ date_cible_jalon when both set */
export function checkWorkstreamVsJalon(
  wsFin: Date | string | null | undefined,
  jalonCible: Date | string | null | undefined,
  wsLabel: string,
  jalonLabel: string
): string | null {
  const f = toDate(wsFin);
  const c = toDate(jalonCible);
  if (f && c && f.getTime() > c.getTime()) {
    return `Workstream « ${wsLabel} » : fin (${ymd(f)}) après la date cible du jalon « ${jalonLabel} » (${ymd(c)}).`;
  }
  return null;
}

/** activité dates must sit inside workstream window when both ends known */
export function checkActiviteVsWorkstream(
  actDebut: Date | string | null | undefined,
  actFin: Date | string | null | undefined,
  wsDebut: Date | string | null | undefined,
  wsFin: Date | string | null | undefined,
  actLabel: string,
  wsLabel: string
): string | null {
  const ad = toDate(actDebut);
  const af = toDate(actFin);
  const wd = toDate(wsDebut);
  const wf = toDate(wsFin);

  if (ad && wd && ad.getTime() < wd.getTime()) {
    return `Activité « ${actLabel} » : début avant le workstream « ${wsLabel} ».`;
  }
  if (af && wf && af.getTime() > wf.getTime()) {
    return `Activité « ${actLabel} » : fin après le workstream « ${wsLabel} ».`;
  }
  if (ad && wf && ad.getTime() > wf.getTime()) {
    return `Activité « ${actLabel} » : début après la fin du workstream « ${wsLabel} ».`;
  }
  if (af && wd && af.getTime() < wd.getTime()) {
    return `Activité « ${actLabel} » : fin avant le début du workstream « ${wsLabel} ».`;
  }
  return null;
}

export type TreeJalon = {
  id: string;
  nom: string;
  date_cible: Date | string;
  statut?: string | null;
  workstreams?: TreeWorkstream[];
};

export type TreeWorkstream = {
  id: string;
  nom: string;
  date_debut?: Date | string | null;
  date_fin?: Date | string | null;
  statut?: string | null;
  activites?: TreeActivite[];
};

export type TreeActivite = {
  id: string;
  nom: string;
  date_debut?: Date | string | null;
  date_fin?: Date | string | null;
  statut?: string | null;
};

/**
 * Parent « Atteint » avec enfant non Atteint (ex. activité repassée En cours
 * alors que workstream/jalon restent Atteint).
 */
export function checkStatutCascadeIncoherence(
  jalon: TreeJalon
): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  const wsList = jalon.workstreams ?? [];

  for (const ws of wsList) {
    const acts = ws.activites ?? [];
    if (isAtteint(ws.statut)) {
      for (const act of acts) {
        if (isAtteint(act.statut)) continue;
        const actStatut = (act.statut ?? "Planifié").trim() || "Planifié";
        issues.push({
          level: "workstream",
          entityId: ws.id,
          message: `Workstream « ${ws.nom} » est Atteint alors que l'activité « ${act.nom} » est encore « ${actStatut} ».`,
        });
        issues.push({
          level: "activite",
          entityId: act.id,
          message: `Activité « ${act.nom} » (« ${actStatut} ») alors que le workstream parent « ${ws.nom} » est Atteint.`,
        });
      }
    }
  }

  if (isAtteint(jalon.statut)) {
    for (const ws of wsList) {
      if (!isAtteint(ws.statut)) {
        const wsStatut = (ws.statut ?? "Planifié").trim() || "Planifié";
        issues.push({
          level: "jalon",
          entityId: jalon.id,
          message: `Jalon « ${jalon.nom} » est Atteint alors que le workstream « ${ws.nom} » est encore « ${wsStatut} ».`,
        });
        issues.push({
          level: "workstream",
          entityId: ws.id,
          message: `Workstream « ${ws.nom} » (« ${wsStatut} ») alors que le jalon parent « ${jalon.nom} » est Atteint.`,
        });
        continue;
      }
      // WS Atteint mais activités non Atteint → remonte aussi au jalon
      for (const act of ws.activites ?? []) {
        if (isAtteint(act.statut)) continue;
        const actStatut = (act.statut ?? "Planifié").trim() || "Planifié";
        issues.push({
          level: "jalon",
          entityId: jalon.id,
          message: `Jalon « ${jalon.nom} » est Atteint alors que l'activité « ${act.nom} » (workstream « ${ws.nom} ») est encore « ${actStatut} ».`,
        });
      }
    }
  }

  return issues;
}

/** Collect soft coherence issues for a jalon tree. */
export function collectJalonCoherenceIssues(jalon: TreeJalon): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];
  const wsList = jalon.workstreams ?? [];

  for (const ws of wsList) {
    const r = checkRange(ws.date_debut, ws.date_fin, `Workstream « ${ws.nom} »`);
    if (r) {
      issues.push({ level: "workstream", entityId: ws.id, message: r });
    }
    const vsJ = checkWorkstreamVsJalon(
      ws.date_fin,
      jalon.date_cible,
      ws.nom,
      jalon.nom
    );
    if (vsJ) {
      issues.push({ level: "workstream", entityId: ws.id, message: vsJ });
    }

    for (const act of ws.activites ?? []) {
      const ar = checkRange(
        act.date_debut,
        act.date_fin,
        `Activité « ${act.nom} »`
      );
      if (ar) {
        issues.push({ level: "activite", entityId: act.id, message: ar });
      }
      const vsWs = checkActiviteVsWorkstream(
        act.date_debut,
        act.date_fin,
        ws.date_debut,
        ws.date_fin,
        act.nom,
        ws.nom
      );
      if (vsWs) {
        issues.push({ level: "activite", entityId: act.id, message: vsWs });
      }
    }
  }

  // Statut parent Atteint / enfant non Atteint
  issues.push(...checkStatutCascadeIncoherence(jalon));

  return issues;
}

export const PLANNING_DETAIL_GOUVERNANCE = {
  LIBRE: "libre",
  ALIGNEE_JALON: "alignee_jalon",
} as const;

export type PlanningDetailGouvernance =
  (typeof PLANNING_DETAIL_GOUVERNANCE)[keyof typeof PLANNING_DETAIL_GOUVERNANCE];

export function normalizePlanningDetailGouvernance(
  value: unknown
): PlanningDetailGouvernance {
  if (value === PLANNING_DETAIL_GOUVERNANCE.ALIGNEE_JALON) {
    return PLANNING_DETAIL_GOUVERNANCE.ALIGNEE_JALON;
  }
  return PLANNING_DETAIL_GOUVERNANCE.LIBRE;
}
