/**
 * Client-safe workflow constants, types, and pure helpers.
 * Do NOT import prisma / server modules here — used by client components.
 */

// ── Constants ──────────────────────────────────────────

export const WORKFLOW_ENTITY = {
  JALON: "jalon",
} as const;

export type WorkflowEntityType =
  (typeof WORKFLOW_ENTITY)[keyof typeof WORKFLOW_ENTITY];

export const WORKFLOW_OPERATION = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
} as const;

export type WorkflowOperation =
  (typeof WORKFLOW_OPERATION)[keyof typeof WORKFLOW_OPERATION];

export const WORKFLOW_MODE = {
  DIRECT: "DIRECT",
  VALIDATION: "VALIDATION",
  INTERDIT: "INTERDIT",
} as const;

export type WorkflowMode =
  (typeof WORKFLOW_MODE)[keyof typeof WORKFLOW_MODE];

export const WORKFLOW_STATUS = {
  PENDING: "EN_ATTENTE",
  APPROVED: "APPROUVEE",
  REJECTED: "REJETEE",
} as const;

export type WorkflowStatus =
  (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

export const WORKFLOW_MODE_OPTIONS: {
  value: WorkflowMode;
  label: string;
  description: string;
}[] = [
  {
    value: "DIRECT",
    label: "Direct",
    description: "L'opération est exécutée immédiatement",
  },
  {
    value: "VALIDATION",
    label: "Validation",
    description: "Une demande doit être approuvée avant application",
  },
  {
    value: "INTERDIT",
    label: "Interdit",
    description: "L'opération n'est pas autorisée",
  },
];

export const WORKFLOW_OPERATION_LABELS: Record<WorkflowOperation, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
};

export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
};

// ── Normalization ──────────────────────────────────────

export function normalizeWorkflowMode(value: unknown): WorkflowMode {
  if (value === "VALIDATION" || value === "INTERDIT" || value === "DIRECT") {
    return value;
  }
  return "DIRECT";
}

export function isWorkflowMode(value: string): value is WorkflowMode {
  return value === "DIRECT" || value === "VALIDATION" || value === "INTERDIT";
}

// ── Role capabilities (pure) ───────────────────────────

export type JalonWorkflowCaps = {
  create: WorkflowMode;
  update: WorkflowMode;
  delete: WorkflowMode;
  canApprove: boolean;
  canReject: boolean;
  canViewRequests: boolean;
  canViewHistory: boolean;
  canViewKpi: boolean;
};

/** Minimal role shape — avoid importing server RoleRecord / prisma. */
export type WorkflowRoleLike = {
  code: string;
  is_active: boolean;
  jalon_create_mode?: string | null;
  jalon_update_mode?: string | null;
  jalon_delete_mode?: string | null;
  workflow_can_approve?: boolean | null;
  workflow_can_reject?: boolean | null;
  workflow_can_view_requests?: boolean | null;
  workflow_can_view_history?: boolean | null;
  workflow_can_view_kpi?: boolean | null;
};

/** Admin always has full direct rights + all workflow capabilities. */
export function resolveJalonWorkflowCaps(
  role: WorkflowRoleLike | null | undefined
): JalonWorkflowCaps {
  if (!role || !role.is_active) {
    return {
      create: "INTERDIT",
      update: "INTERDIT",
      delete: "INTERDIT",
      canApprove: false,
      canReject: false,
      canViewRequests: false,
      canViewHistory: false,
      canViewKpi: false,
    };
  }

  if (role.code === "Admin") {
    return {
      create: "DIRECT",
      update: "DIRECT",
      delete: "DIRECT",
      canApprove: true,
      canReject: true,
      canViewRequests: true,
      canViewHistory: true,
      canViewKpi: true,
    };
  }

  return {
    create: normalizeWorkflowMode(role.jalon_create_mode),
    update: normalizeWorkflowMode(role.jalon_update_mode),
    delete: normalizeWorkflowMode(role.jalon_delete_mode),
    canApprove: !!role.workflow_can_approve,
    canReject: !!role.workflow_can_reject,
    canViewRequests: !!role.workflow_can_view_requests,
    canViewHistory: !!role.workflow_can_view_history,
    canViewKpi: !!role.workflow_can_view_kpi,
  };
}

