"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Calendar, Search, Clock, ShieldAlert, Columns3, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RaidFormDialog } from "./raid-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { CalendarView, type CalendarEvent } from "./calendar-view";
import { ActionKanban } from "./action-kanban";
import { RaidExcelExportButton } from "./raid-excel-export-button";
import { deleteRaid, fetchRaidFormEditContext } from "@/app/(app)/actions";
import { scoreCriticite } from "@/lib/utils-pmo";
import { useCanWritePage, useUser } from "@/components/user-provider";
import {
  RAID_TYPE_COLORS,
  RAID_TYPE_LABELS,
  getStatutColor,
  getCriticiteLabel,
  CRITICITE_COLORS,
  PROBABILITE_LABELS,
  IMPACT_LABELS,
  STATUT_ACTION_ORDER,
  getStatutsForType,
  getStatutsFromConfig,
  getStatutColorFromConfig,
  getStatutOrderFromConfig,
  getLabelsForKind,
  mergeFieldLabelsWithData,
  canEditRaidFormClient,
  isRaidAssignee,
  isRaidOverdue,
  isRaidInitialEcheancePast,
  raidEffectiveEcheance,
  type StatusConfigItem,
  type RaidFieldOptionItem,
} from "@/lib/raid-labels";
import { INSTANCE_LABELS } from "@/lib/comite-labels";

type RaidFormEditCtx = {
  chantierScopeAll: boolean;
  leadershipChantierIds: string[];
  ressourceId: string | null;
};

/** Mon RAID = assigned to me; all = équipes & chantiers (full list scope). */
type RaidScope = "mine" | "all";

