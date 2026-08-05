/**
 * Structured storage for ConsultationQuestion.affectee_a
 * while keeping a human-readable value for tables / exports.
 *
 * Formats:
 * - personne:{id}:{label}
 * - equipe_inst:{id}:{label}          (legacy / team only)
 * - equipe_func:{id}:{label}          (legacy)
 * - org|{teamId}|{personId}|{teamLabel}|{personLabel}
 * - legacy free text (no prefix) → treated as opaque label
 */

export type AffectationKind = "person" | "team_inst" | "team_func" | "org";

export type ParsedAffectation =
  | { kind: "person" | "team_inst" | "team_func"; id: string; label: string }
  | {
      kind: "org";
      teamId: string;
      personId: string;
      teamLabel: string;
      personLabel: string;
    }
  | { kind: "legacy"; id: ""; label: string }
  | { kind: "none"; id: ""; label: "" };

const SIMPLE_PREFIX: Record<"person" | "team_inst" | "team_func", string> = {
  person: "personne",
  team_inst: "equipe_inst",
  team_func: "equipe_func",
};

const KIND_BY_PREFIX: Record<string, "person" | "team_inst" | "team_func"> = {
  personne: "person",
  equipe_inst: "team_inst",
  equipe_func: "team_func",
};

const DISPLAY_PREFIX: Record<"person" | "team_inst" | "team_func", string> = {
  person: "Ressource",
  team_inst: "Équipe organisationnelle",
  team_func: "Équipe chantier",
};

export function encodeAffecteeA(
  kind: "person" | "team_inst" | "team_func",
  id: string,
  label: string
): string {
  const cleanId = id.trim();
  const cleanLabel = label.trim();
  if (!cleanId || !cleanLabel) return "";
  return `${SIMPLE_PREFIX[kind]}:${cleanId}:${cleanLabel}`;
}

/** Équipe organisationnelle + porteur (personne). */
export function encodeOrgAffecteeA(
  teamId: string,
  teamLabel: string,
  personId: string,
  personLabel: string
): string {
  const tId = teamId.trim();
  const pId = personId.trim();
  const tLab = teamLabel.trim().replace(/\|/g, "/");
  const pLab = personLabel.trim().replace(/\|/g, "/");
  if (!tId || !pId || !tLab || !pLab) return "";
  return `org|${tId}|${pId}|${tLab}|${pLab}`;
}

export function parseAffecteeA(raw: string | null | undefined): ParsedAffectation {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "none", id: "", label: "" };

  if (value.startsWith("org|")) {
    const parts = value.split("|");
    // org|teamId|personId|teamLabel|personLabel  (labels may contain nothing with |)
    if (parts.length >= 5) {
      const [, teamId, personId, teamLabel, ...rest] = parts;
      const personLabel = rest.join("|");
      if (teamId && personId && teamLabel && personLabel) {
        return {
          kind: "org",
          teamId,
          personId,
          teamLabel,
          personLabel,
        };
      }
    }
  }

  const m = /^(personne|equipe_inst|equipe_func):([^:]+):(.+)$/.exec(value);
  if (m) {
    const kind = KIND_BY_PREFIX[m[1]];
    if (kind) {
      return { kind, id: m[2], label: m[3].trim() };
    }
  }

  return { kind: "legacy", id: "", label: value };
}

/** Short label for tables / KPI (no technical id). */
export function formatAffecteeADisplay(raw: string | null | undefined): string {
  const parsed = parseAffecteeA(raw);
  if (parsed.kind === "none") return "—";
  if (parsed.kind === "legacy") return parsed.label || "—";
  if (parsed.kind === "person") return parsed.label || "—";
  if (parsed.kind === "org") {
    return `${parsed.personLabel} · ${parsed.teamLabel}`;
  }
  return `${DISPLAY_PREFIX[parsed.kind]} · ${parsed.label}`;
}

export function formatAffecteeAShort(raw: string | null | undefined): string {
  const parsed = parseAffecteeA(raw);
  if (parsed.kind === "none") return "—";
  if (parsed.kind === "org") return parsed.personLabel || "—";
  if (parsed.kind === "legacy") return parsed.label || "—";
  return parsed.label || "—";
}

/** Leadership tags on chantier team for Q&A assignee lists. */
export type ChantierRoleTag = "DC" | "Sup" | "PMO";

export function resolveChantierRoleTag(
  role: string,
  isDirecteur?: boolean
): ChantierRoleTag | null {
  const r = (role || "").trim();
  if (/suppl[eé]ant/i.test(r)) return "Sup";
  if (isDirecteur || /^directeur\s+de\s+chantier$/i.test(r)) return "DC";
  if (/^pmo(\s|$|[-_])/i.test(r) || r.toLowerCase() === "pmo") return "PMO";
  return null;
}

export function chantierRoleTagRank(
  tag: ChantierRoleTag | null | undefined
): number {
  if (tag === "DC") return 0;
  if (tag === "Sup") return 1;
  if (tag === "PMO") return 2;
  return 10;
}
