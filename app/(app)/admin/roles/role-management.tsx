"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldOff,
  Plus,
  Pencil,
  Search,
  ToggleLeft,
  ToggleRight,
  Users,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AppPage } from "@/lib/app-pages";
import { CHANTIER_SCOPES } from "@/lib/app-pages";
import { createRole, updateRole, setRoleActive } from "./actions";

type RoleRow = {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
  is_active: boolean;
  is_system: boolean;
  chantier_scope: string;
  pages: string[];
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const PRESET_COLORS = [
  "#dc2626",
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#0891b2",
  "#db2777",
  "#4b5563",
];

const emptyForm = {
  label: "",
  description: "",
  color: "#2563eb",
  chantier_scope: "assigned",
  pages: [] as string[],
};

export function RoleManagement({
  initialRoles,
  appPages,
}: {
  initialRoles: RoleRow[];
  appPages: AppPage[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sections = useMemo(() => {
    const map = new Map<string, AppPage[]>();
    for (const page of appPages) {
      const list = map.get(page.section) ?? [];
      list.push(page);
      map.set(page.section, list);
    }
    return [...map.entries()];
  }, [appPages]);

  const filtered = useMemo(() => {
    let list = [...initialRoles];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }
    if (statusFilter === "active") list = list.filter((r) => r.is_active);
    if (statusFilter === "inactive") list = list.filter((r) => !r.is_active);
    return list;
  }, [initialRoles, search, statusFilter]);

  const activeCount = initialRoles.filter((r) => r.is_active).length;

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      pages: ["/", "/chantiers"],
    });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    setEditing(role);
    setForm({
      label: role.label,
      description: role.description,
      color: role.color,
      chantier_scope: role.chantier_scope,
      pages: [...role.pages],
    });
    setError("");
    setDialogOpen(true);
  };

  const togglePage = (path: string) => {
    if (editing?.code === "Admin") return;
    setForm((f) => ({
      ...f,
      pages: f.pages.includes(path)
        ? f.pages.filter((p) => p !== path)
        : [...f.pages, path],
    }));
  };

  const toggleSection = (paths: string[], checked: boolean) => {
    if (editing?.code === "Admin") return;
    setForm((f) => {
      const set = new Set(f.pages);
      for (const p of paths) {
        if (checked) set.add(p);
        else set.delete(p);
      }
      return { ...f, pages: [...set] };
    });
  };

  const handleSave = () => {
    setError("");
    startTransition(async () => {
      try {
        if (editing) {
          await updateRole(editing.id, form);
        } else {
          await createRole(form);
        }
        setDialogOpen(false);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const handleToggleActive = (role: RoleRow) => {
    setError("");
    startTransition(async () => {
      try {
        await setRoleActive(role.id, !role.is_active);
        router.refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion des Rôles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Créez des rôles, activez ou désactivez-les, et définissez les pages
          accessibles pour chacun.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <Shield className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{initialRoles.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-green-500/10 text-green-600">
            <ToggleRight className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Actifs</p>
            <p className="text-lg font-bold">{activeCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <ShieldOff className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inactifs</p>
            <p className="text-lg font-bold">
              {initialRoles.length - activeCount}
            </p>
          </div>
        </div>
      </div>

      {error && !dialogOpen && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Rôles</CardTitle>
            <CardDescription>
              {filtered.length} rôle(s) — les rôles inactifs ne sont plus
              proposés à l&apos;affectation utilisateurs
            </CardDescription>
          </div>
          <CardAction>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 size-4" />
              Nouveau rôle
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un rôle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as "all" | "active" | "inactive")
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Rôle</th>
                  <th className="px-3 py-2 text-left font-medium">Code</th>
                  <th className="px-3 py-2 text-left font-medium">Périmètre</th>
                  <th className="px-3 py-2 text-center font-medium">Pages</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Utilisateurs
                  </th>
                  <th className="px-3 py-2 text-center font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((role) => {
                  const scopeLabel =
                    CHANTIER_SCOPES.find((s) => s.value === role.chantier_scope)
                      ?.label ?? role.chantier_scope;
                  return (
                    <tr
                      key={role.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: role.color }}
                          />
                          <div>
                            <div className="font-medium">{role.label}</div>
                            {role.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {role.description}
                              </div>
                            )}
                          </div>
                          {role.is_system && (
                            <Badge variant="outline" className="text-[10px]">
                              Système
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {role.code}
                      </td>
                      <td className="px-3 py-2 text-xs">{scopeLabel}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="secondary" className="text-[10px]">
                          {role.pages.length}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-3" />
                          {role.userCount}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {role.is_active ? (
                          <Badge className="bg-green-600 text-[10px]">
                            Actif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactif
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            title="Modifier"
                            onClick={() => openEdit(role)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            title={
                              role.is_active ? "Désactiver" : "Réactiver"
                            }
                            disabled={role.code === "Admin"}
                            onClick={() => handleToggleActive(role)}
                          >
                            {role.is_active ? (
                              <ToggleRight className="size-3.5 text-green-600" />
                            ) : (
                              <ToggleLeft className="size-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      Aucun rôle trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Modifier — ${editing.label}` : "Nouveau rôle"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Libellé</label>
              <Input
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="ex: Contrôleur qualité"
              />
            </div>

            {editing && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Code</label>
                <p className="font-mono text-xs text-muted-foreground">
                  {editing.code}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optionnel"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`size-7 rounded-full border-2 transition-transform ${
                      form.color === c
                        ? "scale-110 border-foreground"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Périmètre données chantiers
              </label>
              <Select
                value={form.chantier_scope}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, chantier_scope: v }))
                }
                disabled={editing?.code === "Admin"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANTIER_SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {
                  CHANTIER_SCOPES.find((s) => s.value === form.chantier_scope)
                    ?.description
                }
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Pages autorisées ({form.pages.length})
                </label>
                {editing?.code === "Admin" && (
                  <span className="text-[11px] text-muted-foreground">
                    L&apos;administrateur conserve toutes les pages
                  </span>
                )}
              </div>

              {sections.map(([section, pages]) => {
                const paths = pages.map((p) => p.path);
                const allChecked = paths.every((p) => form.pages.includes(p));
                const someChecked =
                  !allChecked && paths.some((p) => form.pages.includes(p));
                return (
                  <div
                    key={section}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked;
                        }}
                        disabled={editing?.code === "Admin"}
                        onChange={(e) =>
                          toggleSection(paths, e.target.checked)
                        }
                      />
                      {section}
                    </label>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {pages.map((page) => (
                        <label
                          key={page.path}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/50"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 rounded border"
                            checked={form.pages.includes(page.path)}
                            disabled={editing?.code === "Admin"}
                            onChange={() => togglePage(page.path)}
                          />
                          <span>{page.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={isPending || !form.label.trim()}
            >
              {isPending
                ? "Enregistrement..."
                : editing
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