interface RaidRow {
  id: string;
  code?: string | null;
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  chantierId: string | null;
  chantier?: { id: string; code: string; nom: string } | null;
  domaine: string;
  probabilite: number | null;
  impact: number | null;
  strategie: string;
  mitigation: string;
  responsable: string;
  responsableRessourceId: string | null;
  statut: string;
  date_identification: Date | null;
  date_revision: Date | null;
  date_echeance: Date | null;
  date_echeance_actualisee?: Date | null;
  date_fin_reelle?: Date | null;
  commentaires: string;
  comiteId: string | null;
  comite?: { id: string; instance: string; numero: number; date?: Date | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

type ChantierFilterOption = { id: string; code: string; nom: string };
type ComiteFilterOption = {
  id: string;
  instance: string;
  numero: number;
  date?: Date | string | null;
};

const EMPTY_ROWS: RaidRow[] = [];
const EMPTY_CHANTIERS: ChantierFilterOption[] = [];
const EMPTY_COMITES: ComiteFilterOption[] = [];

function comiteSelectLabel(co: { instance: string; numero: number }) {
  return `${INSTANCE_LABELS[co.instance] ?? co.instance} #${co.numero}`;
}

function comiteSelectDate(d: Date | string | null | undefined) {
  if (d == null || d === "") return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "dd MMM yyyy", { locale: fr });
}

interface Props {
  items: RaidRow[];
  filterType?: string;
  initialProbabilite?: number;
  initialImpact?: number;
  initialStatut?: string;
  initialOverdue?: boolean;
  initialCritical?: boolean;
  /** Default "mine". Pass "all" for KPI / portfolio views (Équipes & Chantiers). */
  initialRaidScope?: RaidScope;
  statusConfigs?: StatusConfigItem[];
  fieldOptions?: RaidFieldOptionItem[];
  /** Chantiers already scoped to the user's access (all vs assigned). */
  chantiers?: ChantierFilterOption[];
  /** Same catalog as the RAID create form (`getComitesForSelect`). */
  comites?: ComiteFilterOption[];
}

type SortField = "intitule" | "statut" | "categorie" | "responsable" | "date_identification" | "date_echeance" | "criticite";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
  title,
}: {
  label: string;
  field: SortField;
  current: SortField | null;
  dir: SortDir;
  onSort: (f: SortField) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      className="inline-flex max-w-full items-center gap-0.5 rounded px-0.5 py-0.5 text-left text-xs font-medium hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="truncate">{label}</span>
      {current === field ? (
        dir === "asc" ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />
      ) : (
        <ArrowUpDown className="size-3 shrink-0 opacity-40" />
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

function RaidTable({
  items,
  showType,
  onEdit,
  onDelete,
  initialProbabilite,
  initialImpact,
  initialStatut,
  initialOverdue,
  initialCritical,
  statusConfigs,
  fieldOptions,
  formEditCtx,
  chantiers = EMPTY_CHANTIERS,
  comites = EMPTY_COMITES,
  onFilteredChange,
}: {
  items: RaidRow[];
  showType: boolean;
  onEdit: (r: RaidRow) => void;
  onDelete: (id: string) => void;
  initialProbabilite?: number;
  initialImpact?: number;
  initialStatut?: string;
  initialOverdue?: boolean;
  initialCritical?: boolean;
  statusConfigs?: StatusConfigItem[];
  fieldOptions?: RaidFieldOptionItem[];
  formEditCtx: RaidFormEditCtx | null;
  chantiers?: ChantierFilterOption[];
  comites?: ComiteFilterOption[];
  onFilteredChange?: (rows: RaidRow[]) => void;
}) {
  const router = useRouter();
  const canWriteRaid = useCanWritePage("/raid");
  const { ressourceId } = useUser();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [filterCategorie, setFilterCategorie] = useState<string[]>([]);
  const [filterDomaine, setFilterDomaine] = useState<string[]>([]);
  const [filterProb, setFilterProb] = useState<string[]>(
    initialProbabilite ? [String(initialProbabilite)] : []
  );
  const [filterImpact, setFilterImpact] = useState<string[]>(
    initialImpact ? [String(initialImpact)] : []
  );
  const [filterStatut, setFilterStatut] = useState<string[]>(
    initialStatut === "active"
      ? ["__active__"]
      : initialStatut === "open"
        ? ["__open__"]
        : initialStatut
          ? [initialStatut]
          : []
  );
  const [filterOverdue, setFilterOverdue] = useState(initialOverdue ?? false);
  const [filterCritical, setFilterCritical] = useState(initialCritical ?? false);
  const [filterChantier, setFilterChantier] = useState<string[]>([]);
  const [filterComite, setFilterComite] = useState<string[]>([]);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Stable "now" to avoid SSR/client hydration mismatch from new Date() in render
  const [now] = useState(() => new Date());

  const isRisqueView = items.length > 0 && items.every((i) => i.type === "Risque");
  const isActionView = items.length > 0 && items.every((i) => i.type === "Action");

  const categorieFilterOptions = useMemo(
    () =>
      mergeFieldLabelsWithData(
        getLabelsForKind("categorie", fieldOptions),
        items.map((i) => i.categorie)
      ),
    [fieldOptions, items]
  );
  const domaineFilterOptions = useMemo(
    () =>
      mergeFieldLabelsWithData(
        getLabelsForKind("domaine", fieldOptions),
        items.map((i) => i.domaine)
      ),
    [fieldOptions, items]
  );

  const chantierFilterOptions = useMemo(() => {
    const source =
      chantiers.length > 0
        ? chantiers
        : (() => {
            const map = new Map<string, ChantierFilterOption>();
            for (const r of items) {
              if (r.chantier?.id) {
                map.set(r.chantier.id, {
                  id: r.chantier.id,
                  code: r.chantier.code,
                  nom: r.chantier.nom,
                });
              }
            }
            return [...map.values()];
          })();
    return [...source].sort((a, b) => a.code.localeCompare(b.code, "fr"));
  }, [chantiers, items]);

  const accessibleChantierIds = useMemo(
    () => new Set(chantierFilterOptions.map((c) => c.id)),
    [chantierFilterOptions]
  );

  const comiteFilterOptions = useMemo(() => {
    const source =
      comites.length > 0
        ? comites
        : (() => {
            const map = new Map<string, ComiteFilterOption>();
            for (const r of items) {
              if (r.comite?.id) {
                map.set(r.comite.id, {
                  id: r.comite.id,
                  instance: r.comite.instance,
                  numero: r.comite.numero,
                  date: r.comite.date,
                });
              }
            }
            return [...map.values()];
          })();
    return [...source].sort((a, b) => {
      const inst = (INSTANCE_LABELS[a.instance] ?? a.instance).localeCompare(
        INSTANCE_LABELS[b.instance] ?? b.instance,
        "fr"
      );
      if (inst !== 0) return inst;
      return b.numero - a.numero;
    });
  }, [comites, items]);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const comiteLabel = r.comite ? comiteSelectLabel(r.comite) : "";
        const textMatch =
          r.intitule.toLowerCase().includes(q) ||
          r.responsable.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.code ?? "").toLowerCase().includes(q) ||
          (r.categorie ?? "").toLowerCase().includes(q) ||
          (r.domaine ?? "").toLowerCase().includes(q) ||
          comiteLabel.toLowerCase().includes(q) ||
          (r.comite?.instance ?? "").toLowerCase().includes(q);
        const chantierAccessible =
          !!r.chantier?.id && accessibleChantierIds.has(r.chantier.id);
        const chantierMatch =
          chantierAccessible &&
          ((r.chantier?.code ?? "").toLowerCase().includes(q) ||
            (r.chantier?.nom ?? "").toLowerCase().includes(q));
        return textMatch || chantierMatch;
      });
    }
    if (filterCategorie.length > 0) {
      result = result.filter((r) => filterCategorie.includes(r.categorie));
    }
    if (filterDomaine.length > 0) {
      result = result.filter((r) => filterDomaine.includes(r.domaine));
    }
    if (filterProb.length > 0) {
      result = result.filter(
        (r) => r.probabilite != null && filterProb.includes(String(r.probabilite))
      );
    }
    if (filterImpact.length > 0) {
      result = result.filter(
        (r) => r.impact != null && filterImpact.includes(String(r.impact))
      );
    }
    if (filterStatut.length > 0) {
      result = result.filter((r) =>
        filterStatut.some((s) => {
          if (s === "__active__") return r.statut !== "Clôturé" && r.statut !== "Abandonné";
          if (s === "__open__") return r.statut !== "Clos";
          return r.statut === s;
        })
      );
    }
    if (filterChantier.length > 0) {
      result = result.filter(
        (r) =>
          !!r.chantierId &&
          accessibleChantierIds.has(r.chantierId) &&
          filterChantier.includes(r.chantierId)
      );
    }
    if (filterComite.length > 0) {
      result = result.filter((r) =>
        filterComite.some((id) =>
          id === "__none__" ? !r.comiteId : r.comiteId === id
        )
      );
    }
    // Overdue filter (échéance actualisée, fallback initiale)
    if (filterOverdue) {
      result = result.filter((r) =>
        isRaidOverdue(
          r.statut,
          r.date_echeance_actualisee,
          r.date_echeance,
          now
        )
      );
    }
    // Critical filter (risks with score >= 12)
    if (filterCritical) {
      result = result.filter(
        (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
      );
    }
    return result;
  }, [items, search, filterCategorie, filterDomaine, filterProb, filterImpact, filterStatut, filterChantier, filterComite, filterOverdue, filterCritical, now, accessibleChantierIds]);

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "intitule": cmp = a.intitule.localeCompare(b.intitule); break;
        case "statut": {
          const orderMap = statusConfigs?.length ? getStatutOrderFromConfig(itemType, statusConfigs) : STATUT_ACTION_ORDER;
          const oa = orderMap[a.statut] ?? 99;
          const ob = orderMap[b.statut] ?? 99;
          cmp = oa - ob;
          break;
        }
        case "categorie": cmp = a.categorie.localeCompare(b.categorie); break;
        case "responsable": cmp = a.responsable.localeCompare(b.responsable); break;
        case "date_identification": {
          const da = a.date_identification ? new Date(a.date_identification).getTime() : 0;
          const db = b.date_identification ? new Date(b.date_identification).getTime() : 0;
          cmp = da - db;
          break;
        }
        case "date_echeance": {
          const ea = raidEffectiveEcheance(
            a.date_echeance_actualisee,
            a.date_echeance
          );
          const eb = raidEffectiveEcheance(
            b.date_echeance_actualisee,
            b.date_echeance
          );
          const da = ea ? ea.getTime() : 0;
          const db = eb ? eb.getTime() : 0;
          cmp = da - db;
          break;
        }
        case "criticite": {
          const sa = a.probabilite && a.impact ? scoreCriticite(a.impact, a.probabilite) : 0;
          const sb = b.probabilite && b.impact ? scoreCriticite(b.impact, b.probabilite) : 0;
          cmp = sa - sb;
          break;
        }
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filtered, sortField, sortDir]);

  const onFilteredChangeRef = useRef(onFilteredChange);
  onFilteredChangeRef.current = onFilteredChange;
  useEffect(() => {
    onFilteredChangeRef.current?.(sorted);
  }, [sorted]);

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(sorted.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated = pageSize === 0
    ? sorted
    : sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategorie, filterDomaine, filterProb, filterImpact, filterStatut, filterChantier, filterComite, filterOverdue, filterCritical]);

  const itemType = items.length > 0 ? items[0].type : "Action";
  const statutList = statusConfigs?.length
    ? getStatutsFromConfig(itemType, statusConfigs)
    : getStatutsForType(itemType);
  const statutOptions = [
    ...(isActionView
      ? [{ value: "__active__", label: "Actives (non clôturées)" }]
      : []),
    ...(isRisqueView
      ? [{ value: "__open__", label: "Ouverts (non clos)" }]
      : []),
    ...statutList.map((s) => ({ value: s, label: s })),
  ];
  const hasActiveFilters =
    filterCategorie.length > 0 ||
    filterDomaine.length > 0 ||
    filterProb.length > 0 ||
    filterImpact.length > 0 ||
    filterStatut.length > 0 ||
    filterChantier.length > 0 ||
    filterComite.length > 0 ||
    filterOverdue ||
    filterCritical;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (code, intitulé, chantier, comité…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {chantierFilterOptions.length > 0 && (
            <MultiSelect
              options={chantierFilterOptions.map((c) => ({
                value: c.id,
                label: c.nom ? `${c.code} — ${c.nom}` : c.code,
              }))}
              selected={filterChantier}
              onChange={setFilterChantier}
              placeholder="Chantier"
              className="w-1/2 min-w-0"
              chips={false}
              truncate
            />
          )}
        </div>
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          options={categorieFilterOptions.map((c) => ({ value: c, label: c }))}
          selected={filterCategorie}
          onChange={setFilterCategorie}
          placeholder="Catégorie"
          className="w-[180px]"
          chips={false}
        />
        <MultiSelect
          options={domaineFilterOptions.map((d) => ({ value: d, label: d }))}
          selected={filterDomaine}
          onChange={setFilterDomaine}
          placeholder="Domaine"
          className="w-[200px]"
          chips={false}
        />
        <MultiSelect
          options={statutOptions}
          selected={filterStatut}
          onChange={setFilterStatut}
          placeholder="Statut"
          className="w-[200px]"
          chips={false}
        />
        <MultiSelect
          options={[
            { value: "__none__", label: "Aucun" },
            ...comiteFilterOptions.map((co) => ({
              value: co.id,
              label: comiteSelectLabel(co),
              description: comiteSelectDate(co.date) || undefined,
            })),
          ]}
          selected={filterComite}
          onChange={setFilterComite}
          placeholder="Comité"
          className="w-[18rem] min-w-0"
          chips={false}
          truncate
        />
        {isActionView && (
          <Button
            variant={filterOverdue ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterOverdue((v) => !v)}
            className="h-9 text-xs gap-1"
          >
            <Clock className="size-3.5" />
            Échues
          </Button>
        )}
        {isRisqueView && (
          <>
            <Button
              variant={filterCritical ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCritical((v) => !v)}
              className="h-9 text-xs gap-1"
            >
              <ShieldAlert className="size-3.5" />
              Critiques
            </Button>
            <MultiSelect
              options={Object.entries(PROBABILITE_LABELS).map(([k, label]) => ({
                value: k,
                label: `${k} - ${label}`,
              }))}
              selected={filterProb}
              onChange={setFilterProb}
              placeholder="Probabilité"
              className="w-[180px]"
              chips={false}
            />
            <MultiSelect
              options={Object.entries(IMPACT_LABELS).map(([k, label]) => ({
                value: k,
                label: `${k} - ${label}`,
              }))}
              selected={filterImpact}
              onChange={setFilterImpact}
              placeholder="Impact"
              className="w-[160px]"
              chips={false}
            />
          </>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setFilterCategorie([]);
              setFilterDomaine([]);
              setFilterProb([]);
              setFilterImpact([]);
              setFilterStatut([]);
              setFilterChantier([]);
              setFilterComite([]);
              setFilterOverdue(false);
              setFilterCritical(false);
            }}
          >
            Effacer filtres
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Afficher</label>
          <Select
            value={pageSize === 0 ? "all" : String(pageSize)}
            onValueChange={(v) => {
              setPageSize(v === "all" ? 0 : Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 20, 30].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucun élément trouvé
        </p>
      ) : (
        <>
        <Table className="table-fixed w-full min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[4.5rem]">Code</TableHead>
              {showType && <TableHead className="w-[5.5rem]">Type</TableHead>}
              <TableHead className={isActionView || isRisqueView ? "w-[28%]" : "w-[32%]"}>
                <SortHeader label="Intitulé" field="intitule" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="w-[9%]">
                <SortHeader label="Catégorie" field="categorie" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="w-[4.5rem]">Chantier</TableHead>
              <TableHead className="w-[12%]">
                <SortHeader label="Responsable" field="responsable" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              {isRisqueView && (
                <TableHead className="w-[6.5rem]">
                  <SortHeader label="Criticité" field="criticite" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
              )}
              <TableHead className="w-[7rem]">
                <SortHeader label="Statut" field="statut" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead className="w-[5.25rem]">
                <SortHeader
                  label="Identification"
                  title="Date d'identification"
                  field="date_identification"
                  current={sortField}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              {isActionView && (
                <TableHead className="w-[5.25rem]">
                  <SortHeader
                    label="Échéance"
                    title="Échéance actualisée"
                    field="date_echeance"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
              )}
              <TableHead className="w-[5.5rem] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((r) => {
              const score = r.probabilite && r.impact ? scoreCriticite(r.impact, r.probabilite) : null;
              const critLabel = score ? getCriticiteLabel(score) : null;

              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/raid/${r.id}`)}
                >
                  <TableCell className="max-w-0 truncate p-1.5 text-[11px] font-mono font-semibold text-[#0A3C74] dark:text-foreground" title={r.code || undefined}>
                    {r.code || "—"}
                  </TableCell>
                  {showType && (
                    <TableCell className="p-1.5">
                      <Badge
                        className="max-w-full truncate text-[10px]"
                        style={{ backgroundColor: RAID_TYPE_COLORS[r.type] ?? "#6b7280", color: "white" }}
                      >
                        {RAID_TYPE_LABELS[r.type] ?? r.type}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="max-w-0 p-1.5 text-sm">
                    <div className="truncate font-medium text-primary hover:underline" title={r.intitule}>
                      {r.intitule}
                    </div>
                    {r.domaine && (
                      <div className="truncate text-[10px] text-muted-foreground" title={r.domaine}>{r.domaine}</div>
                    )}
                    {isRaidInitialEcheancePast(
                      r.statut,
                      r.date_echeance,
                      now
                    ) &&
                      r.date_echeance && (
                        <div
                          className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                          title={`Échéance initiale dépassée : ${format(new Date(r.date_echeance), "dd/MM/yyyy")}`}
                        >
                          <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                          <span className="truncate">
                            Échéance initiale{" "}
                            {format(new Date(r.date_echeance), "dd/MM/yy")}{" "}
                            · dépassée
                          </span>
                        </div>
                      )}
                  </TableCell>
                  <TableCell className="max-w-0 truncate p-1.5 text-xs" title={r.categorie || undefined}>
                    {r.categorie || "—"}
                  </TableCell>
                  <TableCell className="max-w-0 truncate p-1.5 text-xs font-medium" title={r.chantier ? `${r.chantier.code} — ${r.chantier.nom}` : undefined}>
                    {r.chantier ? r.chantier.code : "—"}
                  </TableCell>
                  <TableCell className="max-w-0 truncate p-1.5 text-xs" title={r.responsable || undefined}>
                    {r.responsable || "—"}
                  </TableCell>
                  {isRisqueView && (
                    <TableCell className="p-1.5">
                      {score ? (
                        <Badge
                          className="text-[10px]"
                          style={{ backgroundColor: CRITICITE_COLORS[critLabel!] ?? "#6b7280", color: "white" }}
                          title={`${score}/25 ${critLabel}`}
                        >
                          {score}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                  )}
                  <TableCell className="p-1.5">
                    <Badge
                      className="max-w-full truncate text-[10px]"
                      style={{ backgroundColor: statusConfigs?.length ? getStatutColorFromConfig(r.type, r.statut, statusConfigs) : getStatutColor(r.type, r.statut), color: "white" }}
                      title={r.statut || undefined}
                    >
                      {r.statut || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-1.5 text-xs tabular-nums text-muted-foreground">
                    {r.date_identification
                      ? format(new Date(r.date_identification), "dd/MM/yy")
                      : "—"}
                  </TableCell>
                  {isActionView && (
                    <TableCell className="p-1.5 text-xs tabular-nums">
                      {(() => {
                        const ech = raidEffectiveEcheance(
                          r.date_echeance_actualisee,
                          r.date_echeance
                        );
                        if (!ech) return "—";
                        const overdue = isRaidOverdue(
                          r.statut,
                          r.date_echeance_actualisee,
                          r.date_echeance,
                          now
                        );
                        const initiale = r.date_echeance
                          ? format(new Date(r.date_echeance), "dd/MM/yy")
                          : null;
                        return (
                          <span
                            className={
                              overdue ? "text-destructive font-medium" : ""
                            }
                            title={
                              initiale
                                ? `Initiale : ${initiale} · Actualisée (pilotage)`
                                : "Échéance actualisée"
                            }
                          >
                            {format(ech, "dd/MM/yy")}
                          </span>
                        );
                      })()}
                    </TableCell>
                  )}
                  <TableCell className="p-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Ouvrir"
                        onClick={() => router.push(`/raid/${r.id}`)}
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                      {formEditCtx &&
                        canEditRaidFormClient(r, formEditCtx) &&
                        (canWriteRaid ||
                          isRaidAssignee(ressourceId, r.responsableRessourceId)) && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Modifier (formulaire)"
                            onClick={() => onEdit(r)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                      {formEditCtx?.chantierScopeAll && canWriteRaid && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          title="Supprimer"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {pageSize > 0 && totalPages > 1 && (
          <PaginationControls
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={sorted.length}
            pageSize={pageSize}
          />
        )}
        </>
      )}
    </div>
  );
}

function isRaidAssignedToMe(
  r: RaidRow,
  ressourceId: string | null,
  displayName: string
): boolean {
  if (ressourceId && r.responsableRessourceId === ressourceId) return true;
  if (!ressourceId && displayName.trim()) {
    const name = displayName.trim().toLowerCase();
    const resp = (r.responsable || "").trim().toLowerCase();
    if (resp && (resp === name || resp.includes(name) || name.includes(resp))) {
      return true;
    }
  }
  return false;
}

function RaidScopeToggles({
  scope,
  onChange,
  mineCount,
  allCount,
}: {
  scope: RaidScope;
  onChange: (s: RaidScope) => void;
  mineCount: number;
  allCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-3">
      <button
        type="button"
        onClick={() => onChange("mine")}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
          scope === "mine"
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-primary/25 bg-background text-primary/80 hover:border-primary/50 hover:bg-primary/5"
        }`}
      >
        Mon RAID
        <span
          className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
            scope === "mine"
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-primary/10 text-primary"
          }`}
        >
          {mineCount}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
          scope === "all"
            ? "border-[#00BDBB] bg-[#00BDBB] text-white shadow-md shadow-[#00BDBB]/25"
            : "border-[#00BDBB] bg-[#00BDBB]/15 text-[#0A3C74] ring-1 ring-[#00BDBB]/30 hover:bg-[#00BDBB]/25 hover:shadow-sm dark:text-[#5ad4d2]"
        }`}
      >
        RAID Équipes &amp; Chantiers
        <span
          className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
            scope === "all"
              ? "bg-white/25 text-white"
              : "bg-[#00BDBB] text-white"
          }`}
        >
          {allCount}
        </span>
      </button>
    </div>
  );
}

export function RaidList({ items, filterType, initialProbabilite, initialImpact, initialStatut, initialOverdue, initialCritical, initialRaidScope = "mine", statusConfigs, fieldOptions, chantiers = [], comites = [] }: Props) {
  const { ressourceId, displayName } = useUser();
  const canWriteRaid = useCanWritePage("/raid");
  const filteredIdsRef = useRef<Record<string, string[]>>({});
  const [raidScope, setRaidScope] = useState<RaidScope>(
    initialRaidScope === "all" ? "all" : "mine"
  );
  const [editItem, setEditItem] = useState<RaidRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formEditCtx, setFormEditCtx] = useState<RaidFormEditCtx | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRaidFormEditContext()
      .then((ctx) => {
        if (!cancelled) {
          setFormEditCtx({
            ...ctx,
            ressourceId: ressourceId ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFormEditCtx({
            chantierScopeAll: false,
            leadershipChantierIds: [],
            ressourceId: ressourceId ?? null,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ressourceId]);

  const mineCount = useMemo(
    () =>
      items.filter((r) => isRaidAssignedToMe(r, ressourceId, displayName)).length,
    [items, ressourceId, displayName]
  );

  const scopedItems = useMemo(() => {
    if (raidScope === "all") return items;
    return items.filter((r) => isRaidAssignedToMe(r, ressourceId, displayName));
  }, [items, raidScope, ressourceId, displayName]);

  // Group by type
  const grouped = useMemo(() => {
    const map = new Map<string, RaidRow[]>();
    for (const r of scopedItems) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return map;
  }, [scopedItems]);

  // Calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return scopedItems
      .filter(
        (r) =>
          r.date_echeance_actualisee ||
          r.date_echeance ||
          r.date_revision ||
          r.date_identification
      )
      .map((r) => {
        const ech = raidEffectiveEcheance(
          r.date_echeance_actualisee,
          r.date_echeance
        );
        return {
          id: r.id,
          date: new Date(
            (ech ?? r.date_revision ?? r.date_identification)!
          ),
          label: r.intitule,
          color: RAID_TYPE_COLORS[r.type] ?? "#6b7280",
          type: r.type,
          details: {
            Type: RAID_TYPE_LABELS[r.type] ?? r.type,
            Statut: r.statut || "",
            Catégorie: r.categorie || "",
            Domaine: r.domaine || "",
            Responsable: r.responsable || "",
            Chantier: r.chantier
              ? `${r.chantier.code} - ${r.chantier.nom}`
              : "",
            "Échéance act.": ech
              ? format(ech, "dd MMM yyyy", { locale: fr })
              : "",
            "Échéance init.": r.date_echeance
              ? format(new Date(r.date_echeance), "dd MMM yyyy", { locale: fr })
              : "",
          },
        };
      });
  }, [scopedItems]);

  const typeOrder = ["Action", "Risque", "Information", "Décision"] as const;

  const scopeBar = (
    <RaidScopeToggles
      scope={raidScope}
      onChange={setRaidScope}
      mineCount={mineCount}
      allCount={items.length}
    />
  );

  // If filtered to a single type, show table directly (no type tabs)
  if (filterType) {
    const typeItems = grouped.get(filterType) ?? EMPTY_ROWS;
    const typeCalendar = calendarEvents.filter((e) => e.type === filterType);
    return (
      <>
        <div className="mb-4">{scopeBar}</div>
        <Tabs defaultValue="table" className="space-y-4" key={`scope-${raidScope}-${filterType}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="table" className="gap-2">
              Tableau
              <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                {typeItems.length}
              </span>
            </TabsTrigger>
            {filterType === "Action" && (
              <TabsTrigger value="kanban" className="gap-2">
                <Columns3 className="size-4" />
                Kanban
              </TabsTrigger>
            )}
            <TabsTrigger value="calendrier" className="gap-2">
              <Calendar className="size-4 text-primary" />
              Calendrier
            </TabsTrigger>
          </TabsList>
          <RaidExcelExportButton
            allIds={scopedItems.map((r) => r.id)}
            getSelectedIds={() =>
              filteredIdsRef.current[filterType] ?? typeItems.map((r) => r.id)
            }
          />
          </div>
          <TabsContent value="table">
            <RaidTable
              items={typeItems}
              showType={false}
              onEdit={setEditItem}
              onDelete={(id) => { setDeleteError(null); setDeleteId(id); }}
              initialProbabilite={initialProbabilite}
              initialImpact={initialImpact}
              initialStatut={initialStatut}
              initialOverdue={initialOverdue}
              initialCritical={initialCritical}
              statusConfigs={statusConfigs}
              fieldOptions={fieldOptions}
              formEditCtx={formEditCtx}
              chantiers={chantiers}
              comites={comites}
              onFilteredChange={(rows) => {
                filteredIdsRef.current[filterType] = rows.map((r) => r.id);
              }}
            />
          </TabsContent>
          {filterType === "Action" && (
            <TabsContent value="kanban">
              <ActionKanban items={typeItems} statusConfigs={statusConfigs} />
            </TabsContent>
          )}
          <TabsContent value="calendrier">
            <CalendarView events={typeCalendar} />
          </TabsContent>
        </Tabs>

        {editItem &&
          formEditCtx &&
          canEditRaidFormClient(editItem, formEditCtx) &&
          (canWriteRaid ||
            isRaidAssignee(ressourceId, editItem.responsableRessourceId)) && (
          <RaidFormDialog
            open={!!editItem}
            onOpenChange={(open) => !open && setEditItem(null)}
            raid={editItem}
            statusConfigs={statusConfigs}
            fieldOptions={fieldOptions}
          />
        )}
        <DeleteConfirmDialog
          open={!!deleteId && !!formEditCtx?.chantierScopeAll && canWriteRaid}
          onOpenChange={(open) => !open && setDeleteId(null)}
          requireMotif
          onConfirm={async (motif) => {
            try {
              if (deleteId) await deleteRaid(deleteId, { motif });
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : "Erreur de suppression");
              throw err;
            }
          }}
          title="Supprimer l'élément"
        />
        {deleteError && <p className="text-xs text-destructive mt-2">{deleteError}</p>}
      </>
    );
  }

  // Full RAID view with tabs per type
  const firstType = typeOrder.find((t) => grouped.has(t)) ?? "Action";

  return (
    <>
      <div className="mb-4">{scopeBar}</div>
      <Tabs
        defaultValue={firstType}
        className="space-y-4"
        key={`scope-${raidScope}-all`}
      >
        <TabsList className="h-auto p-1 gap-1 flex-wrap">
          {typeOrder.map((t) => {
            const count = grouped.get(t)?.length ?? 0;
            return (
              <TabsTrigger key={t} value={t} className="gap-2 px-3 py-1.5">
                <span
                  className="inline-block size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: RAID_TYPE_COLORS[t] }}
                />
                <span className="text-xs">{RAID_TYPE_LABELS[t]}</span>
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="calendrier" className="gap-2 px-3 py-1.5">
            <Calendar className="size-4 text-primary" />
            <span className="text-xs">Calendrier</span>
          </TabsTrigger>
        </TabsList>

        {typeOrder.map((t) => {
          const tItems = grouped.get(t) ?? EMPTY_ROWS;
          return (
            <TabsContent key={t} value={t}>
              <Tabs defaultValue="table" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="table" className="gap-2">
                    Tableau
                    <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                      {tItems.length}
                    </span>
                  </TabsTrigger>
                  {t === "Action" && (
                    <TabsTrigger value="kanban" className="gap-2">
                      <Columns3 className="size-4" />
                      Kanban
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="calendrier-type" className="gap-2">
                    <Calendar className="size-4 text-primary" />
                    Calendrier
                  </TabsTrigger>
                </TabsList>
                <RaidExcelExportButton
                  allIds={scopedItems.map((r) => r.id)}
                  getSelectedIds={() =>
                    filteredIdsRef.current[t] ?? tItems.map((r) => r.id)
                  }
                />
                </div>
                <TabsContent value="table">
                  <RaidTable
                    items={tItems}
                    showType={false}
                    onEdit={setEditItem}
                    onDelete={(id) => { setDeleteError(null); setDeleteId(id); }}
                    statusConfigs={statusConfigs}
                    fieldOptions={fieldOptions}
                    formEditCtx={formEditCtx}
                    chantiers={chantiers}
                    comites={comites}
                    onFilteredChange={(rows) => {
                      filteredIdsRef.current[t] = rows.map((r) => r.id);
                    }}
                  />
                </TabsContent>
                {t === "Action" && (
                  <TabsContent value="kanban">
                    <ActionKanban items={tItems} statusConfigs={statusConfigs} />
                  </TabsContent>
                )}
                <TabsContent value="calendrier-type">
                  <CalendarView events={calendarEvents.filter((e) => e.type === t)} />
                </TabsContent>
              </Tabs>
            </TabsContent>
          );
        })}

        <TabsContent value="calendrier">
          <CalendarView events={calendarEvents} />
        </TabsContent>
      </Tabs>

      {editItem &&
        formEditCtx &&
        canEditRaidFormClient(editItem, formEditCtx) &&
        (canWriteRaid ||
          isRaidAssignee(ressourceId, editItem.responsableRessourceId)) && (
        <RaidFormDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          raid={editItem}
          statusConfigs={statusConfigs}
          fieldOptions={fieldOptions}
        />
      )}
      <DeleteConfirmDialog
        open={!!deleteId && !!formEditCtx?.chantierScopeAll && canWriteRaid}
        onOpenChange={(open) => !open && setDeleteId(null)}
        requireMotif
        onConfirm={async (motif) => {
          try {
            if (deleteId) await deleteRaid(deleteId, { motif });
          } catch (err) {
            setDeleteError(err instanceof Error ? err.message : "Erreur de suppression");
            throw err;
          }
        }}
        title="Supprimer l'élément"
      />
      {deleteError && <p className="text-xs text-destructive mt-2">{deleteError}</p>}
    </>
  );
}
