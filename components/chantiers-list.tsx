"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { LayoutGrid, TableIcon, GanttChart, Pencil, Trash2, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
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
import { ChantierCard } from "./chantier-card";
import {
  DOMAINE_LABELS,
  DOMAINE_COLORS,
  TYPE_CHANTIER_LABELS,
  TYPE_CHANTIER_COLORS,
  PRIORITE_CHANTIER_LABELS,
  PRIORITE_CHANTIER_COLORS,
  STATUT_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
} from "@/lib/chantier-labels";
import Link from "next/link";
import { deleteChantier } from "@/app/(app)/actions";
import { ChantierFormDialog } from "./chantier-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { ChantierGantt } from "./chantier-gantt";

interface ChantierWithStats {
  id: string;
  code: string;
  nom: string;
  description: string;
  domaine: string;
  type_chantier: string;
  priorite: string;
  duree_mois: number;
  budget: number;
  budgetJH: number;
  budgetProjetMAD: number;
  conseilEditeursMAD: number;
  licencesAchatsMAD: number;
  licencesAbonnementsMAD: number;
  coutsInfrasMAD: number;
  budgetTotalMAD: number;
  directeur: string;
  pmo: string;
  date_debut: Date;
  date_fin: Date;
  statut: string;
  avancement: number;
  createdAt: Date;
  updatedAt: Date;
  _count: { raids: number };
  raids: { type: string; statut: string }[];
  rmds?: { rmd: { id: string; nom_complet: string } }[];
  jalons?: { id: string; nom: string; phase: string; statut: string; date_cible: Date; date_reelle: Date | null }[];
}

interface Props {
  chantiers: ChantierWithStats[];
  favoris?: string[];
}

