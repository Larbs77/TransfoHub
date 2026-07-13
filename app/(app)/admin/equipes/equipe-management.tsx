"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  UsersRound,
  ToggleLeft,
  ToggleRight,
  Building2,
  FolderKanban,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  createEquipe,
  updateEquipe,
  deleteEquipe,
  setEquipeActive,
} from "./actions";
import {
  EQUIPE_TYPE_DESCRIPTIONS,
  EQUIPE_TYPE_LABELS,
  EQUIPE_TYPES,
  type EquipeType,
} from "@/lib/equipe-types";

export type EquipeRow = {
  id: string;
  name: string;
  description: string;
  position: number;
  is_active: boolean;
  type: EquipeType;
  chantierId: string | null;
  chantier: { id: string; code: string; nom: string } | null;
  comiteCount: number;
  hierarchieCount: number;
  fonctionnelCount: number;
  raidCount: number;
  raidCategorieOptionIds: string[];
  raidCategorieLabels: { id: string; label: string; color: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export type CategorieOption = {
  id: string;
  label: string;
  color: string;
};

const emptyForm = {
  name: "",
  description: "",
  position: 0,
  is_active: true,
  raidCategorieOptionIds: [] as string[],
};

export function EquipeManagement({
  initialRows,
  categorieOptions = [],
}: {
  initialRows: EquipeRow[];
  categorieOptions?: CategorieOption[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"institutionnelle" | "fonctionnelle">(
    "institutionnelle"
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EquipeRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<EquipeRow | null>(null);

  const categorieSelectOptions = useMemo(
    () =>
      categorieOptions.map((c) => ({
        value: c.id,
        label: c.label,
      })),
    [categorieOptions]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.type !== tab) return false;
      if (!q) return true;
      return [r.name, r.description, r.chantier?.code, r.chantier?.nom]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, tab]);

  const counts = useMemo(
    () => ({
      institutionnelle: rows.filter(
        (r) => r.type === EQUIPE_TYPES.institutionnelle
      ).length,
      fonctionnelle: rows.filter((r) => r.type === EQUIPE_TYPES.fonctionnelle)
        .length,
    }),
    [rows]
  );

  function openCreate() {
    setEditing(null);
    setError("");
    const inst = rows.filter((r) => r.type === EQUIPE_TYPES.institutionnelle);
    setForm({
      ...emptyForm,
      position:
        inst.length > 0 ? Math.max(...inst.map((r) => r.position)) + 1 : 0,
      raidCategorieOptionIds: [],
    });
    setDialogOpen(true);
  }

  function openEdit(row: EquipeRow) {
    setEditing(row);
    setError("");
    setForm({
      name: row.name,
      description: row.description,
      position: row.position,
      is_active: row.is_active,
      raidCategorieOptionIds: row.raidCategorieOptionIds ?? [],
    });
    setDialogOpen(true);
  }

  function handleSave() {
    setError("");
    startTransition(async () => {
      try {
        if (editing) {
          await updateEquipe(editing.id, {
            name: form.name,
            description: form.description,
            position: form.position,
            is_active: form.is_active,
            ...(editing.type === EQUIPE_TYPES.institutionnelle
              ? { raidCategorieOptionIds: form.raidCategorieOptionIds }
              : {}),
          });
        } else {
          await createEquipe({
            name: form.name,
            description: form.description,
            position: form.position,
            is_active: form.is_active,
            raidCategorieOptionIds: form.raidCategorieOptionIds,
          });
        }
        setDialogOpen(false);
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
      }
    });
  }

  function handleToggle(row: EquipeRow) {
    setError("");
    startTransition(async () => {
      try {
        await setEquipeActive(row.id, !row.is_active);
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, is_active: !r.is_active } : r
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setError("");
    startTransition(async () => {
      try {
        await deleteEquipe(deleteTarget.id);
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setDeleteTarget(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de suppression");
      }
    });
  }

  const isFunctionalEdit =
    editing?.type === EQUIPE_TYPES.fonctionnelle;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <UsersRound className="size-5 text-[#00BDBB]" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
                Administration
              </p>
              <CardTitle className="text-2xl text-primary">
                Gestion des équipes
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Deux natures d&apos;équipes :{" "}
                <strong>Institutionnelle</strong> (organisation banque) et{" "}
                <strong>Fonctionnelle</strong> (équipe programme d&apos;un
                chantier, créée automatiquement).
              </CardDescription>
            </div>
            <CardAction>
              {tab === "institutionnelle" && (
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  Nouvelle équipe institutionnelle
                </Button>
              )}
            </CardAction>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={tab}
            onValueChange={(v) =>
              setTab(v as "institutionnelle" | "fonctionnelle")
            }
          >
            <TabsList className="h-auto flex-wrap gap-1 p-1">
              <TabsTrigger value="institutionnelle" className="gap-2">
                <Building2 className="size-3.5" />
                Institutionnelles
                <Badge variant="secondary" className="text-[10px]">
                  {counts.institutionnelle}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="fonctionnelle" className="gap-2">
                <FolderKanban className="size-3.5" />
                Fonctionnelles (chantiers)
                <Badge variant="secondary" className="text-[10px]">
                  {counts.fonctionnelle}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <p className="mt-3 text-sm text-muted-foreground">
              {EQUIPE_TYPE_DESCRIPTIONS[tab]}
            </p>

            <div className="relative mt-4 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={
                  tab === "institutionnelle"
                    ? "Rechercher une équipe institutionnelle…"
                    : "Rechercher une équipe chantier…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {error && !dialogOpen && !deleteTarget && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <TabsContent value="institutionnelle" className="mt-4">
              <EquipeTable
                rows={filtered}
                kind="institutionnelle"
                isPending={isPending}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={(row) => {
                  setError("");
                  setDeleteTarget(row);
                }}
              />
            </TabsContent>
            <TabsContent value="fonctionnelle" className="mt-4">
              <EquipeTable
                rows={filtered}
                kind="fonctionnelle"
                isPending={isPending}
                onToggle={handleToggle}
                onEdit={openEdit}
                onDelete={(row) => {
                  setError("");
                  setDeleteTarget(row);
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? isFunctionalEdit
                  ? "Équipe fonctionnelle"
                  : "Modifier l'équipe institutionnelle"
                : "Nouvelle équipe institutionnelle"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {isFunctionalEdit && editing?.chantier && (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Chantier lié
                </p>
                <Link
                  href={`/chantiers/${editing.chantier.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {editing.chantier.code} — {editing.chantier.nom}
                </Link>
              </div>
            )}
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Nom {!isFunctionalEdit && <span className="text-destructive">*</span>}
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="ex. Bureau Programme"
                required={!isFunctionalEdit}
                disabled={!!isFunctionalEdit}
              />
              {isFunctionalEdit && (
                <p className="text-[11px] text-muted-foreground">
                  Le nom suit le code / intitulé du chantier (mis à jour
                  automatiquement).
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder={
                  isFunctionalEdit
                    ? "Notes sur l'équipe programme…"
                    : "Rôle de l'équipe dans la banque…"
                }
              />
            </div>
            {!isFunctionalEdit && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Ordre d&apos;affichage
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.position}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      position: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
              />
              <span className="text-sm font-medium">Équipe active</span>
            </label>

            {!isFunctionalEdit && (
              <div className="grid gap-1.5 rounded-lg border border-[#0A3C74]/12 bg-muted/20 p-3">
                <label className="text-sm font-medium">
                  Accès spécial RAID par catégorie
                </label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Par défaut : aucun (accès normal uniquement). Si des
                  catégories sont sélectionnées, les membres de cette équipe
                  institutionnelle conservent leurs droits actuels{" "}
                  <strong>et</strong> accèdent à toutes les entrées RAID de ces
                  catégories (liste, collaboration, statut).
                </p>
                {categorieSelectOptions.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Aucune catégorie paramétrée. Ajoutez-en dans Paramètres →
                    Catégories et Domaines RAID.
                  </p>
                ) : (
                  <MultiSelect
                    options={categorieSelectOptions}
                    selected={form.raidCategorieOptionIds}
                    onChange={(ids) =>
                      setForm((f) => ({ ...f, raidCategorieOptionIds: ids }))
                    }
                    placeholder="Aucune (accès normal)"
                  />
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Annuler
              </Button>
            </DialogClose>
            <Button type="button" disabled={isPending} onClick={handleSave}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;équipe ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supprimer « {deleteTarget?.name} » ? Cette action est irréversible.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EquipeTable({
  rows,
  kind,
  isPending,
  onToggle,
  onEdit,
  onDelete,
}: {
  rows: EquipeRow[];
  kind: EquipeType;
  isPending: boolean;
  onToggle: (row: EquipeRow) => void;
  onEdit: (row: EquipeRow) => void;
  onDelete: (row: EquipeRow) => void;
}) {
  const isFunc = kind === EQUIPE_TYPES.fonctionnelle;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {!isFunc && <th className="px-3 py-2.5 font-medium">Ordre</th>}
            <th className="px-3 py-2.5 font-medium">Nom</th>
            {isFunc && (
              <th className="px-3 py-2.5 font-medium">Chantier</th>
            )}
            <th className="px-3 py-2.5 font-medium">Description</th>
            {isFunc ? (
              <>
                <th className="px-3 py-2.5 font-medium">Membres</th>
                <th className="px-3 py-2.5 font-medium">RAID</th>
              </>
            ) : (
              <>
                <th className="px-3 py-2.5 font-medium">Ressources</th>
                <th className="px-3 py-2.5 font-medium">Comités</th>
                <th className="px-3 py-2.5 font-medium">Accès RAID</th>
              </>
            )}
            <th className="px-3 py-2.5 font-medium">Type</th>
            <th className="px-3 py-2.5 font-medium">Statut</th>
            <th className="px-3 py-2.5 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={isFunc ? 8 : 9}
                className="px-3 py-10 text-center text-muted-foreground"
              >
                Aucune équipe {EQUIPE_TYPE_LABELS[kind].toLowerCase()}.
                {isFunc &&
                  " Les équipes fonctionnelles sont créées automatiquement avec chaque chantier."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-t transition-colors hover:bg-muted/30"
              >
                {!isFunc && (
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {row.position}
                  </td>
                )}
                <td className="px-3 py-2.5 font-medium">{row.name}</td>
                {isFunc && (
                  <td className="px-3 py-2.5">
                    {row.chantier ? (
                      <Link
                        href={`/chantiers/${row.chantier.id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <span className="font-mono text-xs">
                          {row.chantier.code}
                        </span>
                        <ExternalLink className="size-3 opacity-60" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-3 py-2.5 text-muted-foreground max-w-[240px] truncate">
                  {row.description || "—"}
                </td>
                {isFunc ? (
                  <>
                    <td className="px-3 py-2.5 tabular-nums">
                      {row.fonctionnelCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{row.raidCount}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2.5 tabular-nums">
                      {row.hierarchieCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {row.comiteCount}
                    </td>
                    <td className="px-3 py-2.5">
                      {(row.raidCategorieLabels?.length ?? 0) === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Aucun
                        </span>
                      ) : (
                        <div className="flex max-w-[200px] flex-wrap gap-1">
                          {row.raidCategorieLabels.map((c) => (
                            <Badge
                              key={c.id}
                              className="text-[10px] max-w-full truncate"
                              style={{
                                backgroundColor: c.color,
                                color: "white",
                              }}
                              title={c.label}
                            >
                              {c.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                  </>
                )}
                <td className="px-3 py-2.5">
                  <Badge
                    variant="outline"
                    className={
                      isFunc
                        ? "border-teal-500/40 text-teal-800 dark:text-teal-200"
                        : "border-primary/30 text-primary"
                    }
                  >
                    {EQUIPE_TYPE_LABELS[row.type]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    variant={row.is_active ? "default" : "secondary"}
                    className={
                      row.is_active
                        ? "bg-emerald-600/90 hover:bg-emerald-600/90"
                        : ""
                    }
                  >
                    {row.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title={row.is_active ? "Désactiver" : "Activer"}
                      disabled={isPending}
                      onClick={() => onToggle(row)}
                    >
                      {row.is_active ? (
                        <ToggleRight className="size-4 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      title="Modifier"
                      onClick={() => onEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {!isFunc && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        title="Supprimer"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
