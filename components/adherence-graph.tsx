"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type NodeProps,
  type EdgeProps,
  type Edge,
  Handle,
  Position,
  BaseEdge,
  getSmoothStepPath,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import {
  ADHERENCE_CRITICITE_COLORS,
  ADHERENCE_TYPE_COLORS,
  ADHERENCE_STATUT_COLORS,
} from "@/lib/adherence-labels";
import {
  buildGraphData,
  type AdherenceForGraph,
} from "@/lib/adherence-graph-utils";
import { AdherenceGraphLegend } from "@/components/adherence-graph-legend";

// ── Custom Node ─────────────────────────────────────────
function ChantierNode({ data }: NodeProps) {
  const d = data as {
    code: string;
    nom: string;
    color: string;
    isCenter: boolean;
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-3 !h-3" />
      <div
        className={`rounded-lg border-2 px-3 py-2 text-center shadow-sm transition-shadow hover:shadow-md ${
          d.isCenter ? "ring-2 ring-offset-2 ring-primary" : ""
        }`}
        style={{
          backgroundColor: d.color,
          borderColor: d.color,
          minWidth: d.isCenter ? 140 : 110,
        }}
      >
        <div className="text-xs font-bold text-white">{d.code}</div>
        <div
          className="text-[10px] text-white/80 truncate max-w-[130px]"
          title={d.nom}
        >
          {d.nom}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-3 !h-3" />
    </>
  );
}

// ── Custom Edge ─────────────────────────────────────────
function AdherenceEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data,
  } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
      />
      {/* Invisible wider path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      {data?.code && (
        <text>
          <textPath
            href={`#${id}`}
            startOffset="50%"
            textAnchor="middle"
            className="fill-muted-foreground text-[9px]"
            dy="-6"
          >
            {data.code as string}
          </textPath>
        </text>
      )}
    </>
  );
}

const nodeTypes = { chantierNode: ChantierNode };
const edgeTypes = { smoothstep: AdherenceEdge };

// ── Edge Tooltip Card ───────────────────────────────────
function EdgeTooltip({
  edge,
  onClose,
}: {
  edge: Edge;
  onClose: () => void;
}) {
  const d = edge.data as {
    code: string;
    type: string;
    criticite: string;
    statut: string;
    description: string;
    date_resolution_prevue: Date | null;
    responsable: string;
  } | undefined;

  if (!d) return null;

  return (
    <div className="absolute top-3 left-3 z-20">
      <Card className="w-80 shadow-lg">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold">{d.code}</CardTitle>
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-accent"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-2 text-sm">
          <div className="flex gap-2">
            <Badge
              variant="secondary"
              style={{
                backgroundColor: (ADHERENCE_TYPE_COLORS[d.type] ?? "#94a3b8") + "20",
                color: ADHERENCE_TYPE_COLORS[d.type] ?? "#94a3b8",
              }}
            >
              {d.type}
            </Badge>
            <Badge
              variant="secondary"
              style={{
                backgroundColor: (ADHERENCE_CRITICITE_COLORS[d.criticite] ?? "#94a3b8") + "20",
                color: ADHERENCE_CRITICITE_COLORS[d.criticite] ?? "#94a3b8",
              }}
            >
              {d.criticite}
            </Badge>
            <Badge
              variant="secondary"
              style={{
                backgroundColor: (ADHERENCE_STATUT_COLORS[d.statut] ?? "#94a3b8") + "20",
                color: ADHERENCE_STATUT_COLORS[d.statut] ?? "#94a3b8",
              }}
            >
              {d.statut}
            </Badge>
          </div>
          {d.description && (
            <p className="text-xs text-muted-foreground">{d.description}</p>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              <span className="font-medium">Échéance:</span>{" "}
              {d.date_resolution_prevue
                ? format(new Date(d.date_resolution_prevue), "dd MMM yyyy", { locale: fr })
                : "—"}
            </span>
            {d.responsable && (
              <span>
                <span className="font-medium">Resp:</span> {d.responsable}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────
interface Props {
  adherences: AdherenceForGraph[];
  centerId?: string;
  height?: number;
}

export function AdherenceGraph({
  adherences,
  centerId,
  height = 500,
}: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphData(adherences, centerId),
    [adherences, centerId]
  );

  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
  }, []);

  if (initialNodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground"
        style={{ height }}
      >
        Aucune adhérence à visualiser
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border overflow-hidden" style={{ height }}>
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {selectedEdge && (
        <EdgeTooltip
          edge={selectedEdge}
          onClose={() => setSelectedEdge(null)}
        />
      )}
      <AdherenceGraphLegend />
    </div>
  );
}
