"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays, User, ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { updateRaid } from "@/app/(app)/actions";
import {
  type StatusConfigItem,
  getStatutsForType,
  getStatutColor,
  RAID_TYPE_COLORS,
} from "@/lib/raid-labels";

interface ActionItem {
  id: string;
  type: string;
  intitule: string;
  responsable: string;
  domaine: string;
  date_echeance: Date | null;
  statut: string;
  categorie: string;
  description: string;
  chantierId: string | null;
  chantier?: { id: string; code: string; nom: string } | null;
  probabilite: number | null;
  impact: number | null;
  strategie: string;
  mitigation: string;
  date_identification: Date | null;
  date_revision: Date | null;
  commentaires: string;
  responsableRessourceId: string | null;
  comiteId: string | null;
  comite?: { id: string; instance: string; numero: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  items: ActionItem[];
  statusConfigs?: StatusConfigItem[];
}

// ── OpenProject-style Kanban Card ──────────────────────

function KanbanCard({
  item,
  isDragging,
  now,
}: {
  item: ActionItem;
  isDragging?: boolean;
  now: Date;
}) {
  const isOverdue =
    item.date_echeance &&
    new Date(item.date_echeance) < now &&
    !["Clôturé", "Abandonné"].includes(item.statut);

  const typeColor = RAID_TYPE_COLORS[item.type] ?? "#6b7280";

  // Generate initials for avatar
  const initials = item.responsable
    ? item.responsable
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <div
      className={`group relative overflow-hidden rounded-md border bg-card shadow-sm transition-all ${
        isDragging
          ? "opacity-60 rotate-[2deg] scale-105 shadow-lg ring-2 ring-primary/40"
          : "hover:shadow-md hover:border-primary/30"
      }`}
    >
      {/* Left color border — OpenProject type indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
        style={{ backgroundColor: typeColor }}
      />

      <div className="pl-3.5 pr-3 py-2.5 space-y-1.5">
        {/* Line 1: Type badge + Chantier code */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none"
            style={{ backgroundColor: typeColor }}
          >
            {item.type}
          </span>
          {item.chantier && (
            <span className="text-[10px] font-medium text-muted-foreground">
              {item.chantier.code}
            </span>
          )}
          {isOverdue && (
            <AlertTriangle className="size-3 text-destructive ml-auto shrink-0" />
          )}
          {/* Hover action — detail link */}
          {item.chantier && (
            <Link
              href={`/chantiers/${item.chantier.id}`}
              className="ml-auto hidden group-hover:flex items-center justify-center size-5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Ouvrir le chantier"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3" />
            </Link>
          )}
        </div>

        {/* Line 2: Title */}
        <p className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground">
          {item.intitule}
        </p>

        {/* Line 3: Assignee + Date */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Assignee with avatar */}
          <div className="flex items-center gap-1.5 min-w-0">
            {item.responsable ? (
              <>
                <div
                  className="size-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ backgroundColor: typeColor }}
                  title={item.responsable}
                >
                  {initials}
                </div>
                <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                  {item.responsable}
                </span>
              </>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground/50">
                <User className="size-3.5" />
                <span className="text-[11px] italic">Non assigné</span>
              </div>
            )}
          </div>

          {/* Date */}
          {item.date_echeance && (
            <div
              className={`flex items-center gap-1 shrink-0 text-[11px] ${
                isOverdue
                  ? "text-destructive font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="size-3" />
              <span>
                {format(new Date(item.date_echeance), "dd MMM yy", {
                  locale: fr,
                })}
              </span>
            </div>
          )}
        </div>

        {/* Optional: Domain tag */}
        {item.domaine && (
          <div className="pt-0.5">
            <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              {item.domaine}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable wrapper ──────────────────────────────────

function DraggableCard({
  item,
  now,
}: {
  item: ActionItem;
  now: Date;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
      data: { item },
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
    >
      <KanbanCard item={item} isDragging={isDragging} now={now} />
    </div>
  );
}

// ── OpenProject-style Column ───────────────────────────

function KanbanColumn({
  status,
  color,
  items,
  now,
}: {
  status: string;
  color: string;
  items: ActionItem[];
  now: Date;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] shrink-0 rounded-lg border bg-muted/20 transition-colors ${
        isOver ? "bg-primary/5 border-primary/40 shadow-inner" : ""
      }`}
    >
      {/* Column header — colored top bar like OpenProject */}
      <div className="rounded-t-lg overflow-hidden">
        <div className="h-1" style={{ backgroundColor: color }} />
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-card">
          <span className="text-sm font-semibold text-foreground truncate">
            {status}
          </span>
          <span
            className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {items.length}
          </span>
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[65vh]">
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} now={now} />
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
            <div className="size-8 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center mb-2">
              <span className="text-xs">0</span>
            </div>
            <p className="text-xs">Aucun élément</p>
          </div>
        )}
      </div>

      {/* Column footer — count summary */}
      <div className="border-t px-3 py-1.5 bg-card rounded-b-lg">
        <span className="text-[10px] text-muted-foreground">
          {items.length} élément{items.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ── Main Kanban Board ──────────────────────────────────

export function ActionKanban({ items, statusConfigs }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [now] = useState(() => new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Get ordered statuses from config or fallback
  const statuses = useMemo(() => {
    if (statusConfigs?.length) {
      const actionConfigs = statusConfigs
        .filter((c) => c.type === items[0]?.type || c.type === "Action")
        .sort((a, b) => a.position - b.position);
      if (actionConfigs.length > 0) {
        return actionConfigs.map((c) => ({ label: c.label, color: c.color }));
      }
    }
    const type = items[0]?.type || "Action";
    return getStatutsForType(type).map((label) => ({
      label: label as string,
      color: getStatutColor(type, label as string),
    }));
  }, [statusConfigs, items]);

  // Group items by status
  const grouped = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const s of statuses) {
      map.set(s.label, []);
    }
    for (const item of items) {
      const list = map.get(item.statut);
      if (list) {
        list.push(item);
      } else {
        const first = statuses[0]?.label;
        if (first) map.get(first)?.push(item);
      }
    }
    return map;
  }, [items, statuses]);

  const activeItem = activeId
    ? items.find((i) => i.id === activeId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || updating) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;

    const item = items.find((i) => i.id === itemId);
    if (!item || item.statut === newStatus) return;
    if (!statuses.some((s) => s.label === newStatus)) return;

    setUpdating(true);
    try {
      await updateRaid(itemId, {
        type: item.type,
        intitule: item.intitule,
        description: item.description,
        categorie: item.categorie,
        chantierId: item.chantierId,
        domaine: item.domaine,
        probabilite: item.probabilite,
        impact: item.impact,
        strategie: item.strategie,
        mitigation: item.mitigation,
        responsable: item.responsable,
        responsableRessourceId: item.responsableRessourceId ?? null,
        statut: newStatus,
        date_identification: item.date_identification
          ? new Date(item.date_identification).toISOString()
          : null,
        date_revision: item.date_revision
          ? new Date(item.date_revision).toISOString()
          : null,
        date_echeance: item.date_echeance
          ? new Date(item.date_echeance).toISOString()
          : null,
        commentaires: item.commentaires,
        comiteId: item.comiteId,
      });
    } catch {
      // Silently fail — page will revalidate
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="relative">
      {updating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
          <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 shadow-lg border text-sm text-muted-foreground">
            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Mise à jour...
          </div>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
          {statuses.map((s) => (
            <KanbanColumn
              key={s.label}
              status={s.label}
              color={s.color}
              items={grouped.get(s.label) ?? []}
              now={now}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="w-[280px]">
              <KanbanCard item={activeItem} isDragging now={now} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
