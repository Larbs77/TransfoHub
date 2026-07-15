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
  Settings2,
  LayoutGrid,
  KeyRound,
  Info,
  GitBranch,
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
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppPage } from "@/lib/app-pages";
import { CHANTIER_SCOPES, RAID_CREATE_SCOPES } from "@/lib/app-pages";
import { WORKFLOW_MODE_OPTIONS } from "@/lib/workflow-shared";
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
  raid_create_scope: string;
  jalon_create_mode: string;
  jalon_update_mode: string;
  jalon_delete_mode: string;
  workflow_can_approve: boolean;
  workflow_can_reject: boolean;
  workflow_can_view_requests: boolean;
  workflow_can_view_history: boolean;
  workflow_can_view_kpi: boolean;
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
  /** Default: Non autorisé */
  raid_create_scope: "none",
  jalon_create_mode: "DIRECT",
  jalon_update_mode: "DIRECT",
  jalon_delete_mode: "DIRECT",
  workflow_can_approve: false,
  workflow_can_reject: false,
  workflow_can_view_requests: false,
  workflow_can_view_history: false,
  workflow_can_view_kpi: false,
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
  const [dialogTab, setDialogTab] = useState("general");
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const isAdminRole = editing?.code === "Admin";

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
    setDialogTab("general");
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
      raid_create_scope:
        role.code === "Admin" ? "programme" : role.raid_create_scope || "none",
      jalon_create_mode:
        role.code === "Admin" ? "DIRECT" : role.jalon_create_mode || "DIRECT",
      jalon_update_mode:
        role.code === "Admin" ? "DIRECT" : role.jalon_update_mode || "DIRECT",
      jalon_delete_mode:
        role.code === "Admin" ? "DIRECT" : role.jalon_delete_mode || "DIRECT",
      workflow_can_approve:
        role.code === "Admin" ? true : !!role.workflow_can_approve,
      workflow_can_reject:
        role.code === "Admin" ? true : !!role.workflow_can_reject,
      workflow_can_view_requests:
        role.code === "Admin" ? true : !!role.workflow_can_view_requests,
      workflow_can_view_history:
        role.code === "Admin" ? true : !!role.workflow_can_view_history,
      workflow_can_view_kpi:
        role.code === "Admin" ? true : !!role.workflow_can_view_kpi,
      pages: [...role.pages],
    });
    setDialogTab("general");
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
                  <th className="px-3 py-2 text-left font-medium">
                    Création RAID
                  </th>
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
                  const raidScope =
                    role.code === "Admin"
                      ? "programme"
                      : role.raid_create_scope || "none";
                  const raidScopeLabel =
                    RAID_CREATE_SCOPES.find((s) => s.value === raidScope)
                      ?.label ?? raidScope;
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
                      <td className="px-3 py-2 text-xs">{raidScopeLabel}</td>
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
                      colSpan={8}
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
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(100vw-1.5rem,52rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          {/* Header */}
          <div className="border-b bg-gradient-to-br from-[#0A3C74]/10 via-background to-background px-6 pb-4 pt-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
              <span
                className="size-3 shrink-0 rounded-full ring-2 ring-background shadow"
                style={{ backgroundColor: form.color }}
              />
              {editing?.is_system && (
                <Badge variant="outline" className="text-[10px]">
                  Système
                </Badge>
              )}
              {isAdminRole && (
                <Badge className="bg-[#0A3C74] text-[10px]">Admin</Badge>
              )}
              <Badge variant="secondary" className="text-[10px] tabular-nums">
                {form.pages.length} page
                {form.pages.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                <Shield className="size-5 shrink-0 text-primary" />
                {editing ? `Modifier — ${editing.label}` : "Nouveau rôle"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Configurez l&apos;identité, les vues accessibles et les
                autorisations métier de ce rôle.
              </DialogDescription>
            </DialogHeader>
          </div>

          <Tabs
            value={dialogTab}
            onValueChange={setDialogTab}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="border-b bg-muted/20 px-6 py-2">
              <TabsList className="grid h-10 w-full grid-cols-3 bg-muted/80">
                <TabsTrigger value="general" className="gap-1.5 text-xs sm:text-sm">
                  <Settings2 className="size-3.5 shrink-0" />
                  <span className="truncate">Général</span>
                </TabsTrigger>
                <TabsTrigger value="views" className="gap-1.5 text-xs sm:text-sm">
                  <LayoutGrid className="size-3.5 shrink-0" />
                  <span className="truncate">Accès vues</span>
                </TabsTrigger>
                <TabsTrigger
                  value="authz"
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <KeyRound className="size-3.5 shrink-0" />
                  <span className="truncate">Autorisations</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {/* ── Général ── */}
              <TabsContent value="general" className="mt-0 space-y-5">
                <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold tracking-tight">
                    Identité
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Libellé <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={form.label}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, label: e.target.value }))
                        }
                        placeholder="ex: Contrôleur qualité"
                      />
                    </div>
                    {editing && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Code
                        </label>
                        <p className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                          {editing.code}
                        </p>
                      </div>
                    )}
                    <div className={`space-y-1.5 ${editing ? "" : "sm:col-span-2"}`}>
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Description
                      </label>
                      <Input
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Rôle métier, optionnel"
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Couleur d&apos;affichage
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({ ...f, color: c }))
                          }
                          className={`size-8 rounded-full border-2 transition-transform ${
                            form.color === c
                              ? "scale-110 border-foreground shadow-md"
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold tracking-tight">
                    Périmètres données
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Données chantiers
                      </label>
                      <Select
                        value={form.chantier_scope}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, chantier_scope: v }))
                        }
                        disabled={isAdminRole}
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
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {
                          CHANTIER_SCOPES.find(
                            (s) => s.value === form.chantier_scope
                          )?.description
                        }
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Création RAID
                      </label>
                      <Select
                        value={form.raid_create_scope}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, raid_create_scope: v }))
                        }
                        disabled={isAdminRole}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RAID_CREATE_SCOPES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        {
                          RAID_CREATE_SCOPES.find(
                            (s) => s.value === form.raid_create_scope
                          )?.description
                        }
                      </p>
                    </div>
                  </div>
                  {isAdminRole && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2 text-xs text-sky-950 dark:text-sky-100">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      L&apos;administrateur conserve toujours le périmètre
                      complet et la création RAID au niveau programme.
                    </div>
                  )}
                </section>
              </TabsContent>

              {/* ── Accès vues ── */}
              <TabsContent value="views" className="mt-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight">
                      Pages autorisées
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Cochez les écrans visibles dans le menu pour ce rôle.
                    </p>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">
                    {form.pages.length} / {appPages.length}
                  </Badge>
                </div>

                {isAdminRole && (
                  <div className="flex gap-2 rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2 text-xs">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
                    L&apos;administrateur conserve automatiquement toutes les
                    pages.
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {sections.map(([section, pages]) => {
                    const paths = pages.map((p) => p.path);
                    const allChecked = paths.every((p) =>
                      form.pages.includes(p)
                    );
                    const someChecked =
                      !allChecked &&
                      paths.some((p) => form.pages.includes(p));
                    const checkedCount = paths.filter((p) =>
                      form.pages.includes(p)
                    ).length;
                    return (
                      <div
                        key={section}
                        className="rounded-xl border bg-card/60 p-3 shadow-sm"
                      >
                        <label className="mb-2 flex cursor-pointer items-center justify-between gap-2 border-b border-border/50 pb-2">
                          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                            <input
                              type="checkbox"
                              className="size-3.5 rounded border"
                              checked={allChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = someChecked;
                              }}
                              disabled={isAdminRole}
                              onChange={(e) =>
                                toggleSection(paths, e.target.checked)
                              }
                            />
                            {section}
                          </span>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {checkedCount}/{paths.length}
                          </span>
                        </label>
                        <div className="space-y-0.5">
                          {pages.map((page) => (
                            <label
                              key={page.path}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent/50"
                            >
                              <input
                                type="checkbox"
                                className="size-3.5 shrink-0 rounded border"
                                checked={form.pages.includes(page.path)}
                                disabled={isAdminRole}
                                onChange={() => togglePage(page.path)}
                              />
                              <span className="min-w-0 leading-snug">
                                {page.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              {/* ── Autorisations ── */}
              <TabsContent value="authz" className="mt-0 space-y-5">
                <section className="rounded-xl border border-violet-500/20 bg-card/60 p-4 shadow-sm">
                  <div className="mb-4 flex items-start gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                      <GitBranch className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight">
                        Workflow Jalons
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Mode par opération — indépendant du nom du rôle
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["jalon_create_mode", "Création"],
                        ["jalon_update_mode", "Modification"],
                        ["jalon_delete_mode", "Suppression"],
                      ] as const
                    ).map(([key, label]) => (
                      <div
                        key={key}
                        className="space-y-1.5 rounded-lg border bg-muted/20 p-3"
                      >
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </label>
                        <Select
                          value={form[key]}
                          onValueChange={(v) =>
                            setForm((f) => ({ ...f, [key]: v }))
                          }
                          disabled={isAdminRole}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WORKFLOW_MODE_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] leading-snug text-muted-foreground">
                          {
                            WORKFLOW_MODE_OPTIONS.find(
                              (m) => m.value === form[key]
                            )?.description
                          }
                        </p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Capacités de validation
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {(
                        [
                          ["workflow_can_approve", "Approuver une demande"],
                          ["workflow_can_reject", "Rejeter une demande"],
                          [
                            "workflow_can_view_requests",
                            "Consulter les demandes",
                          ],
                          [
                            "workflow_can_view_history",
                            "Consulter l'historique",
                          ],
                          [
                            "workflow_can_view_kpi",
                            "Consulter les KPI workflow",
                          ],
                        ] as const
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background/80 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
                        >
                          <input
                            type="checkbox"
                            className="size-4 rounded border"
                            checked={form[key]}
                            disabled={isAdminRole}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {isAdminRole && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2 text-xs">
                      <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
                      L&apos;administrateur a toujours le mode Direct et toutes
                      les capacités workflow.
                    </div>
                  )}
                </section>

                <div className="flex gap-2 rounded-xl border bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <p>
                    <strong className="text-foreground">Direct</strong> =
                    exécution immédiate ·{" "}
                    <strong className="text-foreground">Validation</strong> =
                    demande à approuver ·{" "}
                    <strong className="text-foreground">Interdit</strong> =
                    action masquée. Pour la modification de jalon, seule la{" "}
                    <em>date cible</em> passe en validation si le mode est
                    Validation.
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {error && (
            <div className="mx-6 mb-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-between">
            <p className="hidden text-xs text-muted-foreground sm:block">
              {dialogTab === "general" && "Identité et périmètres données"}
              {dialogTab === "views" &&
                `${form.pages.length} page(s) sélectionnée(s)`}
              {dialogTab === "authz" && "Modes jalons et droits de validation"}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <DialogClose asChild>
                <Button variant="outline">Annuler</Button>
              </DialogClose>
              <Button
                onClick={handleSave}
                disabled={isPending || !form.label.trim()}
                className="bg-[#0A3C74] hover:bg-[#0A3C74]/90"
              >
                {isPending
                  ? "Enregistrement..."
                  : editing
                    ? "Enregistrer"
                    : "Créer le rôle"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
