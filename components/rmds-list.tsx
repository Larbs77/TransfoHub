"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, TableIcon, Pencil, Trash2, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
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
import { RmdCard } from "./rmd-card";
import { RmdFormDialog } from "./rmd-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { deleteRmd } from "@/app/(app)/actions";
import { DOMAINE_LABELS, DOMAINE_COLORS } from "@/lib/chantier-labels";

interface RmdWithStats {
  id: string;
  nom_complet: string;
  domaine: string;
  suppleant: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { chantiers: number };
}

interface Props {
  rmds: RmdWithStats[];
}

type ViewMode = "grid" | "table";
type SortField = "nom_complet" | "domaine" | "suppleant" | "chantiers";
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

export function RmdsList({ rmds }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [filterDomaine, setFilterDomaine] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Table row edit/delete state
  const [editRmd, setEditRmd] = useState<RmdWithStats | null>(null);
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

  const hasActiveFilters = search || filterDomaine.length > 0;

  const filtered = useMemo(() => {
    let result = rmds;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.nom_complet.toLowerCase().includes(q) ||
          r.suppleant.toLowerCase().includes(q)
      );
    }
    if (filterDomaine.length > 0) {
      result = result.filter((r) => filterDomaine.includes(r.domaine));
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "nom_complet": cmp = a.nom_complet.localeCompare(b.nom_complet); break;
          case "domaine": cmp = a.domaine.localeCompare(b.domaine); break;
          case "suppleant": cmp = a.suppleant.localeCompare(b.suppleant); break;
          case "chantiers": cmp = a._count.chantiers - b._count.chantiers; break;
        }
        return sortDir === "desc" ? -cmp : cmp;
      });
    }

    return result;
  }, [rmds, search, filterDomaine, sortField, sortDir]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated = pageSize === 0
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [filtered.length]);

  function resetFilters() {
    setSearch("");
    setFilterDomaine([]);
  }

  return (
    <>
      {/* Filter bar */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Rechercher (nom, suppléant)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <MultiSelect
            options={DOMAINE_OPTIONS}
            selected={filterDomaine}
            onChange={setFilterDomaine}
            placeholder="Domaine"
            className="w-48"
          />
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Réinitialiser
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {filtered.length} / {rmds.length} RMD(s)
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
                Aucun RMD trouvé
              </p>
            ) : (
              paginated.map((r) => <RmdCard key={r.id} rmd={r} />)
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
                  <SortHeader label="Domaine" field="domaine" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Suppléant(e)" field="suppleant" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortHeader label="Chantiers" field="chantiers" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucun RMD trouvé
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nom_complet}</TableCell>
                    <TableCell>
                      <Badge className="text-[10px]" style={{ backgroundColor: DOMAINE_COLORS[r.domaine], color: "white" }}>{DOMAINE_LABELS[r.domaine] ?? r.domaine}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.suppleant || "—"}</TableCell>
                    <TableCell className="text-center">{r._count.chantiers}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => setEditRmd(r)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => { setDeleteError(null); setDeleteId(r.id); }}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                        <Link href={`/rmds/${r.id}`}>
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

          {editRmd && (
            <RmdFormDialog
              open={!!editRmd}
              onOpenChange={(open) => !open && setEditRmd(null)}
              rmd={editRmd}
            />
          )}

          <DeleteConfirmDialog
            open={!!deleteId}
            onOpenChange={(open) => !open && setDeleteId(null)}
            onConfirm={async () => {
              try {
                if (deleteId) await deleteRmd(deleteId);
              } catch (err) {
                setDeleteError(
                  err instanceof Error ? err.message : "Erreur de suppression"
                );
                throw err;
              }
            }}
            title="Supprimer le RMD"
          />
          {deleteError && (
            <p className="text-xs text-destructive mt-2">{deleteError}</p>
          )}
        </>
      )}
    </>
  );
}
