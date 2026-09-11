"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  Search,
  ArrowUpDown,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordRulesHint } from "@/components/password-rules-hint";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { UserAvatar } from "@/components/user-avatar";
import {
  createUser,
  updateUserProfile,
  updateUserRole,
  updateDashboardType,
  toggleUserActive,
  resetUserPassword,
  unlockUser,
  deleteUser,
} from "./actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RESSOURCE_TYPE_LABELS } from "@/lib/ressource-labels";

type UserRow = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  avatar_url: string;
  role: string;
  dashboard_type: string;
  is_active: boolean;
  must_change_pwd: boolean;
  failed_attempts: number;
  locked_until: Date | null;
  last_login: Date | null;
  ressourceId: string | null;
  ressource: {
    id: string;
    nom_complet: string;
    email?: string;
    telephone?: string;
    equipeHierarchie?: { id: string; name: string } | null;
    equipesFonctionnelles?: { equipe: { id: string; name: string } }[];
    membres?: { chantierId: string }[];
  } | null;
  consultationChantiers?: {
    chantierId: string;
    chantier: { id: string; code: string; nom: string };
  }[];
  createdAt: Date;
  updatedAt: Date;
};

type ActiveRole = {
  code: string;
  label: string;
  color: string;
  chantier_scope: string;
};

type RessourceOption = {
  id: string;
  nom_complet: string;
  email: string;
  telephone: string;
  type: string;
  equipeHierarchieId: string | null;
};

type EquipeOption = {
  id: string;
  name: string;
  is_active: boolean;
};

type ChantierOption = {
  id: string;
  code: string;
  nom: string;
};

type ProfileForm = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  role: string;
  dashboard_type: "complete" | "limited";
};

