"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  AlertTriangle,
  Table2,
  Network,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Building2,
  UserRound,
  Layers,
  Flag,
  CircleDot,
  Eye,
  X,
  type LucideIcon,
} from "lucide-react";
import { deleteAdherence, restoreAdherence } from "@/app/(app)/actions";
import { useCanWritePage, useUser } from "@/components/user-provider";
import { AdherenceFormDialog } from "@/components/adherence-form-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { AdherenceGraph } from "@/components/adherence-graph";
import {
  ADHERENCE_TYPES,
  ADHERENCE_TYPE_COLORS,
  ADHERENCE_STATUTS,
  ADHERENCE_STATUT_COLORS,
  ADHERENCE_CRITICITES,
  ADHERENCE_CRITICITE_COLORS,
  chantiersFromDependants,
} from "@/lib/adherence-labels";
import Link from "next/link";

interface ChantierRef {
  id: string;
  code: string;
  nom: string;
  domaine: string;
  statut: string;
}

interface AdherenceItem {
  id: string;
  code: string;
  chantierSourceId: string;
  chantierSource: ChantierRef;
  chantierDependantLabel: string;
  dependants?: Array<{ chantier: ChantierRef }>;
  type: string;
  domaine: string;
  description: string;
  livrables?: string;
  criticite: string;
  statut: string;
  date_identification: Date | null;
  date_resolution_prevue: Date | null;
  responsable: string;
  contrat_interface: string;
  commentaires: string;
  deletedAt?: Date | string | null;
  deletedByName?: string | null;
  deleteMotif?: string | null;
}

interface ChantierOption {
  id: string;
  code: string;
  nom: string;
}

interface Props {
  adherences: AdherenceItem[];
  chantiers: ChantierOption[];
  chantiersDependant?: ChantierOption[];
  nextCode: string;
  allowTransverse?: boolean;
}

