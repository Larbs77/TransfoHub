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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  profil?: { id: string; nom: string; type_ressource: string; tjm_defaut: number } | null;
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
  equipes?: { id: string; name: string; is_active: boolean }[];
  activeRoles?: { code: string; label: string }[];
  canCreateAccount?: boolean;
}

type ViewMode = "grid" | "table";
type SortField = "nom_complet" | "type" | "organisation" | "membres" | "raids" | "tarif";
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
      className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded"
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
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [editRessource, setEditRessource] = useState<RessourceWithStats | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Build dynamic organisation options
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
    search || filterType.length > 0 || filterOrg.length > 0 || filterActif !== "all";

  const filtered = useMemo(() => {
    let result = ressources;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.nom_complet.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.organisation.toLowerCase().includes(q) ||
          (r.equipeHierarchie?.name ?? "").toLowerCase().includes(q) ||
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
  }, [ressources, search, filterType, filterOrg, filterActif, sortField, sortDir]);

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

  return (
    <>
      {/* Filter bar */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Rechercher (nom, email, org)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
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
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Réinitialiser
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {filtered.length} / {ressources.length} ressource(s)
          </span>
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
                <SelectTrigger className="w-20 h-8" size="sm">
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
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon-xs"
                onClick={() => setViewMode("grid")}
                title="Vue cartes"
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="icon-xs"
                onClick={() => setViewMode("table")}
                title="Vue tableau"
              >
                <TableIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "grid" ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-8">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader label="Nom complet" field="nom_complet" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Type" field="type" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Équipe hier.</TableHead>
                <TableHead>Compte</TableHead>
                <TableHead>
                  <SortHeader label="Chantiers" field="membres" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="RAID" field="raids" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    Aucune ressource trouvée
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div>{r.nom_complet}</div>
                      {r.email ? (
                        <div className="text-[11px] text-muted-foreground">
                          {r.email}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="text-[10px]"
                        style={{
                          backgroundColor: RESSOURCE_TYPE_COLORS[r.type],
                          color: "white",
                        }}
                      >
                        {RESSOURCE_TYPE_LABELS[r.type] ?? r.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.profil?.nom || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{r.equipeHierarchie?.name || "—"}</div>
                      {(r.equipesFonctionnelles?.length ?? 0) > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          +{r.equipesFonctionnelles!.length} fonct.
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.user ? (
                        <Badge className="text-[10px] bg-blue-600 hover:bg-blue-600">
                          {r.user.username}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sans compte
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r._count.membres}
                    </TableCell>
                    <TableCell className="text-center">
                      {r._count.raids}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.actif ? "default" : "secondary"}
                        className={`text-[10px] ${r.actif ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                      >
                        {r.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setEditRessource(r)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteId(r.id);
                          }}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                        <Link href={`/ressources/${r.id}`}>
                          <Button variant="ghost" size="icon-xs">
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pageSize > 0 && totalPages > 1 && (
            <PaginationControls
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              pageSize={pageSize}
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
          {deleteError && (
            <p className="text-xs text-destructive mt-2">{deleteError}</p>
          )}
        </>
      )}
    </>
  );
}