type ViewMode = "grid" | "table" | "gantt";
type SortField = "code" | "nom" | "domaine" | "type_chantier" | "priorite" | "statut" | "date_debut" | "date_fin" | "duree_mois";
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
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
          }
          return pages.map((page, idx) =>
            page === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">...</span>
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

const DOMAINE_OPTIONS = Object.entries(DOMAINE_LABELS).map(([k, v]) => ({ value: k, label: v }));
const TYPE_OPTIONS = Object.entries(TYPE_CHANTIER_LABELS).map(([k, v]) => ({ value: k, label: v }));
const PRIORITE_OPTIONS = Object.entries(PRIORITE_CHANTIER_LABELS).map(([k, v]) => ({ value: k, label: v }));
const STATUT_OPTIONS = Object.entries(STATUT_CHANTIER_LABELS).map(([k, v]) => ({ value: k, label: v }));

export function ChantiersList({ chantiers, favoris = [] }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Filters
  const [search, setSearch] = useState("");
  const [filterDomaine, setFilterDomaine] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterPriorite, setFilterPriorite] = useState<string[]>([]);
  const [filterStatut, setFilterStatut] = useState<string[]>([]);
  const [filterDirecteur, setFilterDirecteur] = useState<string[]>([]);
  const [filterPmo, setFilterPmo] = useState<string[]>([]);
  const [filterRmd, setFilterRmd] = useState<string[]>([]);
  const [dateDebutFrom, setDateDebutFrom] = useState("");
  const [dateDebutTo, setDateDebutTo] = useState("");
  const [dateFinFrom, setDateFinFrom] = useState("");
  const [dateFinTo, setDateFinTo] = useState("");

  // Pagination
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sort (table view)
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Table row edit/delete state
  const [editChantier, setEditChantier] = useState<ChantierWithStats | null>(null);
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

  // Unique directeurs/PMOs for filters
  const directeurOptions = useMemo(() => {
    const vals = [...new Set(chantiers.map((c) => c.directeur).filter(Boolean))].sort();
    return vals.map((v) => ({ value: v, label: v }));
  }, [chantiers]);

  const pmoOptions = useMemo(() => {
    const vals = [...new Set(chantiers.map((c) => c.pmo).filter(Boolean))].sort();
    return vals.map((v) => ({ value: v, label: v }));
  }, [chantiers]);

  const rmdOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of chantiers) {
      for (const cr of c.rmds ?? []) {
        map.set(cr.rmd.id, cr.rmd.nom_complet);
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name }));
  }, [chantiers]);

  const hasActiveFilters =
    search ||
    filterDomaine.length > 0 ||
    filterType.length > 0 ||
    filterPriorite.length > 0 ||
    filterStatut.length > 0 ||
    filterDirecteur.length > 0 ||
    filterPmo.length > 0 ||
    filterRmd.length > 0 ||
    dateDebutFrom ||
    dateDebutTo ||
    dateFinFrom ||
    dateFinTo;

  const filtered = useMemo(() => {
    let result = chantiers;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.nom.toLowerCase().includes(q) ||
          c.directeur.toLowerCase().includes(q) ||
          c.pmo.toLowerCase().includes(q)
      );
    }
    if (filterDomaine.length > 0) {
      result = result.filter((c) => filterDomaine.includes(c.domaine));
    }
    if (filterType.length > 0) {
      result = result.filter((c) => filterType.includes(c.type_chantier));
    }
    if (filterPriorite.length > 0) {
      result = result.filter((c) => filterPriorite.includes(c.priorite));
    }
    if (filterStatut.length > 0) {
      result = result.filter((c) => filterStatut.includes(c.statut));
    }
    if (filterDirecteur.length > 0) {
      result = result.filter((c) => filterDirecteur.includes(c.directeur));
    }
    if (filterPmo.length > 0) {
      result = result.filter((c) => filterPmo.includes(c.pmo));
    }
    if (filterRmd.length > 0) {
      result = result.filter((c) =>
        (c.rmds ?? []).some((cr) => filterRmd.includes(cr.rmd.id))
      );
    }
    if (dateDebutFrom) {
      const from = new Date(dateDebutFrom);
      result = result.filter((c) => new Date(c.date_debut) >= from);
    }
    if (dateDebutTo) {
      const to = new Date(dateDebutTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((c) => new Date(c.date_debut) <= to);
    }
    if (dateFinFrom) {
      const from = new Date(dateFinFrom);
      result = result.filter((c) => new Date(c.date_fin) >= from);
    }
    if (dateFinTo) {
      const to = new Date(dateFinTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((c) => new Date(c.date_fin) <= to);
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "code": cmp = a.code.localeCompare(b.code); break;
          case "nom": cmp = a.nom.localeCompare(b.nom); break;
          case "domaine": cmp = a.domaine.localeCompare(b.domaine); break;
          case "type_chantier": cmp = a.type_chantier.localeCompare(b.type_chantier); break;
          case "priorite": cmp = a.priorite.localeCompare(b.priorite); break;
          case "statut": cmp = a.statut.localeCompare(b.statut); break;
          case "date_debut": cmp = new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime(); break;
          case "date_fin": cmp = new Date(a.date_fin).getTime() - new Date(b.date_fin).getTime(); break;
          case "duree_mois": cmp = a.duree_mois - b.duree_mois; break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [chantiers, search, filterDomaine, filterType, filterPriorite, filterStatut, filterDirecteur, filterPmo, filterRmd, dateDebutFrom, dateDebutTo, dateFinFrom, dateFinTo, sortField, sortDir]);

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated = pageSize === 0
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filtered.length]);

  function resetFilters() {
    setSearch("");
    setFilterDomaine([]);
    setFilterType([]);
    setFilterPriorite([]);
    setFilterStatut([]);
    setFilterDirecteur([]);
    setFilterPmo([]);
    setFilterRmd([]);
    setDateDebutFrom("");
    setDateDebutTo("");
    setDateFinFrom("");
    setDateFinTo("");
  }

  return (
    <>
      {/* Filter bar */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Rechercher (code, nom, directeur)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <MultiSelect
            options={STATUT_OPTIONS}
            selected={filterStatut}
            onChange={setFilterStatut}
            placeholder="Statut"
            className="w-40"
          />
          <MultiSelect
            options={DOMAINE_OPTIONS}
            selected={filterDomaine}
            onChange={setFilterDomaine}
            placeholder="Domaine"
            className="w-48"
          />
          <MultiSelect
            options={TYPE_OPTIONS}
            selected={filterType}
            onChange={setFilterType}
            placeholder="Type chantier"
            className="w-48"
          />
          <MultiSelect
            options={PRIORITE_OPTIONS}
            selected={filterPriorite}
            onChange={setFilterPriorite}
            placeholder="Priorité"
            className="w-48"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {directeurOptions.length > 0 && (
            <MultiSelect
              options={directeurOptions}
              selected={filterDirecteur}
              onChange={setFilterDirecteur}
              placeholder="Directeur"
              className="w-48"
            />
          )}
          {pmoOptions.length > 0 && (
            <MultiSelect
              options={pmoOptions}
              selected={filterPmo}
              onChange={setFilterPmo}
              placeholder="PMO"
              className="w-40"
            />
          )}
          {rmdOptions.length > 0 && (
            <MultiSelect
              options={rmdOptions}
              selected={filterRmd}
              onChange={setFilterRmd}
              placeholder="RMD"
              className="w-48"
            />
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Début du</label>
            <Input type="date" value={dateDebutFrom} onChange={(e) => setDateDebutFrom(e.target.value)} className="w-36 h-9" />
            <label className="text-xs text-muted-foreground whitespace-nowrap">au</label>
            <Input type="date" value={dateDebutTo} onChange={(e) => setDateDebutTo(e.target.value)} className="w-36 h-9" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Fin du</label>
            <Input type="date" value={dateFinFrom} onChange={(e) => setDateFinFrom(e.target.value)} className="w-36 h-9" />
            <label className="text-xs text-muted-foreground whitespace-nowrap">au</label>
            <Input type="date" value={dateFinTo} onChange={(e) => setDateFinTo(e.target.value)} className="w-36 h-9" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Réinitialiser
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {filtered.length} / {chantiers.length} chantier(s)
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Afficher</label>
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
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
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
              <Button
                variant={viewMode === "gantt" ? "default" : "ghost"}
                size="icon-xs"
                onClick={() => setViewMode("gantt")}
                title="Vue Gantt"
              >
                <GanttChart className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "gantt" ? (
        <ChantierGantt chantiers={filtered} />
      ) : viewMode === "grid" ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-8">
                Aucun chantier trouvé
              </p>
            ) : (
              paginated.map((c) => <ChantierCard key={c.id} chantier={c} isFavori={favoris.includes(c.id)} />)
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
                  <SortHeader label="Code" field="code" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Nom" field="nom" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Priorité" field="priorite" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Statut" field="statut" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Début" field="date_debut" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Fin" field="date_fin" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Durée" field="duree_mois" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Aucun chantier trouvé
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm font-medium">{c.nom}</TableCell>
                    <TableCell>
                      <Badge className="text-[10px]" style={{ backgroundColor: PRIORITE_CHANTIER_COLORS[c.priorite], color: "white" }}>{PRIORITE_CHANTIER_LABELS[c.priorite] ?? c.priorite}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="text-[10px]" style={{ backgroundColor: STATUT_CHANTIER_COLORS[c.statut], color: "white" }}>
                        {STATUT_CHANTIER_LABELS[c.statut] ?? c.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(c.date_debut), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(c.date_fin), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs text-center">{c.duree_mois}m</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => setEditChantier(c)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => { setDeleteError(null); setDeleteId(c.id); }}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                        <Link href={`/chantiers/${c.id}`}>
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

          {editChantier && (
            <ChantierFormDialog
              open={!!editChantier}
              onOpenChange={(open) => !open && setEditChantier(null)}
              chantier={editChantier}
            />
          )}

          <DeleteConfirmDialog
            open={!!deleteId}
            onOpenChange={(open) => !open && setDeleteId(null)}
            onConfirm={async () => {
              try {
                if (deleteId) await deleteChantier(deleteId);
              } catch (err) {
                setDeleteError(
                  err instanceof Error ? err.message : "Erreur de suppression"
                );
                throw err;
              }
            }}
            title="Supprimer le chantier"
          />
          {deleteError && (
            <p className="text-xs text-destructive mt-2">{deleteError}</p>
          )}
        </>
      )}
    </>
  );
}