export function modeForOperation(
  caps: JalonWorkflowCaps,
  operation: WorkflowOperation
): WorkflowMode {
  if (operation === "create") return caps.create;
  if (operation === "update") return caps.update;
  return caps.delete;
}

export type DecisionEvent = {
  at: string;
  status: string;
  actorId: string;
  actorName: string;
  note?: string;
};

export function parseDecisionHistory(raw: unknown): DecisionEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is DecisionEvent =>
      !!e &&
      typeof e === "object" &&
      typeof (e as DecisionEvent).at === "string" &&
      typeof (e as DecisionEvent).status === "string"
  );
}

/**
 * Display label for a jalon workflow target: "Phase \\ Nom".
 * Prefers newValues (create/update), then oldValues (delete), then entityLabel.
 */
export function formatJalonWorkflowLabel(params: {
  entityLabel?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  phase?: string | null;
  nom?: string | null;
}): string {
  const fromObj = (v: unknown): { phase?: string; nom?: string } | null => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const phase = typeof o.phase === "string" ? o.phase.trim() : "";
    const nom = typeof o.nom === "string" ? o.nom.trim() : "";
    if (!phase && !nom) return null;
    return { phase: phase || undefined, nom: nom || undefined };
  };

  const nv = fromObj(params.newValues);
  const ov = fromObj(params.oldValues);
  const phase =
    (params.phase?.trim() || nv?.phase || ov?.phase || "").trim();
  const nom = (
    params.nom?.trim() ||
    nv?.nom ||
    ov?.nom ||
    params.entityLabel?.trim() ||
    ""
  ).trim();

  // entityLabel may already be "Phase \\ Nom"
  if (!phase && params.entityLabel?.includes(" \\ ")) {
    return params.entityLabel.trim();
  }
  if (phase && nom) return `${phase} \\ ${nom}`;
  if (nom) return nom;
  if (phase) return phase;
  return params.entityLabel?.trim() || "—";
}

export function buildJalonEntityLabel(phase: string, nom: string): string {
  const p = phase?.trim() || "";
  const n = nom?.trim() || "";
  if (p && n) return `${p} \\ ${n}`;
  return n || p || "";
}

/** Stored on WorkflowRequest.priority for direct (auto-approved) audits */
export const WORKFLOW_ORIGIN_DIRECT = "DIRECT";
export const WORKFLOW_ORIGIN_VALIDATION = "VALIDATION";

export type WorkflowOrigin = "direct" | "validation";

/**
 * Direct = modification appliquée immédiatement (auto-approuvée).
 * Validation = a passé par EN_ATTENTE (ou rejet).
 */
export function resolveWorkflowOrigin(request: {
  priority?: string | null;
  status?: string | null;
  decisionHistory?: unknown;
}): WorkflowOrigin {
  if (request.priority === WORKFLOW_ORIGIN_DIRECT) return "direct";
  if (request.priority === WORKFLOW_ORIGIN_VALIDATION) return "validation";

  const history = parseDecisionHistory(request.decisionHistory);
  const hadPending = history.some(
    (h) => h.status === WORKFLOW_STATUS.PENDING
  );
  if (hadPending) return "validation";
  if (request.status === WORKFLOW_STATUS.REJECTED) return "validation";
  // APPROUVEE without EN_ATTENTE in history → auto-approved direct audit
  if (request.status === WORKFLOW_STATUS.APPROVED) {
    if (
      history.length === 0 ||
      history.every((h) => h.status === WORKFLOW_STATUS.APPROVED)
    ) {
      return "direct";
    }
  }
  return "validation";
}

export const WORKFLOW_ORIGIN_LABELS: Record<WorkflowOrigin, string> = {
  direct: "Directe",
  validation: "Via validation",
};
