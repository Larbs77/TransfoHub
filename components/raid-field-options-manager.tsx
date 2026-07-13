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
  createRaidFieldOption,
  updateRaidFieldOption,
  deleteRaidFieldOption,
  reorderRaidFieldOptions,
} from "@/app/(app)/actions";
import {
  type RaidFieldKind,
  type RaidFieldOptionItem,
} from "@/lib/raid-labels";

const TABS: { kind: RaidFieldKind; label: string }[] = [
  { kind: "categorie", label: "Catégorie" },
  { kind: "domaine", label: "Domaine" },
];

interface Props {
  fieldOptions: RaidFieldOptionItem[];
}

function OptionRow({
  item,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  item: RaidFieldOptionItem;
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
        className="text-xs shrink-0 max-w-[min(100%,280px)] truncate"
        style={{ backgroundColor: item.color, color: "white" }}
        title={item.label}
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

function OptionDialog({
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
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!label.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSave(label.trim(), color);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
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
          {error && <p className="text-sm text-destructive">{error}</p>}
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

export function RaidFieldOptionsManager({ fieldOptions }: Props) {
  const [editItem, setEditItem] = useState<RaidFieldOptionItem | null>(null);
  const [addKind, setAddKind] = useState<RaidFieldKind | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RaidFieldOptionItem | null>(null);

  const grouped = TABS.map(({ kind, label }) => ({
    kind,
    label,
    items: fieldOptions
      .filter((s) => s.kind === kind)
      .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "fr")),
  }));

  async function handleMoveUp(kind: RaidFieldKind, items: RaidFieldOptionItem[], index: number) {
    if (index === 0) return;
    const newOrder = [...items];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await reorderRaidFieldOptions(
      kind,
      newOrder.map((i) => i.id)
    );
  }

  async function handleMoveDown(kind: RaidFieldKind, items: RaidFieldOptionItem[], index: number) {
    if (index >= items.length - 1) return;
    const newOrder = [...items];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await reorderRaidFieldOptions(
      kind,
      newOrder.map((i) => i.id)
    );
  }

  async function handleDelete(item: RaidFieldOptionItem) {
    await deleteRaidFieldOption(item.id);
    setDeleteConfirm(null);
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Listes déroulantes utilisées à la création / modification des entrées RAID
        et dans les filtres. Les valeurs déjà présentes sur les RAID existants ne
        sont pas modifiées si vous supprimez une option.
      </p>
      <Tabs defaultValue="categorie" className="space-y-4">
        <TabsList>
          {grouped.map((g) => (
            <TabsTrigger key={g.kind} value={g.kind}>
              {g.label}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {g.items.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {grouped.map((group) => (
          <TabsContent key={group.kind} value={group.kind}>
            <div className="space-y-2">
              {group.items.map((item, index) => (
                <OptionRow
                  key={item.id}
                  item={item}
                  isFirst={index === 0}
                  isLast={index === group.items.length - 1}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteConfirm(item)}
                  onMoveUp={() => handleMoveUp(group.kind, group.items, index)}
                  onMoveDown={() => handleMoveDown(group.kind, group.items, index)}
                />
              ))}
              {group.items.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucune valeur — ajoutez une option pour peupler la liste.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddKind(group.kind)}
                className="mt-2 gap-2"
              >
                <Plus className="size-4" />
                Ajouter {group.kind === "categorie" ? "une catégorie" : "un domaine"}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {editItem && (
        <OptionDialog
          open
          onOpenChange={(open) => !open && setEditItem(null)}
          initial={{ label: editItem.label, color: editItem.color }}
          onSave={async (label, color) => {
            await updateRaidFieldOption(editItem.id, { label, color });
            setEditItem(null);
          }}
          title={`Modifier — ${editItem.kind === "domaine" ? "Domaine" : "Catégorie"}`}
        />
      )}

      {addKind && (
        <OptionDialog
          open
          onOpenChange={(open) => !open && setAddKind(null)}
          initial={{ label: "", color: "#6b7280" }}
          onSave={async (label, color) => {
            const items = grouped.find((g) => g.kind === addKind)?.items ?? [];
            await createRaidFieldOption({
              kind: addKind,
              label,
              color,
              position: items.length,
            });
            setAddKind(null);
          }}
          title={`Ajouter — ${addKind === "domaine" ? "Domaine" : "Catégorie"}`}
        />
      )}

      {deleteConfirm && (
        <Dialog open onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Supprimer l&apos;option</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Supprimer &laquo;{deleteConfirm.label}&raquo; de la liste{" "}
              {deleteConfirm.kind === "domaine" ? "Domaine" : "Catégorie"}&nbsp;?
              Les entrées RAID existantes avec cette valeur ne seront pas
              modifiées.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