function KpiCard({
  label,
  value,
  color,
  active,
  onClick,
  title,
}: {
  label: string;
  value: string | number;
  color: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
        onClick
          ? "cursor-pointer hover:border-[#0A3C74]/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45"
          : ""
      } ${
        active
          ? "border-[#0A3C74] bg-[#0A3C74]/[0.05] shadow-sm ring-1 ring-[#0A3C74]/20"
          : "bg-card"
      }`}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: color + "18" }}
      >
        <span className="text-lg font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

const filterControlClass =
  "h-9 w-full min-w-0 border-[#0A3C74]/15 bg-background focus-visible:ring-[#00BDBB]/40";

function FilterField({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A3C74]/70 dark:text-muted-foreground">
        <Icon className="size-3.5 text-[#00BDBB]" />
        {label}
      </div>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#0A3C74]/15 bg-[#0A3C74]/5 px-2.5 py-0.5 text-xs font-medium text-[#0A3C74] transition-colors hover:border-[#0A3C74]/30 hover:bg-[#0A3C74]/10 dark:text-foreground"
    >
      <span className="truncate">{label}</span>
      <X className="size-3 shrink-0 opacity-60" />
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

type SortField = "code" | "source" | "dependant" | "type" | "criticite" | "statut" | "echeance" | "responsable";
type SortDir = "asc" | "desc";

const CRITICITE_ORDER: Record<string, number> = { BLOQUANTE: 0, MAJEURE: 1, MOYENNE: 2, MINEURE: 3 };
const STATUT_ADH_ORDER: Record<string, number> = { "Bloqué": 0, "En cours": 1, Identifié: 2, Résolu: 3 };

function isDeleted(a: AdherenceItem) {
  return !!a.deletedAt;
}

export function AdherencesRegistre({
  adherences,
  chantiers,
  chantiersDependant,
  nextCode,
  allowTransverse = false,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdherenceItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCriticite, setFilterCriticite] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterFournisseur, setFilterFournisseur] = useState<string[]>([]);
  const [filterDemandeur, setFilterDemandeur] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"registre" | "graphe">("registre");
  const [filterDeleted, setFilterDeleted] = useState<"active" | "deleted" | "all">(
    "active"
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const canWrite = useCanWritePage("/adherences");
  const { consultationChantierIds, chantierScope, memberChantierIds, role } =
    useUser();

  function canMutateAdherence(a: AdherenceItem) {
    if (!canWrite) return false;
    if (chantierScope === "all" || role === "Admin") return true;
    const dependantIds = a.dependants?.map((d) => d.chantier.id) ?? [];
    if (dependantIds.length === 0) return false;
    return dependantIds.every(
      (id) =>
        memberChantierIds.includes(id) &&
        !consultationChantierIds.includes(id)
    );
  }

  const [sortField, setSortField] = useState<SortField>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortableHead({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) {
    return (
      <TableHead className={className}>
        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(field)}>
          {children}
          <ArrowUpDown className={`size-3 ${sortField === field ? "text-foreground" : "text-muted-foreground/50"}`} />
        </button>
      </TableHead>
    );
  }

  const activeAdherences = useMemo(
    () => adherences.filter((a) => !isDeleted(a)),
    [adherences]
  );

  const total = activeAdherences.length;
  const bloquantes = activeAdherences.filter((a) => a.criticite === "BLOQUANTE").length;
  const enCours = activeAdherences.filter((a) => a.statut === "En cours").length;
  const resolues = activeAdherences.filter((a) => a.statut === "Résolu").length;
  const bloquees = activeAdherences.filter((a) => a.statut === "Bloqué").length;

  const fournisseurFilterOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    for (const a of adherences) {
      map.set(a.chantierSource.id, {
        value: a.chantierSource.id,
        label: `${a.chantierSource.code} — ${a.chantierSource.nom}`,
      });
    }
    return [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "fr")
    );
  }, [adherences]);

  const demandeurFilterOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    let hasTransverse = false;
    for (const a of adherences) {
      const deps = chantiersFromDependants(a.dependants);
      if (!deps.length) hasTransverse = true;
      for (const d of deps) {
        map.set(d.id, {
          value: d.id,
          label: `${d.code} — ${d.nom}`,
        });
      }
    }
    const list = [...map.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "fr")
    );
    if (hasTransverse) {
      list.push({ value: "__transverse__", label: "Transverse" });
    }
    return list;
  }, [adherences]);

  const filtered = useMemo(() => {
    const result = adherences.filter((a) => {
      if (filterDeleted === "active" && isDeleted(a)) return false;
      if (filterDeleted === "deleted" && !isDeleted(a)) return false;
      if (filterType !== "all" && a.type !== filterType) return false;
      if (filterCriticite !== "all" && a.criticite !== filterCriticite) return false;
      if (filterStatut !== "all" && a.statut !== filterStatut) return false;
      if (
        filterFournisseur.length > 0 &&
        !filterFournisseur.includes(a.chantierSourceId)
      ) {
        return false;
      }
      if (filterDemandeur.length > 0) {
        const deps = chantiersFromDependants(a.dependants);
        const match =
          deps.some((d) => filterDemandeur.includes(d.id)) ||
          (deps.length === 0 && filterDemandeur.includes("__transverse__"));
        if (!match) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        return (
          a.code.toLowerCase().includes(s) ||
          a.description.toLowerCase().includes(s) ||
          (a.livrables ?? "").toLowerCase().includes(s) ||
          a.chantierSource.code.toLowerCase().includes(s) ||
          a.chantierSource.nom.toLowerCase().includes(s) ||
          chantiersFromDependants(a.dependants).some(
            (d) =>
              d.code.toLowerCase().includes(s) ||
              d.nom.toLowerCase().includes(s)
          ) ||
          (a.chantierDependantLabel ?? "").toLowerCase().includes(s) ||
          a.responsable.toLowerCase().includes(s) ||
          (a.deleteMotif ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "code": return dir * a.code.localeCompare(b.code);
        case "source": return dir * a.chantierSource.code.localeCompare(b.chantierSource.code);
        case "dependant": {
          const da = chantiersFromDependants(a.dependants)[0]?.code ?? a.chantierDependantLabel ?? "";
          const db = chantiersFromDependants(b.dependants)[0]?.code ?? b.chantierDependantLabel ?? "";
          return dir * da.localeCompare(db);
        }
        case "type": return dir * a.type.localeCompare(b.type);
        case "criticite": return dir * ((CRITICITE_ORDER[a.criticite] ?? 9) - (CRITICITE_ORDER[b.criticite] ?? 9));
        case "statut": return dir * ((STATUT_ADH_ORDER[a.statut] ?? 9) - (STATUT_ADH_ORDER[b.statut] ?? 9));
        case "echeance": {
          const da = a.date_resolution_prevue ? new Date(a.date_resolution_prevue).getTime() : Infinity;
          const db = b.date_resolution_prevue ? new Date(b.date_resolution_prevue).getTime() : Infinity;
          return dir * (da - db);
        }
        case "responsable": return dir * a.responsable.localeCompare(b.responsable);
        default: return 0;
      }
    });

    return result;
  }, [
    adherences,
    search,
    filterType,
    filterCriticite,
    filterStatut,
    filterDeleted,
    filterFournisseur,
    filterDemandeur,
    sortField,
    sortDir,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    filterType,
    filterCriticite,
    filterStatut,
    filterDeleted,
    filterFournisseur,
    filterDemandeur,
    pageSize,
  ]);

  const kpiActive = {
    total:
      filterStatut === "all" &&
      filterCriticite === "all" &&
      filterType === "all" &&
      filterFournisseur.length === 0 &&
      filterDemandeur.length === 0 &&
      !search,
    bloquantes: filterCriticite === "BLOQUANTE",
    enCours: filterStatut === "En cours" && filterCriticite === "all",
    resolues: filterStatut === "Résolu" && filterCriticite === "all",
    bloquees: filterStatut === "Bloqué" && filterCriticite === "all",
  };

  function applyKpiFilter(
    mode: "total" | "bloquantes" | "enCours" | "resolues" | "bloquees"
  ) {
    const already =
      (mode === "total" && kpiActive.total) ||
      (mode === "bloquantes" && kpiActive.bloquantes) ||
      (mode === "enCours" && kpiActive.enCours) ||
      (mode === "resolues" && kpiActive.resolues) ||
      (mode === "bloquees" && kpiActive.bloquees);
    if (already || mode === "total") {
      setFilterStatut("all");
      setFilterCriticite("all");
      setFilterType("all");
      setFilterFournisseur([]);
      setFilterDemandeur([]);
      setSearch("");
      if (mode === "total" || already) return;
    }
    setSearch("");
    if (mode === "bloquantes") {
      setFilterCriticite("BLOQUANTE");
      setFilterStatut("all");
      return;
    }
    setFilterCriticite("all");
    if (mode === "enCours") setFilterStatut("En cours");
    if (mode === "resolues") setFilterStatut("Résolu");
    if (mode === "bloquees") setFilterStatut("Bloqué");
  }

  const graphAdherences = useMemo(
    () => filtered.filter((a) => !isDeleted(a)),
    [filtered]
  );

  const hasActiveFilters =
    !!search ||
    filterType !== "all" ||
    filterCriticite !== "all" ||
    filterStatut !== "all" ||
    filterDeleted !== "active" ||
    filterFournisseur.length > 0 ||
    filterDemandeur.length > 0;

  function resetFilters() {
    setSearch("");
    setFilterType("all");
    setFilterCriticite("all");
    setFilterStatut("all");
    setFilterDeleted("active");
    setFilterFournisseur([]);
    setFilterDemandeur([]);
  }

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated = pageSize === 0
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function confirmDelete(motif?: string) {
    if (!deleteId) return;
    await deleteAdherence(deleteId, motif);
    setDeleteId(null);
  }

  async function confirmRestore(motif?: string) {
    if (!restoreId) return;
    await restoreAdherence(restoreId, motif);
    setRestoreId(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total adhérences"
          value={total}
          color="#3b82f6"
          active={kpiActive.total}
          onClick={() => applyKpiFilter("total")}
          title="Afficher toutes les adhérences"
        />
        <KpiCard
          label="Bloquantes"
          value={bloquantes}
          color="#dc2626"
          active={kpiActive.bloquantes}
          onClick={() => applyKpiFilter("bloquantes")}
          title="Filtrer : criticité bloquante"
        />
        <KpiCard
          label="En cours"
          value={enCours}
          color="#f97316"
          active={kpiActive.enCours}
          onClick={() => applyKpiFilter("enCours")}
          title="Filtrer : statut En cours"
        />
        <KpiCard
          label="Résolues"
          value={resolues}
          color="#22c55e"
          active={kpiActive.resolues}
          onClick={() => applyKpiFilter("resolues")}
          title="Filtrer : statut Résolu"
        />
        <KpiCard
          label="Bloquées"
          value={bloquees}
          color="#ef4444"
          active={kpiActive.bloquees}
          onClick={() => applyKpiFilter("bloquees")}
          title="Filtrer : statut Bloqué"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Vue adhérences"
          className="inline-flex h-10 items-center rounded-full border border-[#0A3C74]/15 bg-[#0A3C74]/[0.04] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "registre"}
            onClick={() => setViewMode("registre")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
              viewMode === "registre"
                ? "bg-[#0A3C74] text-white shadow-sm"
                : "text-muted-foreground hover:text-[#0A3C74]"
            )}
          >
            <Table2 className="size-4" />
            Registre
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "graphe"}
            onClick={() => setViewMode("graphe")}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
              viewMode === "graphe"
                ? "bg-[#0A3C74] text-white shadow-sm"
                : "text-muted-foreground hover:text-[#0A3C74]"
            )}
          >
            <Network className="size-4" />
            Graphe
          </button>
        </div>
        {canWrite ? (
          <Button
            size="sm"
            onClick={() => {
              setEditItem(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Nouvelle adhérence
          </Button>
        ) : null}
      </div>

      <div className="overflow-visible rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#0A3C74] dark:text-foreground">
            <SlidersHorizontal className="size-4 text-[#00BDBB]" />
            Filtres
          </div>
          <Badge
            variant="outline"
            className="border-[#00BDBB]/30 bg-[#00BDBB]/5 font-normal text-[#0A3C74] dark:text-foreground"
          >
            {filtered.length} affichée{filtered.length > 1 ? "s" : ""} /{" "}
            {filterDeleted === "deleted" ? adherences.length : total}
          </Badge>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8 gap-1.5 text-xs"
              onClick={resetFilters}
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </Button>
          ) : null}
        </div>

        <div className="space-y-4 p-4">
          <FilterField icon={Search} label="Recherche" className="max-w-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#00BDBB]" />
              <Input
                placeholder="Code, description, livrables, chantier, responsable…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(filterControlClass, "pl-9 pr-8")}
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setSearch("")}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </FilterField>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <FilterField icon={Building2} label="Fournisseur">
              <MultiSelect
                options={fournisseurFilterOptions}
                selected={filterFournisseur}
                onChange={setFilterFournisseur}
                placeholder="Tous les fournisseurs"
                chips={false}
                truncate
                className="w-full"
              />
            </FilterField>
            <div className="hidden h-9 items-center justify-center pb-0 md:flex">
              <span className="flex size-8 items-center justify-center rounded-full border border-[#00BDBB]/30 bg-[#00BDBB]/10">
                <ArrowRight className="size-4 text-[#0A3C74] dark:text-[#00BDBB]" />
              </span>
            </div>
            <FilterField icon={UserRound} label="Demandeur">
              <MultiSelect
                options={demandeurFilterOptions}
                selected={filterDemandeur}
                onChange={setFilterDemandeur}
                placeholder="Tous les demandeurs"
                chips={false}
                truncate
                className="w-full"
              />
            </FilterField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <FilterField icon={Layers} label="Type">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className={filterControlClass}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {ADHERENCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField icon={Flag} label="Criticité">
              <Select value={filterCriticite} onValueChange={setFilterCriticite}>
                <SelectTrigger className={filterControlClass}>
                  <SelectValue placeholder="Criticité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {ADHERENCE_CRITICITES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField icon={CircleDot} label="Statut">
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className={filterControlClass}>
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {ADHERENCE_STATUTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField icon={Eye} label="Visibilité">
              <Select
                value={filterDeleted}
                onValueChange={(v) =>
                  setFilterDeleted(v as "active" | "deleted" | "all")
                }
              >
                <SelectTrigger className={filterControlClass}>
                  <SelectValue placeholder="Visibilité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actives</SelectItem>
                  <SelectItem value="deleted">Supprimées</SelectItem>
                  <SelectItem value="all">Toutes</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            {viewMode === "registre" ? (
              <FilterField icon={Table2} label="Afficher">
                <Select
                  value={pageSize === 0 ? "all" : String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(v === "all" ? 0 : Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className={filterControlClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 30].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} par page
                      </SelectItem>
                    ))}
                    <SelectItem value="all">Tout</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Actifs
              </span>
              {search ? (
                <FilterChip
                  label={`Recherche : ${search}`}
                  onRemove={() => setSearch("")}
                />
              ) : null}
              {filterFournisseur.map((id) => (
                <FilterChip
                  key={`f-${id}`}
                  label={
                    fournisseurFilterOptions.find((o) => o.value === id)
                      ?.label ?? id
                  }
                  onRemove={() =>
                    setFilterFournisseur((prev) =>
                      prev.filter((v) => v !== id)
                    )
                  }
                />
              ))}
              {filterDemandeur.map((id) => (
                <FilterChip
                  key={`d-${id}`}
                  label={
                    demandeurFilterOptions.find((o) => o.value === id)?.label ??
                    id
                  }
                  onRemove={() =>
                    setFilterDemandeur((prev) => prev.filter((v) => v !== id))
                  }
                />
              ))}
              {filterType !== "all" ? (
                <FilterChip
                  label={`Type : ${filterType}`}
                  onRemove={() => setFilterType("all")}
                />
              ) : null}
              {filterCriticite !== "all" ? (
                <FilterChip
                  label={filterCriticite}
                  onRemove={() => setFilterCriticite("all")}
                />
              ) : null}
              {filterStatut !== "all" ? (
                <FilterChip
                  label={filterStatut}
                  onRemove={() => setFilterStatut("all")}
                />
              ) : null}
              {filterDeleted !== "active" ? (
                <FilterChip
                  label={
                    filterDeleted === "deleted" ? "Supprimées" : "Toutes"
                  }
                  onRemove={() => setFilterDeleted("active")}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {viewMode === "graphe" ? (
        <AdherenceGraph adherences={graphAdherences} height={600} />
      ) : (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registre des Adhérences</CardTitle>
          <CardDescription>
            {filtered.length} adhérence(s)
            {filterDeleted === "active"
              ? " actives"
              : filterDeleted === "deleted"
                ? " supprimées"
                : ""}
            {" · "}
            {total} active(s) au total
          </CardDescription>
        </CardHeader>
        <CardContent>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="code" className="w-[80px]">Code</SortableHead>
                  <SortableHead field="source" className="w-[200px]">Fournisseur</SortableHead>
                  <TableHead className="w-[30px]" />
                  <SortableHead field="dependant" className="w-[200px]">Demandeur</SortableHead>
                  <TableHead className="w-[180px]">Livrables</TableHead>
                  <SortableHead field="type" className="w-[100px]">Type</SortableHead>
                  <SortableHead field="criticite" className="w-[90px]">Criticité</SortableHead>
                  <SortableHead field="statut" className="w-[80px]">Statut</SortableHead>
                  <SortableHead field="echeance" className="w-[100px]">Échéance</SortableHead>
                  <SortableHead field="responsable" className="w-[100px]">Responsable</SortableHead>
                  {canWrite && <TableHead className="w-[70px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 12 : 11} className="text-center py-8 text-muted-foreground">
                      Aucune adhérence trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((a) => (
                    <TableRow
                      key={a.id}
                      className={isDeleted(a) ? "bg-muted/40 opacity-80" : undefined}
                    >
                      <TableCell className="font-mono text-xs font-medium">
                        <span>{a.code}</span>
                        {isDeleted(a) ? (
                          <p
                            className="mt-0.5 text-[10px] font-normal text-destructive"
                            title={a.deleteMotif || undefined}
                          >
                            Supprimée
                            {a.deletedAt
                              ? ` le ${format(new Date(a.deletedAt), "dd/MM/yyyy", { locale: fr })}`
                              : ""}
                            {a.deletedByName ? ` par ${a.deletedByName}` : ""}
                            {a.deleteMotif ? ` — ${a.deleteMotif}` : ""}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Link href={`/chantiers/${a.chantierSource.id}`} className="hover:underline">
                          <span className="text-xs font-medium">{a.chantierSource.code}</span>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {a.chantierSource.nom}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="size-3 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const deps = chantiersFromDependants(a.dependants);
                          if (!deps.length) {
                            return (
                              <span className="text-xs text-muted-foreground italic">
                                {a.chantierDependantLabel || "Transverse"}
                              </span>
                            );
                          }
                          return (
                            <div className="flex flex-col gap-1">
                              {deps.map((d) => (
                                <Link
                                  key={d.id}
                                  href={`/chantiers/${d.id}`}
                                  className="hover:underline"
                                >
                                  <span className="text-xs font-medium">{d.code}</span>
                                  <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                                    {d.nom}
                                  </p>
                                </Link>
                              ))}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {a.livrables?.trim() ? (
                          <p
                            className="max-w-[180px] truncate text-xs text-muted-foreground"
                            title={a.livrables}
                          >
                            {a.livrables.replace(/\s+/g, " ")}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: (ADHERENCE_TYPE_COLORS[a.type] ?? "#94a3b8") + "20",
                            color: ADHERENCE_TYPE_COLORS[a.type] ?? "#94a3b8",
                          }}
                        >
                          {a.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: (ADHERENCE_CRITICITE_COLORS[a.criticite] ?? "#94a3b8") + "20",
                            color: ADHERENCE_CRITICITE_COLORS[a.criticite] ?? "#94a3b8",
                          }}
                        >
                          {a.criticite === "BLOQUANTE" && <AlertTriangle className="size-3 mr-0.5" />}
                          {a.criticite}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: (ADHERENCE_STATUT_COLORS[a.statut] ?? "#94a3b8") + "20",
                            color: ADHERENCE_STATUT_COLORS[a.statut] ?? "#94a3b8",
                          }}
                        >
                          {a.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.date_resolution_prevue
                          ? format(new Date(a.date_resolution_prevue), "dd MMM yyyy", { locale: fr })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{a.responsable}</TableCell>
                      {canWrite && (
                      <TableCell>
                        {canMutateAdherence(a) ? (
                        <div className="flex gap-1">
                          {isDeleted(a) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Restaurer"
                              onClick={() => setRestoreId(a.id)}
                            >
                              <RotateCcw className="size-3" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  setEditItem(a);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                title="Supprimer"
                                onClick={() => setDeleteId(a.id)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </>
                          )}
                        </div>
                        ) : null}
                      </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
      )}

      <AdherenceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        adherence={editItem}
        chantiers={chantiers}
        chantiersDependant={chantiersDependant ?? chantiers}
        allowTransverse={allowTransverse}
        nextCode={nextCode}
      />
      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        requireMotif
        title="Supprimer l'adhérence"
        description="L'adhérence ne sera plus visible dans le registre actif, le graphe et les fiches chantier. Vous pourrez la retrouver via le filtre « Supprimées » et la restaurer."
        motifLabel="Motif de la suppression"
        onConfirm={confirmDelete}
      />
      <DeleteConfirmDialog
        open={!!restoreId}
        onOpenChange={(open) => !open && setRestoreId(null)}
        requireMotif
        title="Restaurer l'adhérence"
        description="L'adhérence redeviendra active (registre, graphe, fiches chantier)."
        motifLabel="Commentaire de restauration"
        motifPlaceholder="Expliquez pourquoi cette adhérence est restaurée…"
        confirmLabel="Restaurer"
        confirmVariant="default"
        onConfirm={confirmRestore}
      />
    </div>
  );
}
