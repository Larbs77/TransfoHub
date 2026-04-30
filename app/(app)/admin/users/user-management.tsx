"use client";

import { useState, useMemo, useTransition } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
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
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import {
  createUser,
  updateUserRole,
  updateDashboardType,
  toggleUserActive,
  resetUserPassword,
  unlockUser,
  deleteUser,
} from "./actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type UserRow = {
  id: string;
  username: string;
  role: string;
  dashboard_type: string;
  is_active: boolean;
  must_change_pwd: boolean;
  failed_attempts: number;
  locked_until: Date | null;
  last_login: Date | null;
  ressourceId: string | null;
  ressource: { id: string; nom_complet: string } | null;
  createdAt: Date;
};

const ROLES: Role[] = ["Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager"];

export function UserManagement({
  initialUsers,
  ressources,
}: {
  initialUsers: UserRow[];
  ressources: { id: string; nom_complet: string }[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"username" | "role" | "last_login" | "createdAt">("username");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isPending, startTransition] = useTransition();

  // Dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState<UserRow | null>(null);
  const [showDelete, setShowDelete] = useState<UserRow | null>(null);

  // Add form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("PMO_Chantier");
  const [newRessourceId, setNewRessourceId] = useState<string>("");
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [error, setError] = useState("");

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let list = [...initialUsers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.ressource?.nom_complet.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "username") cmp = a.username.localeCompare(b.username);
      else if (sortKey === "role") cmp = a.role.localeCompare(b.role);
      else if (sortKey === "last_login") cmp = (a.last_login?.getTime() ?? 0) - (b.last_login?.getTime() ?? 0);
      else if (sortKey === "createdAt") cmp = a.createdAt.getTime() - b.createdAt.getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [initialUsers, search, roleFilter, sortKey, sortDir]);

  // KPIs
  const total = initialUsers.length;
  const active = initialUsers.filter((u) => u.is_active).length;
  const locked = initialUsers.filter((u) => u.locked_until && u.locked_until > new Date()).length;

  const handleCreate = () => {
    setError("");
    startTransition(async () => {
      try {
        await createUser({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          ressourceId: newRessourceId || null,
        });
        setShowAdd(false);
        setNewUsername("");
        setNewPassword("");
        setNewRole("PMO_Chantier");
        setNewRessourceId("");
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
      <h1 className="text-2xl font-bold tracking-tight">Gestion des Utilisateurs</h1>

      {/* KPI cards */}
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

      {/* Table card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Utilisateurs</CardTitle>
            <CardDescription>
              {filtered.length} utilisateur(s) sur {total}
            </CardDescription>
          </div>
          <CardAction>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <UserPlus className="mr-1.5 size-4" />
              Ajouter
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
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
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">
                    <button onClick={() => toggleSort("username")} className="inline-flex items-center gap-1">
                      Utilisateur <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    <button onClick={() => toggleSort("role")} className="inline-flex items-center gap-1">
                      Rôle <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Dashboard</th>
                  <th className="px-3 py-2 text-left font-medium">Ressource liée</th>
                  <th className="px-3 py-2 text-center font-medium">Statut</th>
                  <th className="px-3 py-2 text-left font-medium">
                    <button onClick={() => toggleSort("last_login")} className="inline-flex items-center gap-1">
                      Dernière connexion <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const isLocked = user.locked_until && user.locked_until > new Date();
                  return (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {user.username}
                        {user.must_change_pwd && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Temp
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={user.role}
                          onValueChange={(val) =>
                            startTransition(() => updateUserRole(user.id, val as Role))
                          }
                        >
                          <SelectTrigger className="h-7 w-[180px] text-xs">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-block size-2 rounded-full"
                                style={{ backgroundColor: ROLE_COLORS[user.role as Role] }}
                              />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={user.dashboard_type}
                          onValueChange={(val) =>
                            startTransition(() => updateDashboardType(user.id, val as "complete" | "limited"))
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
                      <td className="px-3 py-2 text-muted-foreground">
                        {user.ressource?.nom_complet ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isLocked ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <Lock className="mr-1 size-3" /> Verrouillé
                          </Badge>
                        ) : user.is_active ? (
                          <Badge className="bg-green-600 text-[10px]">Actif</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {user.last_login
                          ? format(new Date(user.last_login), "dd MMM yyyy HH:mm", { locale: fr })
                          : "Jamais"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {isLocked && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              title="Déverrouiller"
                              onClick={() => startTransition(() => unlockUser(user.id))}
                            >
                              <Unlock className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            title={user.is_active ? "Désactiver" : "Activer"}
                            onClick={() => startTransition(() => toggleUserActive(user.id))}
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
                            onClick={() => { setShowResetPwd(user); setResetPwdValue(""); setError(""); }}
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
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom d&apos;utilisateur</label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="ex: j.dupont"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mot de passe temporaire</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 car., maj., min., chiffre, spécial"
              />
              <p className="text-[10px] text-muted-foreground">
                L&apos;utilisateur devra le changer à la première connexion.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rôle</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ressource liée (optionnel)</label>
              <Select value={newRessourceId || "none"} onValueChange={(v) => setNewRessourceId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {ressources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nom_complet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button onClick={handleCreate} disabled={isPending || !newUsername.trim() || !newPassword}>
              {isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showResetPwd} onOpenChange={() => setShowResetPwd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Réinitialiser le mot de passe de {showResetPwd?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nouveau mot de passe temporaire</label>
              <Input
                type="password"
                value={resetPwdValue}
                onChange={(e) => setResetPwdValue(e.target.value)}
                placeholder="Min. 8 car., maj., min., chiffre, spécial"
              />
              <p className="text-[10px] text-muted-foreground">
                L&apos;utilisateur devra le changer à la prochaine connexion.
              </p>
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
            <Button onClick={handleResetPassword} disabled={isPending || !resetPwdValue}>
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
            <strong>{showDelete?.username}</strong> ? Cette action est irréversible.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
