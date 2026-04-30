"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus, GripVertical, Loader2 } from "lucide-react";
import {
  createStatusConfig,
  updateStatusConfig,
  deleteStatusConfig,
  reorderStatusConfigs,
} from "@/app/(app)/actions";
import { RAID_TYPES, type StatusConfigItem } from "@/lib/raid-labels";

interface Props {
  statusConfigs: StatusConfigItem[];
}

function StatusRow({
  item,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: StatusConfigItem;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
      <GripVertical className="size-4 text-muted-foreground shrink-0" />
      <Badge
        className="text-xs shrink-0"
        style={{ backgroundColor: item.color, color: "white" }}
      >
        {item.label}
      </Badge>
      <div className="flex-1" />
      <div
        className="size-5 rounded border shrink-0"
        style={{ backgroundColor: item.color }}
        title={item.color}
      />
      <span className="text-xs text-muted-foreground w-16 text-right">{item.color}</span>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isFirst}
          onClick={onMoveUp}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isLast}
          onClick={onMoveDown}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onDelete}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function StatusDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { label: string; color: string };
  onSave: (label: string, color: string) => Promise<void>;
  title: string;
}) {
  const [label, setLabel] = useState(initial.label);
  const [color, setColor] = useState(initial.color);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!label.trim()) return;
    setLoading(true);
    try {
      await onSave(label.trim(), color);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Libellé</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Couleur</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-10 rounded border cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-28 font-mono text-sm"
                maxLength={7}
              />
              <Badge style={{ backgroundColor: color, color: "white" }}>
                {label || "Aperçu"}
              </Badge>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading || !label.trim()}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatusWorkflowManager({ statusConfigs }: Props) {
  const [editItem, setEditItem] = useState<StatusConfigItem | null>(null);
  const [addType, setAddType] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StatusConfigItem | null>(null);

  const grouped = RAID_TYPES.map((type) => ({
    type,
    items: statusConfigs
      .filter((s) => s.type === type)
      .sort((a, b) => a.position - b.position),
  }));

  async function handleMoveUp(type: string, items: StatusConfigItem[], index: number) {
    if (index === 0) return;
    const newOrder = [...items];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await reorderStatusConfigs(type, newOrder.map((i) => i.id));
  }

  async function handleMoveDown(type: string, items: StatusConfigItem[], index: number) {
    if (index >= items.length - 1) return;
    const newOrder = [...items];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await reorderStatusConfigs(type, newOrder.map((i) => i.id));
  }

  async function handleDelete(item: StatusConfigItem) {
    await deleteStatusConfig(item.id);
    setDeleteConfirm(null);
  }

  return (
    <>
      <Tabs defaultValue="Action" className="space-y-4">
        <TabsList>
          {RAID_TYPES.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {grouped.find((g) => g.type === t)?.items.length ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {grouped.map((group) => (
          <TabsContent key={group.type} value={group.type}>
            <div className="space-y-2">
              {group.items.map((item, index) => (
                <StatusRow
                  key={item.id}
                  item={item}
                  isFirst={index === 0}
                  isLast={index === group.items.length - 1}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteConfirm(item)}
                  onMoveUp={() => handleMoveUp(group.type, group.items, index)}
                  onMoveDown={() => handleMoveDown(group.type, group.items, index)}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddType(group.type)}
                className="mt-2 gap-2"
              >
                <Plus className="size-4" />
                Ajouter un statut
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit dialog */}
      {editItem && (
        <StatusDialog
          open
          onOpenChange={(open) => !open && setEditItem(null)}
          initial={{ label: editItem.label, color: editItem.color }}
          onSave={async (label, color) => {
            await updateStatusConfig(editItem.id, { label, color });
            setEditItem(null);
          }}
          title="Modifier le statut"
        />
      )}

      {/* Add dialog */}
      {addType && (
        <StatusDialog
          open
          onOpenChange={(open) => !open && setAddType(null)}
          initial={{ label: "", color: "#6b7280" }}
          onSave={async (label, color) => {
            const items = grouped.find((g) => g.type === addType)?.items ?? [];
            await createStatusConfig({
              type: addType,
              label,
              color,
              position: items.length,
            });
            setAddType(null);
          }}
          title={`Ajouter un statut — ${addType}`}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <Dialog open onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Supprimer le statut</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Supprimer le statut &laquo;{deleteConfirm.label}&raquo; ?
              Les éléments RAID existants avec ce statut ne seront pas modifiés.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
