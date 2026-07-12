"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  UsersRound,
  ToggleLeft,
  ToggleRight,
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
import {
  createEquipe,
  updateEquipe,
  deleteEquipe,
  setEquipeActive,
} from "./actions";

export type EquipeRow = {
  id: string;
  name: string;
  description: string;
  position: number;
  is_active: boolean;
  comiteCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const emptyForm = {
  name: "",
  description: "",
  position: 0,
  is_active: true,
};

export function EquipeManagement({
  initialRows,
}: {
  initialRows: EquipeRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EquipeRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<EquipeRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.description].join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  function openCreate() {
    setEditing(null);
    setError("");
    setForm({
      ...emptyForm,
      position:
        rows.length > 0 ? Math.max(...rows.map((r) => r.position)) + 1 : 0,
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
    });
    setDialogOpen(true);
  }

  function handleSave() {
    setError("");
    startTransition(async () => {
      try {
        if (editing) {
          await updateEquipe(editing.id, form);
        } else {
          await createEquipe(form);
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
              <CardDescription className="mt-1">
                Catalogue des équipes / unités organisationnelles de la banque.
                Utilisé comme propriétaire des types de comités (Paramètres
                comités).
              </CardDescription>
            </div>
            <CardAction>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Nouvelle équipe
              </Button>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher une équipe…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error && !dialogOpen && !deleteTarget && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Ordre</th>
                  <th className="px-3 py-2.5 font-medium">Nom</th>
                  <th className="px-3 py-2.5 font-medium">Description</th>
                  <th className="px-3 py-2.5 font-medium">Comités</th>
                  <th className="px-3 py-2.5 font-medium">Statut</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Aucune équipe{search ? " pour cette recherche" : ""}.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t transition-colors hover:bg-muted/30"
                    >
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {row.position}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{row.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {row.description || "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.comiteCount}
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
                            onClick={() => handleToggle(row)}
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
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            title="Supprimer"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setError("");
                              setDeleteTarget(row);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'équipe" : "Nouvelle équipe"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Nom <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="ex. Bureau Programme"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Rôle de l'équipe dans la banque…"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Ordre d&apos;affichage</label>
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
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
                className="size-4 rounded border-input accent-primary"
              />
              <span className="text-sm font-medium">
                Active (proposée comme propriétaire de comité)
              </span>
            </label>
            {error && dialogOpen && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Annuler
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={isPending || !form.name.trim()}
              onClick={handleSave}
            >
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;équipe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirmez la suppression de{" "}
            <span className="font-medium text-foreground">
              {deleteTarget?.name}
            </span>
            . Impossible s&apos;il reste des types de comités liés.
          </p>
          {error && deleteTarget && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeleteTarget(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
