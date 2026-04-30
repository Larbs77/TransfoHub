import type { Node, Edge } from "@xyflow/react";
import { STATUT_CHANTIER_COLORS } from "@/lib/chantier-labels";
import { ADHERENCE_CRITICITE_COLORS } from "@/lib/adherence-labels";

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
  chantierDependantId: string | null;
  chantierDependant?: ChantierRef | null;
  chantierDependantLabel: string;
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
  // Filter out transverse (no target node)
  const validAdherences = adherences.filter(
    (a) => a.chantierDependantId && a.chantierSource && a.chantierDependant
  );

  // If centerId, filter to 1-hop neighborhood
  const filtered = centerId
    ? validAdherences.filter(
        (a) =>
          a.chantierSourceId === centerId ||
          a.chantierDependantId === centerId
      )
    : validAdherences;

  // Collect unique chantiers
  const chantierMap = new Map<string, ChantierRef>();
  for (const a of filtered) {
    if (a.chantierSource && !chantierMap.has(a.chantierSource.id)) {
      chantierMap.set(a.chantierSource.id, a.chantierSource);
    }
    if (a.chantierDependant && !chantierMap.has(a.chantierDependant.id)) {
      chantierMap.set(a.chantierDependant.id, a.chantierDependant);
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

  const edges: Edge[] = filtered.map((a) => ({
    id: a.id,
    source: a.chantierSourceId,
    target: a.chantierDependantId!,
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
  }));

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
