"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
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
import {
  CalendarDays,
  User,
  ExternalLink,
  AlertTriangle,
  Lock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  type StatusConfigItem,
  getStatutsForType,
  getStatutColor,
  RAID_TYPE_COLORS,
} from "@/lib/raid-labels";
import { canMoveRaidKanbanClient } from "@/lib/raid-labels";
import {
  changeRaidKanbanStatus,
  fetchKanbanMoveContext,
} from "@/app/(app)/raid/[id]/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  equipeId?: string | null;
  comiteId: string | null;
  comite?: { id: string; instance: string; numero: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

type MoveCtx = {
  ressourceId: string | null;
  isProgramme: boolean;
  leadershipChantierIds: string[];
  institutionalEquipeId: string | null;
};

interface Props {
  items: ActionItem[];
  statusConfigs?: StatusConfigItem[];
}

// ── OpenProject-style Kanban Card ──────────────────────

function KanbanCard({
  item,
  isDragging,
  now,
  locked,
}: {
  item: ActionItem;
  isDragging?: boolean;
  now: Date;
  locked?: boolean;
}) {
  const isOverdue =
    item.date_echeance &&
    new Date(item.date_echeance) < now &&
    !["Clôturé", "Abandonné"].includes(item.statut);

  const typeColor = RAID_TYPE_COLORS[item.type] ?? "#6b7280";

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
          : locked
            ? "opacity-90 border-dashed"
            : "hover:shadow-md hover:border-primary/30"
      }`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
        style={{ backgroundColor: typeColor }}
      />

      <div className="pl-3.5 pr-3 py-2.5 space-y-1.5">
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
          {locked && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground"
              title="Lecture seule — non assignée à vous"
            >
              <Lock className="size-2.5" />
              Lecture seule
            </span>
          )}
          {isOverdue && (
            <AlertTriangle className="size-3 text-destructive ml-auto shrink-0" />
          )}
          <Link
            href={`/raid/${item.id}`}
            className="ml-auto hidden group-hover:flex items-center justify-center size-5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Ouvrir l'entrée RAID"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
          </Link>
        </div>

        <p className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground">
          {item.intitule}
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
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

// ── Draggable / static card ────────────────────────────

function DraggableCard({
  item,
  now,
  canMove,
}: {
  item: ActionItem;
  now: Date;
  canMove: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
      data: { item },
      disabled: !canMove,
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  if (!canMove) {
    return (
      <div className="cursor-default">
        <KanbanCard item={item} now={now} locked />
      </div>
    );
  }

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

// ── Column ─────────────────────────────────────────────

function KanbanColumn({
  status,
  color,
  items,
  now,
  canMoveItem,
}: {
  status: string;
  color: string;
  items: ActionItem[];
  now: Date;
  canMoveItem: (item: ActionItem) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] shrink-0 rounded-lg border bg-muted/20 transition-colors ${
        isOver ? "bg-primary/5 border-primary/40 shadow-inner" : ""
      }`}
    >
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

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[65vh]">
        {items.map((item) => (
          <DraggableCard
            key={item.id}
            item={item}
            now={now}
            canMove={canMoveItem(item)}
          />
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

      <div className="border-t px-3 py-1.5 bg-card rounded-b-lg">
        <span className="text-[10px] text-muted-foreground">
          {items.length} élément{items.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ── Main Kanban Board ──────────────────────────────────

export function ActionKanban({ items: propItems, statusConfigs }: Props) {
  const [items, setItems] = useState(propItems);
  const [moveCtx, setMoveCtx] = useState<MoveCtx | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    item: ActionItem;
    newStatus: string;
  } | null>(null);
  const [moveComment, setMoveComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [now] = useState(() => new Date());

  useEffect(() => {
    setItems(propItems);
  }, [propItems]);

  useEffect(() => {
    let cancelled = false;
    fetchKanbanMoveContext()
      .then((ctx) => {
        if (!cancelled) setMoveCtx(ctx);
      })
      .catch(() => {
        if (!cancelled) {
          setMoveCtx({
            ressourceId: null,
            isProgramme: false,
            leadershipChantierIds: [],
            institutionalEquipeId: null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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

  const canMoveItem = (item: ActionItem) => {
    if (!moveCtx) return false;
    return canMoveRaidKanbanClient(item, moveCtx);
  };

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

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const item = items.find((i) => i.id === id);
    if (!item || !canMoveItem(item)) {
      setActiveId(null);
      return;
    }
    setActiveId(id);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || isPending) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;

    const item = items.find((i) => i.id === itemId);
    if (!item || item.statut === newStatus) return;
    if (!statuses.some((s) => s.label === newStatus)) return;
    if (!canMoveItem(item)) {
      setError(
        "Vous ne pouvez déplacer que les actions qui vous sont assignées (ou en tant que Directeur / suppléant / PMO du chantier)."
      );
      return;
    }

    // Open comment dialog before applying
    setPendingMove({ item, newStatus });
    setMoveComment("");
    setError(null);
  }

  function confirmMove() {
    if (!pendingMove) return;
    const note = moveComment.trim();
    if (!note) {
      setError("Un commentaire est obligatoire pour changer le statut.");
      return;
    }
    const { item, newStatus } = pendingMove;
    setError(null);
    startTransition(async () => {
      try {
        await changeRaidKanbanStatus(item.id, newStatus, note);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, statut: newStatus } : i
          )
        );
        setPendingMove(null);
        setMoveComment("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors du déplacement");
      }
    });
  }

  const movableCount = moveCtx
    ? items.filter((i) => canMoveItem(i)).length
    : 0;

  return (
    <div className="relative space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" />
        <span>
          Déplacement : <strong>assigné</strong>, collègues de la même{" "}
          <strong>équipe institutionnelle</strong>, ou{" "}
          <strong>Directeur / suppléant / PMO</strong> du chantier. Commentaire
          obligatoire.
        </span>
        {moveCtx && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
            {movableCount}/{items.length} déplaçable
            {movableCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {error && !pendingMove && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      {isPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
          <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 shadow-lg border text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
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
              canMoveItem={canMoveItem}
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

      {/* Mandatory comment on status move */}
      <Dialog
        open={!!pendingMove}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setPendingMove(null);
            setMoveComment("");
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
          </DialogHeader>
          {pendingMove && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {pendingMove.item.intitule}
                </span>
                <br />
                <span className="text-xs">
                  « {pendingMove.item.statut} » → « {pendingMove.newStatus} »
                </span>
              </p>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Commentaire <span className="text-destructive">*</span>
                </label>
                <textarea
                  className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                  placeholder="Motif du changement de statut (obligatoire)…"
                  value={moveComment}
                  onChange={(e) => setMoveComment(e.target.value)}
                  disabled={isPending}
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setPendingMove(null);
                setMoveComment("");
                setError(null);
              }}
            >
              Annuler
            </Button>
            <Button
              disabled={isPending || !moveComment.trim()}
              onClick={confirmMove}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmer le déplacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
