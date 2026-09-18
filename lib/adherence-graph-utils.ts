import type { Node, Edge } from "@xyflow/react";
import { STATUT_CHANTIER_COLORS } from "@/lib/chantier-labels";
import {
  ADHERENCE_CRITICITE_COLORS,
  chantiersFromDependants,
  type AdherenceChantierRef,
} from "@/lib/adherence-labels";

interface ChantierRef {
  id: string;
  code: string;
  nom: string;
  domaine: string;
  statut: string;
}

export interface AdherenceForGraph {
  id: string;
  code: string;
  chantierSourceId: string;
  chantierSource?: ChantierRef | null;
  chantierDependantLabel: string;
  dependants?: Array<{ chantier: AdherenceChantierRef }>;
  type: string;
  domaine: string;
  description: string;
  criticite: string;
  statut: string;
  date_resolution_prevue: Date | null;
  responsable: string;
}

const CRITICITE_STROKE: Record<string, number> = {
  BLOQUANTE: 4,
  FORTE: 3,
  "MODÉRÉE": 2,
  FAIBLE: 1.5,
};

export function buildGraphData(
  adherences: AdherenceForGraph[],
  centerId?: string
) {
  const withTargets = adherences
    .map((a) => ({
      adherence: a,
      targets: chantiersFromDependants(a.dependants),
    }))
    .filter((x) => x.targets.length > 0 && x.adherence.chantierSource);

  const filtered = centerId
    ? withTargets.filter(
        (x) =>
          x.adherence.chantierSourceId === centerId ||
          x.targets.some((t) => t.id === centerId)
      )
    : withTargets;

  const chantierMap = new Map<string, ChantierRef>();
  for (const { adherence: a, targets } of filtered) {
    if (a.chantierSource && !chantierMap.has(a.chantierSource.id)) {
      chantierMap.set(a.chantierSource.id, a.chantierSource as ChantierRef);
    }
    for (const t of targets) {
      if (!chantierMap.has(t.id)) {
        chantierMap.set(t.id, {
          id: t.id,
          code: t.code,
          nom: t.nom,
          domaine: t.domaine ?? "",
          statut: t.statut ?? "",
        });
      }
    }
  }

  const chantiers = Array.from(chantierMap.values());
  const positions = centerId
    ? circularLayout(chantiers, centerId)
    : gridLayout(chantiers);

  const nodes: Node[] = chantiers.map((c) => ({
    id: c.id,
    type: "chantierNode",
    position: positions.get(c.id) ?? { x: 0, y: 0 },
    data: {
      code: c.code,
      nom: c.nom,
      statut: c.statut,
      domaine: c.domaine,
      color: STATUT_CHANTIER_COLORS[c.statut] ?? "#6b7280",
      isCenter: c.id === centerId,
    },
  }));

  const edges: Edge[] = filtered.flatMap(({ adherence: a, targets }) =>
    targets.map((t) => ({
    id: `${a.id}-${t.id}`,
    source: a.chantierSourceId,
    target: t.id,
    type: "smoothstep",
    animated: a.criticite === "BLOQUANTE",
    markerEnd: { type: "arrowclosed" as const, color: ADHERENCE_CRITICITE_COLORS[a.criticite] ?? "#94a3b8" },
    style: {
      stroke: ADHERENCE_CRITICITE_COLORS[a.criticite] ?? "#94a3b8",
      strokeWidth: CRITICITE_STROKE[a.criticite] ?? 2,
    },
    data: {
      code: a.code,
      type: a.type,
      criticite: a.criticite,
      statut: a.statut,
      description: a.description,
      date_resolution_prevue: a.date_resolution_prevue,
      responsable: a.responsable,
    },
    }))
  );

  return { nodes, edges };
}

function circularLayout(
  chantiers: ChantierRef[],
  centerId: string
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const others = chantiers.filter((c) => c.id !== centerId);
  const radius = Math.max(200, others.length * 45);

  positions.set(centerId, { x: 0, y: 0 });

  others.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
    positions.set(c.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });

  return positions;
}

function gridLayout(
  chantiers: ChantierRef[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const cols = Math.ceil(Math.sqrt(chantiers.length));
  const spacingX = 280;
  const spacingY = 150;

  chantiers.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(c.id, { x: col * spacingX, y: row * spacingY });
  });

  return positions;
}
