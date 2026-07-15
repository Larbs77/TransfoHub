"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  TableIcon,
  Pencil,
  Trash2,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Contact,
  UserCheck,
  UserX,
  KeyRound,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { RessourceCard } from "./ressource-card";
import { RessourceFormDialog } from "./ressource-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { deleteRessource } from "@/app/(app)/actions";
import {
  RESSOURCE_TYPE_LABELS,
  RESSOURCE_TYPE_COLORS,
} from "@/lib/ressource-labels";

interface RessourceWithStats {
  id: string;
  nom_complet: string;
  email: string;
  telephone: string;
  type: string;
  organisation: string;
  tarif_journalier: number;
  capacite_jours_mois: number;
  actif: boolean;
  profilId?: string | null;
  equipeHierarchieId?: string | null;
  profil?: {
    id: string;
    nom: string;
    type_ressource: string;
    tjm_defaut: number;
  } | null;
  equipeHierarchie?: { id: string; name: string; is_active: boolean } | null;
  equipesFonctionnelles?: {
    equipeId: string;
    equipe?: { id: string; name: string; is_active: boolean };
  }[];
  user?: {
    id: string;
    username: string;
    role: string;
    is_active: boolean;
    last_login?: Date | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { membres: number; raids: number };
}

interface Props {
  ressources: RessourceWithStats[];
  equipes?: { id: string; name: string; is_active: boolean; type?: string }[];
  activeRoles?: { code: string; label: string }[];
  canCreateAccount?: boolean;
}

function resolveEquipeHierarchieName(
  r: RessourceWithStats,
  equipes: { id: string; name: string }[]
): string {
  if (r.equipeHierarchie?.name?.trim()) return r.equipeHierarchie.name.trim();
  if (r.equipeHierarchieId) {
    const fromCatalog = equipes.find((e) => e.id === r.equipeHierarchieId);
    if (fromCatalog?.name?.trim()) return fromCatalog.name.trim();
  }
  return "—";
}

type ViewMode = "grid" | "table";
type SortField =
  | "nom_complet"
  | "type"
  | "organisation"
  | "membres"
  | "raids"
  | "tarif";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField | null;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      {label}
      {current === field ? (
        dir === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
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
    <div className="flex items-center justify-between gap-3 border-t px-1 pt-4">
      <span className="text-xs text-muted-foreground">
        {from}–{to} sur {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-7"
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
          size="icon"
          className="size-7"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

const TYPE_OPTIONS = Object.entries(RESSOURCE_TYPE_LABELS).map(([k, v]) => ({
  value: k,
  label: v,
}));

const ACTIF_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "true", label: "Actif" },
  { value: "false", label: "Inactif" },
];

export function RessourcesList({
  ressources,
  equipes = [],
  activeRoles = [],
  canCreateAccount = false,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterOrg, setFilterOrg] = useState<string[]>([]);
  const [filterActif, setFilterActif] = useState("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>("nom_complet");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [createOpen, setCreateOpen] = useState(false);
  const [editRessource, setEditRessource] = useState<RessourceWithStats | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const orgOptions = useMemo(() => {
    const orgs = new Set(ressources.map((r) => r.organisation).filter(Boolean));
    return Array.from(orgs)
      .sort()
      .map((o) => ({ value: o, label: o }));
  }, [ressources]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const hasActiveFilters =
    search ||
    filterType.length > 0 ||
    filterOrg.length > 0 ||
    filterActif !== "all";

  const filtered = useMemo(() => {
    let result = ressources;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.nom_complet.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.organisation.toLowerCase().includes(q) ||
          resolveEquipeHierarchieName(r, equipes).toLowerCase().includes(q) ||
          (r.user?.username ?? "").toLowerCase().includes(q)
      );
    }
    if (filterType.length > 0) {
      result = result.filter((r) => filterType.includes(r.type));
    }
    if (filterOrg.length > 0) {
      result = result.filter((r) => filterOrg.includes(r.organisation));
    }
    if (filterActif !== "all") {
      result = result.filter((r) => String(r.actif) === filterActif);
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "nom_complet":
            cmp = a.nom_complet.localeCompare(b.nom_complet);
            break;
          case "type":
            cmp = a.type.localeCompare(b.type);
            break;
          case "organisation":
            cmp = a.organisation.localeCompare(b.organisation);
            break;
          case "membres":
            cmp = a._count.membres - b._count.membres;
            break;
          case "raids":
            cmp = a._count.raids - b._count.raids;
            break;
          case "tarif":
            cmp = a.tarif_journalier - b.tarif_journalier;
            break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [
    ressources,
    search,
    filterType,
    filterOrg,
    filterActif,
    sortField,
    sortDir,
    equipes,
  ]);

  const totalPages =
    pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated =
    pageSize === 0
      ? filtered
      : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered.length]);

  function resetFilters() {
    setSearch("");
    setFilterType([]);
    setFilterOrg([]);
    setFilterActif("all");
  }

  const total = ressources.length;
  const actifs = ressources.filter((r) => r.actif).length;
  const inactifs = total - actifs;
  const avecCompte = ressources.filter((r) => !!r.user).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ressources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personnes du programme — avec ou sans compte applicatif
        </p>
      </div>

      {/* KPI strip — same pattern as users page */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <Contact className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold tabular-nums">{total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-green-500/10 text-green-600">
            <UserCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Actives</p>
            <p className="text-lg font-bold tabular-nums">{actifs}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <UserX className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inactives</p>
            <p className="text-lg font-bold tabular-nums">{inactifs}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-violet-500/10 text-violet-600">
            <KeyRound className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avec compte</p>
            <p className="text-lg font-bold tabular-nums">{avecCompte}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Annuaire des ressources</CardTitle>
            <CardDescription>
              {filtered.length} ressource(s) sur {total}
              {hasActiveFilters ? " (filtrées)" : ""}
            </CardDescription>
          </div>
          <CardAction>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={equipes.length === 0}
            >
              <Plus className="mr-1.5 size-4" />
              Nouvelle ressource
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher (nom, email, org, équipe, login)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <MultiSelect
                options={TYPE_OPTIONS}
                selected={filterType}
                onChange={setFilterType}
                placeholder="Type"
                className="w-40"
              />
              {orgOptions.length > 0 && (
                <MultiSelect
                  options={orgOptions}
                  selected={filterOrg}
                  onChange={setFilterOrg}
                  placeholder="Organisation"
                  className="w-48"
                />
              )}
              <Select value={filterActif} onValueChange={setFilterActif}>
                <SelectTrigger className="w-[140px]">
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
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Réinitialiser
                </Button>
              )}
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-2">
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
                    <SelectTrigger className="h-8 w-20" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 25, 30].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                      <SelectItem value="all">Tout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-0.5 rounded-md border p-0.5">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    className="size-7"
                    onClick={() => setViewMode("grid")}
                    title="Vue cartes"
                  >
                    <LayoutGrid className="size-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="icon"
                    className="size-7"
                    onClick={() => setViewMode("table")}
                    title="Vue tableau"
                  >
                    <TableIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {viewMode === "grid" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.length === 0 ? (
                  <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                    Aucune ressource trouvée
                  </p>
                ) : (
                  paginated.map((r) => (
                    <RessourceCard
                      key={r.id}
                      ressource={r}
                      equipes={equipes}
                      activeRoles={activeRoles}
                      canCreateAccount={canCreateAccount}
                    />
                  ))
                )}
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
            </>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">
                        <SortHeader
                          label="Nom complet"
                          field="nom_complet"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">
                        <SortHeader
                          label="Type"
                          field="type"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Profil
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Équipe hier.
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Compte
                      </th>
                      <th className="px-3 py-2 text-center">
                        <SortHeader
                          label="Chantiers"
                          field="membres"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th className="px-3 py-2 text-center">
                        <SortHeader
                          label="RAID"
                          field="raids"
                          current={sortField}
                          dir={sortDir}
                          onSort={handleSort}
                        />
                      </th>
                      <th className="px-3 py-2 text-center font-medium">
                        Statut
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-3 py-12 text-center text-muted-foreground"
                        >
                          Aucune ressource trouvée
                        </td>
                      </tr>
                    ) : (
                      paginated.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{r.nom_complet}</div>
                            {r.email ? (
                              <div className="text-[11px] text-muted-foreground">
                                {r.email}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              className="text-[10px]"
                              style={{
                                backgroundColor:
                                  RESSOURCE_TYPE_COLORS[r.type],
                                color: "white",
                              }}
                            >
                              {RESSOURCE_TYPE_LABELS[r.type] ?? r.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {r.profil?.nom || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-sm">
                              {resolveEquipeHierarchieName(r, equipes)}
                            </div>
                            {(r.equipesFonctionnelles?.length ?? 0) > 0 && (
                              <div
                                className="max-w-[200px] truncate text-[11px] text-muted-foreground"
                                title={r
                                  .equipesFonctionnelles!.map(
                                    (l) => l.equipe?.name
                                  )
                                  .filter(Boolean)
                                  .join(", ")}
                              >
                                {(() => {
                                  const names = r.equipesFonctionnelles!
                                    .map((l) => l.equipe?.name?.trim())
                                    .filter(Boolean) as string[];
                                  if (names.length === 0) {
                                    return `+${r.equipesFonctionnelles!.length} fonct.`;
                                  }
                                  if (names.length <= 2)
                                    return names.join(", ");
                                  return `${names.slice(0, 2).join(", ")} (+${names.length - 2})`;
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {r.user ? (
                              <Badge className="bg-blue-600 text-[10px] hover:bg-blue-600">
                                {r.user.username}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Sans compte
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {r._count.membres}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">
                            {r._count.raids}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {r.actif ? (
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
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title="Modifier"
                                onClick={() => setEditRessource(r)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title="Supprimer"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteId(r.id);
                                }}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                title="Ouvrir"
                                asChild
                              >
                                <Link href={`/ressources/${r.id}`}>
                                  <ArrowRight className="size-3.5" />
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
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
            </>
          )}

          {deleteError && (
            <p className="mt-3 text-xs text-destructive">{deleteError}</p>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <RessourceFormDialog
          open={createOpen}
          onOpenChange={(o) => !o && setCreateOpen(false)}
          equipes={equipes}
          activeRoles={activeRoles}
          canCreateAccount={canCreateAccount}
        />
      )}

      {editRessource && (
        <RessourceFormDialog
          open={!!editRessource}
          onOpenChange={(open) => !open && setEditRessource(null)}
          ressource={editRessource}
          equipes={equipes}
          activeRoles={activeRoles}
          canCreateAccount={canCreateAccount}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={async () => {
          try {
            if (deleteId) await deleteRessource(deleteId);
          } catch (err) {
            setDeleteError(
              err instanceof Error ? err.message : "Erreur de suppression"
            );
            throw err;
          }
        }}
        title="Supprimer la ressource"
      />
    </main>
  );
}
