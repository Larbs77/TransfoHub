"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { ProfilRessourceFormDialog } from "./profil-ressource-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { deleteProfilRessource } from "@/app/(app)/actions";
import {
  RESSOURCE_TYPE_LABELS,
  RESSOURCE_TYPE_COLORS,
} from "@/lib/ressource-labels";

interface ProfilWithCount {
  id: string;
  nom: string;
  type_ressource: string;
  tjm_defaut: number;
  ordre: number;
  actif: boolean;
  _count: { ressources: number };
}

interface Props {
  profils: ProfilWithCount[];
}

const TYPE_ORDER = ["Interne", "Externe", "Consultant"];

type SortField = "nom" | "tjm_defaut";
type SortDir = "asc" | "desc";

const ACTIF_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "true", label: "Actif" },
  { value: "false", label: "Inactif" },
];

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  current: SortField | null;
  dir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  return (
    <button
      className={`flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      {label}
      {current === field ? (
        dir === "asc" ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );
}

function ProfilTable({
  items,
  sortField,
  sortDir,
  onSort,
  onEdit,
  onDelete,
}: {
  items: ProfilWithCount[];
  sortField: SortField | null;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  onEdit: (p: ProfilWithCount) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = useMemo(() => {
    if (!sortField) return items;
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortField === "nom") cmp = a.nom.localeCompare(b.nom);
      else if (sortField === "tjm_defaut") cmp = a.tjm_defaut - b.tjm_defaut;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [items, sortField, sortDir]);

  if (sorted.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        Aucun profil trouvé
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortHeader
              label="Nom du profil"
              field="nom"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
            />
          </TableHead>
          <TableHead className="text-right">
            <SortHeader
              label="TJM défaut (MAD)"
              field="tjm_defaut"
              current={sortField}
              dir={sortDir}
              onSort={onSort}
              className="justify-end"
            />
          </TableHead>
          <TableHead className="text-center">Ordre</TableHead>
          <TableHead className="text-center">Ressources</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="w-[80px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium text-sm">{p.nom}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {p.tjm_defaut > 0
                ? `${p.tjm_defaut.toLocaleString("fr-MA")} MAD`
                : "—"}
            </TableCell>
            <TableCell className="text-center text-sm tabular-nums">
              {p.ordre}
            </TableCell>
            <TableCell className="text-center text-sm tabular-nums">
              {p._count.ressources}
            </TableCell>
            <TableCell>
              <Badge
                variant={p.actif ? "default" : "secondary"}
                className={`text-[10px] ${p.actif ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
              >
                {p.actif ? "Actif" : "Inactif"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onEdit(p)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDelete(p.id)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ProfilRessourceList({ profils }: Props) {
  const [search, setSearch] = useState("");
  const [filterActif, setFilterActif] = useState("all");
  const [tjmMin, setTjmMin] = useState("");
  const [tjmMax, setTjmMax] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [editProfil, setEditProfil] = useState<ProfilWithCount | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let result = profils;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.nom.toLowerCase().includes(q));
    }
    if (filterActif !== "all") {
      result = result.filter((p) => String(p.actif) === filterActif);
    }
    if (tjmMin) {
      const min = Number(tjmMin);
      if (!isNaN(min)) result = result.filter((p) => p.tjm_defaut >= min);
    }
    if (tjmMax) {
      const max = Number(tjmMax);
      if (!isNaN(max)) result = result.filter((p) => p.tjm_defaut <= max);
    }

    return result;
  }, [profils, search, filterActif, tjmMin, tjmMax]);

  const hasActiveFilters =
    search || filterActif !== "all" || tjmMin || tjmMax;

  // Group by type for tabs
  const grouped = useMemo(() => {
    const groups: Record<string, ProfilWithCount[]> = {};
    for (const type of TYPE_ORDER) {
      groups[type] = filtered.filter((p) => p.type_ressource === type);
    }
    return groups;
  }, [filtered]);

  function handleDelete(id: string) {
    setDeleteError(null);
    setDeleteId(id);
  }

  return (
    <>
      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">TJM</span>
            <Input
              type="number"
              placeholder="Min"
              value={tjmMin}
              onChange={(e) => setTjmMin(e.target.value)}
              className="w-24"
              min={0}
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="number"
              placeholder="Max"
              value={tjmMax}
              onChange={(e) => setTjmMax(e.target.value)}
              className="w-24"
              min={0}
            />
          </div>
          <Select value={filterActif} onValueChange={setFilterActif}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              {ACTIF_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilterActif("all");
                setTjmMin("");
                setTjmMax("");
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} / {profils.length} profil(s)
          </span>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nouveau profil
          </Button>
        </div>
      </div>

      {/* Tabs by type */}
      <Tabs defaultValue="Interne" className="space-y-4">
        <TabsList>
          {TYPE_ORDER.map((type) => (
            <TabsTrigger key={type} value={type} className="gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: RESSOURCE_TYPE_COLORS[type] }}
              />
              {RESSOURCE_TYPE_LABELS[type]}
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: RESSOURCE_TYPE_COLORS[type] }}
              >
                {grouped[type]?.length ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TYPE_ORDER.map((type) => (
          <TabsContent key={type} value={type}>
            <ProfilTable
              items={grouped[type] ?? []}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              onEdit={setEditProfil}
              onDelete={handleDelete}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Create dialog */}
      {createOpen && (
        <ProfilRessourceFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {/* Edit dialog */}
      {editProfil && (
        <ProfilRessourceFormDialog
          open={!!editProfil}
          onOpenChange={(open) => !open && setEditProfil(null)}
          profil={editProfil}
        />
      )}

      {/* Delete dialog */}
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={async () => {
          try {
            if (deleteId) await deleteProfilRessource(deleteId);
          } catch (err) {
            setDeleteError(
              err instanceof Error ? err.message : "Erreur de suppression"
            );
            throw err;
          }
        }}
        title="Supprimer le profil"
      />
      {deleteError && (
        <p className="text-xs text-destructive mt-2">{deleteError}</p>
      )}
    </>
  );
}
