"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  CalendarCheck,
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
  createComiteParametre,
  updateComiteParametre,
  deleteComiteParametre,
  setComiteParametreActive,
} from "./actions";

export type ComiteParametreRow = {
  id: string;
  name: string;
  description: string;
  frequency: string;
  owner: string;
  short_label: string;
  color: string;
  position: number;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const PRESET_COLORS = [
  "#2563eb",
  "#059669",
  "#0d9488",
  "#7c3aed",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#0891b2",
  "#db2777",
  "#4b5563",
];

const FREQUENCY_SUGGESTIONS = [
  "Hebdomadaire",
  "Bi-hebdomadaire",
  "Bi-mensuel",
  "Mensuel",
  "Trimestriel",
  "Semestriel",
  "Annuel",
  "Ad hoc",
];

const emptyForm = {
  name: "",
  description: "",
  frequency: "",
  owner: "",
  short_label: "",
  color: "#2563eb",
  position: 0,
  is_active: true,
};

export function ComiteParametreManagement({
  initialRows,
}: {
  initialRows: ComiteParametreRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ComiteParametreRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ComiteParametreRow | null>(
    null
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.short_label, r.description, r.frequency, r.owner]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  function openCreate() {
    setEditing(null);
    setError("");
    setForm({
      ...emptyForm,
      position: rows.length > 0 ? Math.max(...rows.map((r) => r.position)) + 1 : 0,
    });
    setDialogOpen(true);
  }

  function openEdit(row: ComiteParametreRow) {
    setEditing(row);
    setError("");
    setForm({
      name: row.name,
      description: row.description,
      frequency: row.frequency,
      owner: row.owner,
      short_label: row.short_label,
      color: row.color || "#6b7280",
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
          await updateComiteParametre(editing.id, form);
        } else {
          await createComiteParametre(form);
        }
        // Refresh local list from server shape
        const next = editing
          ? rows.map((r) =>
              r.id === editing.id
                ? {
                    ...r,
                    ...form,
                    short_label: form.short_label || form.name,
                    updatedAt: new Date(),
                  }
                : r
            )
          : [
              ...rows,
              {
                id: `tmp-${Date.now()}`,
                ...form,
                short_label: form.short_label || form.name,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
        setRows(
          [...next].sort(
            (a, b) => a.position - b.position || a.name.localeCompare(b.name)
          )
        );
        setDialogOpen(false);
        // Full reload to get real ids / timestamps
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
      }
    });
  }

  function handleToggle(row: ComiteParametreRow) {
    setError("");
    startTransition(async () => {
      try {
        await setComiteParametreActive(row.id, !row.is_active);
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
        await deleteComiteParametre(deleteTarget.id);
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
              <CalendarCheck className="size-5 text-[#00BDBB]" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
                Administration
              </p>
              <CardTitle className="text-2xl text-primary">
                Paramètres comités
              </CardTitle>
              <CardDescription className="mt-1">
                Catalogue des types d&apos;instances de comités (nom, fréquence,
                équipe propriétaire). Utilisé par le formulaire « Nouveau comité
                » et le suivi des séances.
              </CardDescription>
            </div>
            <CardAction>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Nouveau type
              </Button>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un type de comité…"
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
                  <th className="px-3 py-2.5 font-medium">Libellé court</th>
                  <th className="px-3 py-2.5 font-medium">Fréquence</th>
                  <th className="px-3 py-2.5 font-medium">Propriétaire</th>
                  <th className="px-3 py-2.5 font-medium">Statut</th>
                  <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Aucun type de comité
                      {search ? " pour cette recherche" : ""}.
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
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1.5 size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                            title={row.color}
                          />
                          <div>
                            <p className="font-medium leading-tight">{row.name}</p>
                            {row.description ? (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {row.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {row.short_label || "—"}
                      </td>
                      <td className="px-3 py-2.5">{row.frequency || "—"}</td>
                      <td className="px-3 py-2.5">{row.owner || "—"}</td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={row.is_active ? "default" : "secondary"}
                          className={
                            row.is_active
                              ? "bg-emerald-600/90 hover:bg-emerald-600/90"
                              : ""
                          }
                        >
                          {row.is_active ? "Actif" : "Inactif"}
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le type de comité" : "Nouveau type de comité"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Nom <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex. Comité Programme"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Libellé court</label>
              <Input
                value={form.short_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, short_label: e.target.value }))
                }
                placeholder="ex. CTR (affiché dans les onglets)"
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
                placeholder="Rôle de cette instance de gouvernance…"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Fréquence</label>
                <Input
                  list="comite-frequency-suggestions"
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, frequency: e.target.value }))
                  }
                  placeholder="ex. Mensuel"
                />
                <datalist id="comite-frequency-suggestions">
                  {FREQUENCY_SUGGESTIONS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Propriétaire (équipe)
                </label>
                <Input
                  value={form.owner}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, owner: e.target.value }))
                  }
                  placeholder="ex. Bureau Programme"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Couleur</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, color: e.target.value }))
                    }
                    className="size-9 cursor-pointer rounded border border-input bg-transparent p-0.5"
                  />
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="size-5 rounded-full border border-black/10 ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ backgroundColor: c }}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
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
                Actif (proposé dans « Nouveau comité »)
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

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le type de comité</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Confirmez la suppression de{" "}
            <span className="font-medium text-foreground">
              {deleteTarget?.name}
            </span>
            . Impossible s&apos;il existe encore des séances liées.
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