function displayName(u: Pick<UserRow, "first_name" | "last_name" | "username">) {
  const full = `${u.first_name} ${u.last_name}`.trim();
  return full || u.username;
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}) {
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-muted-foreground">
        {from}–{to} sur {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {(() => {
          const pages: (number | "...")[] = [];
          if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
          } else {
            pages.push(1);
            if (currentPage > 3) pages.push("...");
            for (
              let i = Math.max(2, currentPage - 1);
              i <= Math.min(totalPages - 1, currentPage + 1);
              i++
            )
              pages.push(i);
            if (currentPage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
          }
          return pages.map((page, idx) =>
            page === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-xs text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                className="h-7 w-7 p-0 text-xs"
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            )
          );
        })()}
        <Button
          variant="outline"
          size="icon-xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function UserManagement({
  initialUsers,
  ressourcesDisponibles,
  equipes,
  activeRoles,
  chantiers = [],
}: {
  initialUsers: UserRow[];
  ressourcesDisponibles: RessourceOption[];
  equipes: EquipeOption[];
  activeRoles: ActiveRole[];
  chantiers?: ChantierOption[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<
    "username" | "role" | "last_login" | "createdAt" | "name"
  >("username");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<UserRow | null>(null);
  const [showResetPwd, setShowResetPwd] = useState<UserRow | null>(null);
  const [showDelete, setShowDelete] = useState<UserRow | null>(null);

  const defaultRoleCode =
    activeRoles.find((r) => r.code === "PMO_Chantier")?.code ??
    activeRoles[0]?.code ??
    "";

  const activeEquipes = useMemo(
    () => equipes.filter((e) => e.is_active),
    [equipes]
  );

  // Add form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>(defaultRoleCode);
  const [ressourceMode, setRessourceMode] = useState<"existing" | "new">(
    "existing"
  );
  const [newRessourceId, setNewRessourceId] = useState<string>("");
  const [newResNom, setNewResNom] = useState("");
  const [newResEmail, setNewResEmail] = useState("");
  const [newResPhone, setNewResPhone] = useState("");
  const [newResType, setNewResType] = useState("Interne");
  const [newResEquipeHier, setNewResEquipeHier] = useState(
    activeEquipes[0]?.id ?? ""
  );
  const [newResEquipeFn, setNewResEquipeFn] = useState<string[]>([]);
  const [newConsultationIds, setNewConsultationIds] = useState<string[]>([]);
  const [editConsultationIds, setEditConsultationIds] = useState<string[]>([]);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [error, setError] = useState("");

  const [editForm, setEditForm] = useState<ProfileForm>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    role: "",
    dashboard_type: "complete",
  });

  const roleMeta = (code: string) =>
    activeRoles.find((r) => r.code === code) ?? {
      code,
      label: code,
      color: "#6b7280",
    };

  const rolesForUser = (currentCode: string) => {
    const list = [...activeRoles];
    if (currentCode && !list.some((r) => r.code === currentCode)) {
      list.push({
        code: currentCode,
        label: `${currentCode} (inactif)`,
        color: "#6b7280",
        chantier_scope: "none",
      });
    }
    return list;
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = [...initialUsers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.ressource?.nom_complet.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "username") cmp = a.username.localeCompare(b.username);
      else if (sortKey === "name")
        cmp = displayName(a).localeCompare(displayName(b));
      else if (sortKey === "role") cmp = a.role.localeCompare(b.role);
      else if (sortKey === "last_login")
        cmp = (a.last_login?.getTime() ?? 0) - (b.last_login?.getTime() ?? 0);
      else if (sortKey === "createdAt")
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [initialUsers, search, roleFilter, sortKey, sortDir]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated =
    pageSize === 0
      ? filtered
      : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  const total = initialUsers.length;
  const active = initialUsers.filter((u) => u.is_active).length;
  const locked = initialUsers.filter(
    (u) => u.locked_until && u.locked_until > new Date()
  ).length;

  const resetAddForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewRole(defaultRoleCode);
    setRessourceMode(
      ressourcesDisponibles.length > 0 ? "existing" : "new"
    );
    setNewRessourceId("");
    setNewResNom("");
    setNewResEmail("");
    setNewResPhone("");
    setNewResType("Interne");
    setNewResEquipeHier(activeEquipes[0]?.id ?? "");
    setNewResEquipeFn([]);
    setNewConsultationIds([]);
  };

  const openEdit = (user: UserRow) => {
    setShowEdit(user);
    setEditForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      role: user.role,
      dashboard_type: (user.dashboard_type as "complete" | "limited") || "complete",
    });
    setEditConsultationIds(
      (user.consultationChantiers ?? []).map((c) => c.chantierId)
    );
    setError("");
  };

  const handleCreate = () => {
    setError("");
    startTransition(async () => {
      try {
        await createUser({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          ressourceId:
            ressourceMode === "existing" ? newRessourceId || null : null,
          newRessource:
            ressourceMode === "new"
              ? {
                  nom_complet: newResNom,
                  email: newResEmail,
                  telephone: newResPhone,
                  type: newResType,
                  equipeHierarchieId: newResEquipeHier,
                  equipeFonctionnelleIds: newResEquipeFn,
                }
              : null,
          consultationChantierIds: newConsultationIds,
        });
        setShowAdd(false);
        resetAddForm();
        window.location.reload();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const handleSaveEdit = () => {
    if (!showEdit) return;
    setError("");
    startTransition(async () => {
      try {
        await updateUserProfile(showEdit.id, {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          phone: editForm.phone,
          email: editForm.email,
          role: editForm.role,
          dashboard_type: editForm.dashboard_type,
          consultationChantierIds: editConsultationIds,
        });
        setShowEdit(null);
        window.location.reload();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const handleResetPassword = () => {
    if (!showResetPwd) return;
    setError("");
    startTransition(async () => {
      try {
        await resetUserPassword(showResetPwd.id, resetPwdValue);
        setShowResetPwd(null);
        setResetPwdValue("");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const handleDelete = () => {
    if (!showDelete) return;
    startTransition(async () => {
      await deleteUser(showDelete.id);
      setShowDelete(null);
    });
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Gestion des Utilisateurs
      </h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-green-500/10 text-green-600">
            <Shield className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Actifs</p>
            <p className="text-lg font-bold">{active}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-red-500/10 text-red-600">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Verrouillés</p>
            <p className="text-lg font-bold">{locked}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Utilisateurs</CardTitle>
            <CardDescription>
              {filtered.length} utilisateur(s) sur {total}
            </CardDescription>
          </div>
          <CardAction>
            <Button
              size="sm"
              onClick={() => {
                resetAddForm();
                setError("");
                setShowAdd(true);
              }}
            >
              <UserPlus className="mr-1.5 size-4" />
              Ajouter
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, login, e-mail, téléphone)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {activeRoles.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-muted-foreground whitespace-nowrap">
                Afficher
              </label>
              <Select
                value={pageSize === 0 ? "all" : String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(v === "all" ? 0 : Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20 h-8" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                  <SelectItem value="all">Tout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">
                    <button
                      onClick={() => toggleSort("username")}
                      className="inline-flex items-center gap-1"
                    >
                      Utilisateur <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    <button
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-1"
                    >
                      Nom <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Contact</th>
                  <th className="px-3 py-2 text-left font-medium">
                    <button
                      onClick={() => toggleSort("role")}
                      className="inline-flex items-center gap-1"
                    >
                      Rôle <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Dashboard</th>
                  <th className="px-3 py-2 text-center font-medium">Statut</th>
                  <th className="px-3 py-2 text-left font-medium">
                    <button
                      onClick={() => toggleSort("last_login")}
                      className="inline-flex items-center gap-1"
                    >
                      Dernière connexion <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((user) => {
                  const isLocked =
                    user.locked_until && user.locked_until > new Date();
                  return (
                    <tr
                      key={user.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={displayName(user)}
                            color={roleMeta(user.role).color}
                            src={user.avatar_url}
                            version={
                              user.updatedAt
                                ? new Date(user.updatedAt).getTime()
                                : undefined
                            }
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="font-medium">
                              {user.username}
                              {user.must_change_pwd && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px]"
                                >
                                  Temp
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{displayName(user)}</div>
                        {(user.first_name || user.last_name) && (
                          <div className="text-[11px] text-muted-foreground">
                            {user.first_name} {user.last_name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <div className="space-y-0.5">
                          {user.email ? (
                            <div className="flex items-center gap-1">
                              <Mail className="size-3 shrink-0" />
                              <span className="truncate max-w-[160px]">
                                {user.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                          {user.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="size-3 shrink-0" />
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={user.role}
                          onValueChange={(val) =>
                            startTransition(() =>
                              updateUserRole(user.id, val)
                            )
                          }
                        >
                          <SelectTrigger className="h-7 w-[180px] text-xs">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-block size-2 rounded-full"
                                style={{
                                  backgroundColor: roleMeta(user.role).color,
                                }}
                              />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {rolesForUser(user.role).map((r) => (
                              <SelectItem key={r.code} value={r.code}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={user.dashboard_type}
                          onValueChange={(val) =>
                            startTransition(() =>
                              updateDashboardType(
                                user.id,
                                val as "complete" | "limited"
                              )
                            )
                          }
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="complete">Complet</SelectItem>
                            <SelectItem value="limited">Limité</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isLocked ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px]"
                          >
                            <Lock className="mr-1 size-3" /> Verrouillé
                          </Badge>
                        ) : user.is_active ? (
                          <Badge className="bg-green-600 text-[10px]">
                            Actif
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                          >
                            Inactif
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {user.last_login
                          ? format(
                              new Date(user.last_login),
                              "dd MMM yyyy HH:mm",
                              { locale: fr }
                            )
                          : "Jamais"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            title="Modifier le profil"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {isLocked && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title="Déverrouiller"
                              onClick={() =>
                                startTransition(() => unlockUser(user.id))
                              }
                            >
                              <Unlock className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            title={
                              user.is_active ? "Désactiver" : "Activer"
                            }
                            onClick={() =>
                              startTransition(() =>
                                toggleUserActive(user.id)
                              )
                            }
                          >
                            {user.is_active ? (
                              <ToggleRight className="size-3.5 text-green-600" />
                            ) : (
                              <ToggleLeft className="size-3.5 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            title="Réinitialiser le mot de passe"
                            onClick={() => {
                              setShowResetPwd(user);
                              setResetPwdValue("");
                              setError("");
                            }}
                          >
                            <KeyRound className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-destructive"
                            title="Supprimer"
                            onClick={() => setShowDelete(user)}
                          >
                            <Trash2 className="size-3.5" />
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
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pageSize > 0 && totalPages > 1 && (
            <PaginationControls
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Un compte applicatif est toujours lié à une{" "}
              <span className="font-medium text-foreground">ressource</span>{" "}
              (personne du programme). Identité (nom, contact) = données de la
              ressource.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nom d&apos;utilisateur
              </label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="ex: j.dupont"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Mot de passe temporaire
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 car., maj., min., chiffre, spécial"
              />
              <PasswordRulesHint password={newPassword} />
              <p className="text-[10px] text-muted-foreground">
                L&apos;utilisateur devra le changer à la première connexion.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rôle</label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v)}
                disabled={activeRoles.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {activeRoles.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <label className="text-sm font-medium">
                Ressource <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ressourceMode"
                    checked={ressourceMode === "existing"}
                    onChange={() => setRessourceMode("existing")}
                    disabled={ressourcesDisponibles.length === 0}
                  />
                  Ressource existante
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ressourceMode"
                    checked={ressourceMode === "new"}
                    onChange={() => setRessourceMode("new")}
                  />
                  Créer une ressource
                </label>
              </div>

              {ressourceMode === "existing" ? (
                <Select
                  value={newRessourceId || undefined}
                  onValueChange={setNewRessourceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une ressource sans compte" />
                  </SelectTrigger>
                  <SelectContent>
                    {ressourcesDisponibles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nom_complet}
                        {r.email ? ` — ${r.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Nom complet *</label>
                    <Input
                      value={newResNom}
                      onChange={(e) => setNewResNom(e.target.value)}
                      placeholder="Prénom Nom"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">E-mail</label>
                      <Input
                        type="email"
                        value={newResEmail}
                        onChange={(e) => setNewResEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Téléphone</label>
                      <Input
                        value={newResPhone}
                        onChange={(e) => setNewResPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Type</label>
                      <Select
                        value={newResType}
                        onValueChange={setNewResType}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RESSOURCE_TYPE_LABELS).map(
                            ([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">
                        Équipe hiérarchique *
                      </label>
                      <Select
                        value={newResEquipeHier || undefined}
                        onValueChange={setNewResEquipeHier}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Équipe" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeEquipes.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">
                      Équipes fonctionnelles
                    </label>
                    <MultiSelect
                      options={activeEquipes.map((e) => ({
                        value: e.id,
                        label: e.name,
                      }))}
                      selected={newResEquipeFn}
                      onChange={setNewResEquipeFn}
                      placeholder="Optionnel"
                    />
                  </div>
                </div>
              )}
            </div>

            {activeRoles.find((r) => r.code === newRole)?.chantier_scope !==
              "all" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Chantiers en consultation
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Lecture seule, hors chantiers déjà membres. Un RAID affecté
                  reste actionnable.
                </p>
                <MultiSelect
                  options={chantiers.map((c) => ({
                    value: c.id,
                    label: `${c.code} — ${c.nom}`,
                  }))}
                  selected={newConsultationIds}
                  onChange={setNewConsultationIds}
                  placeholder="Aucun chantier extra"
                />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={
                isPending ||
                !newUsername.trim() ||
                !newPassword ||
                !newRole ||
                (ressourceMode === "existing" && !newRessourceId) ||
                (ressourceMode === "new" &&
                  (!newResNom.trim() || !newResEquipeHier))
              }
            >
              {isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit profile Dialog */}
      <Dialog
        open={!!showEdit}
        onOpenChange={(open) => {
          if (!open) setShowEdit(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Modifier — {showEdit?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {showEdit && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <UserAvatar
                  name={displayName(showEdit)}
                  color={roleMeta(showEdit.role).color}
                  src={showEdit.avatar_url}
                  version={
                    showEdit.updatedAt
                      ? new Date(showEdit.updatedAt).getTime()
                      : undefined
                  }
                  size="xl"
                  className="ring-2 ring-border"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {displayName(showEdit)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    @{showEdit.username}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    La photo est gérée par l&apos;utilisateur depuis son profil.
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prénom</label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      first_name: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom</label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      last_name: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Téléphone</label>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rôle</label>
              <Select
                value={editForm.role}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, role: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolesForUser(editForm.role).map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dashboard</label>
              <Select
                value={editForm.dashboard_type}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    dashboard_type: v as "complete" | "limited",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complet</SelectItem>
                  <SelectItem value="limited">Limité</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showEdit?.ressource && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs font-medium text-muted-foreground">
                  Ressource liée (identité)
                </p>
                <p className="font-medium">{showEdit.ressource.nom_complet}</p>
                {showEdit.ressource.equipeHierarchie && (
                  <p className="text-xs text-muted-foreground">
                    Équipe : {showEdit.ressource.equipeHierarchie.name}
                    {(showEdit.ressource.equipesFonctionnelles?.length ?? 0) >
                      0 &&
                      ` · +${showEdit.ressource.equipesFonctionnelles!.length} fonct.`}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Modifier le nom / contact met aussi à jour la fiche ressource.
                </p>
              </div>
            )}
            {showEdit &&
              activeRoles.find((r) => r.code === editForm.role)
                ?.chantier_scope !== "all" &&
              showEdit.role !== "Admin" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Chantiers en consultation
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Lecture seule. Les chantiers où la ressource est membre
                    gardent les droits du rôle. Un RAID affecté reste
                    actionnable.
                  </p>
                  <MultiSelect
                    options={chantiers
                      .filter((c) => {
                        const memberIds = new Set(
                          (showEdit.ressource?.membres ?? []).map(
                            (m) => m.chantierId
                          )
                        );
                        return !memberIds.has(c.id);
                      })
                      .map((c) => ({
                        value: c.id,
                        label: `${c.code} — ${c.nom}`,
                      }))}
                    selected={editConsultationIds}
                    onChange={setEditConsultationIds}
                    placeholder="Aucun chantier extra"
                  />
                </div>
              )}
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={!!showResetPwd}
        onOpenChange={() => setShowResetPwd(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Réinitialiser le mot de passe de{" "}
              {showResetPwd ? displayName(showResetPwd) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nouveau mot de passe temporaire
              </label>
              <Input
                type="password"
                value={resetPwdValue}
                onChange={(e) => setResetPwdValue(e.target.value)}
                placeholder="Min. 8 car., maj., min., chiffre, spécial"
              />
              <PasswordRulesHint password={resetPwdValue} />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              onClick={handleResetPassword}
              disabled={isPending || !resetPwdValue}
            >
              {isPending ? "Réinitialisation..." : "Réinitialiser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;utilisateur</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Voulez-vous vraiment supprimer l&apos;utilisateur{" "}
            <strong>
              {showDelete ? displayName(showDelete) : ""}
            </strong>{" "}
            ({showDelete?.username}) ? Cette action est irréversible.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
