"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Calendar, Search, Clock, ShieldAlert, Columns3, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { deleteRaid, fetchRaidFormEditContext } from "@/app/(app)/actions";
import { scoreCriticite } from "@/lib/utils-pmo";
import { useUser } from "@/components/user-provider";
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
  type StatusConfigItem,
  type RaidFieldOptionItem,
} from "@/lib/raid-labels";

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
  commentaires: string;
  comiteId: string | null;
  comite?: { id: string; instance: string; numero: number } | null;
  createdAt: Date;
  updatedAt: Date;
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
}

type SortField = "intitule" | "statut" | "categorie" | "responsable" | "date_identification" | "date_echeance" | "criticite";
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
        dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
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
}) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("__all__");
  const [filterDomaine, setFilterDomaine] = useState("__all__");
  const [filterProb, setFilterProb] = useState(initialProbabilite ? String(initialProbabilite) : "__all__");
  const [filterImpact, setFilterImpact] = useState(initialImpact ? String(initialImpact) : "__all__");
  const [filterStatut, setFilterStatut] = useState(
    initialStatut === "active" ? "__active__"
      : initialStatut === "open" ? "__open__"
        : initialStatut || "__all__"
  );
  const [filterOverdue, setFilterOverdue] = useState(initialOverdue ?? false);
  const [filterCritical, setFilterCritical] = useState(initialCritical ?? false);

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

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.intitule.toLowerCase().includes(q) ||
          r.responsable.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.code ?? "").toLowerCase().includes(q) ||
          (r.categorie ?? "").toLowerCase().includes(q) ||
          (r.domaine ?? "").toLowerCase().includes(q)
      );
    }
    if (filterCategorie !== "__all__") {
      result = result.filter((r) => r.categorie === filterCategorie);
    }
    if (filterDomaine !== "__all__") {
      result = result.filter((r) => r.domaine === filterDomaine);
    }
    if (filterProb !== "__all__") {
      result = result.filter((r) => r.probabilite === Number(filterProb));
    }
    if (filterImpact !== "__all__") {
      result = result.filter((r) => r.impact === Number(filterImpact));
    }
    // Statut filter
    if (filterStatut === "__active__") {
      result = result.filter((r) => r.statut !== "Clôturé" && r.statut !== "Abandonné");
    } else if (filterStatut === "__open__") {
      result = result.filter((r) => r.statut !== "Clos");
    } else if (filterStatut !== "__all__") {
      result = result.filter((r) => r.statut === filterStatut);
    }
    // Overdue filter (actions with date_echeance in the past)
    if (filterOverdue) {
      result = result.filter(
        (r) => r.date_echeance && new Date(r.date_echeance) < now && !["Clôturé", "Abandonné"].includes(r.statut)
      );
    }
    // Critical filter (risks with score >= 12)
    if (filterCritical) {
      result = result.filter(
        (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
      );
    }
    return result;
  }, [items, search, filterCategorie, filterDomaine, filterProb, filterImpact, filterStatut, filterOverdue, filterCritical, now]);

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
          const da = a.date_echeance ? new Date(a.date_echeance).getTime() : 0;
          const db = b.date_echeance ? new Date(b.date_echeance).getTime() : 0;
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

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(sorted.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated = pageSize === 0
    ? sorted
    : sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page when filters change
  useMemo(() => { setCurrentPage(1); }, [search, filterCategorie, filterDomaine, filterProb, filterImpact, filterStatut, filterOverdue, filterCritical]);

  const itemType = items.length > 0 ? items[0].type : "Action";
  const statutList = statusConfigs?.length
    ? getStatutsFromConfig(itemType, statusConfigs)
    : getStatutsForType(itemType);
  const hasActiveFilters =
    filterProb !== "__all__" ||
    filterImpact !== "__all__" ||
    filterStatut !== "__all__" ||
    filterOverdue ||
    filterCritical;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (code, intitulé…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterCategorie} onValueChange={setFilterCategorie}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes catégories</SelectItem>
            {categorieFilterOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterDomaine} onValueChange={setFilterDomaine}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Domaine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous domaines</SelectItem>
            {domaineFilterOptions.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous statuts</SelectItem>
            {isActionView && <SelectItem value="__active__">Actives (non clôturées)</SelectItem>}
            {isRisqueView && <SelectItem value="__open__">Ouverts (non clos)</SelectItem>}
            {statutList.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isActionView && (
          <Button
            variant={filterOverdue ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterOverdue((v) => !v)}
            className="text-xs gap-1"
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
              className="text-xs gap-1"
            >
              <ShieldAlert className="size-3.5" />
              Critiques
            </Button>
            <Select value={filterProb} onValueChange={setFilterProb}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Probabilité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toute probabilité</SelectItem>
                {Object.entries(PROBABILITE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{k} - {label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterImpact} onValueChange={setFilterImpact}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Impact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tout impact</SelectItem>
                {Object.entries(IMPACT_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{k} - {label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterProb("__all__");
              setFilterImpact("__all__");
              setFilterStatut("__all__");
              setFilterOverdue(false);
              setFilterCritical(false);
            }}
            className="text-xs"
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
            <SelectTrigger className="w-20 h-8" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 15, 20, 30].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Aucun élément trouvé
        </p>
      ) : (
        <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[88px]">Code</TableHead>
              {showType && <TableHead className="w-[90px]">Type</TableHead>}
              <TableHead>
                <SortHeader label="Intitulé" field="intitule" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Catégorie" field="categorie" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>Chantier</TableHead>
              <TableHead>
                <SortHeader label="Responsable" field="responsable" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              {isRisqueView && (
                <TableHead>
                  <SortHeader label="Criticité" field="criticite" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
              )}
              <TableHead>
                <SortHeader label="Statut" field="statut" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortHeader label="Date" field="date_identification" current={sortField} dir={sortDir} onSort={handleSort} />
              </TableHead>
              {isActionView && (
                <TableHead>
                  <SortHeader label="Échéance" field="date_echeance" current={sortField} dir={sortDir} onSort={handleSort} />
                </TableHead>
              )}
              <TableHead className="w-[80px]">Actions</TableHead>
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
                  <TableCell className="text-xs font-mono font-semibold text-[#0A3C74] dark:text-foreground whitespace-nowrap">
                    {r.code || "—"}
                  </TableCell>
                  {showType && (
                    <TableCell>
                      <Badge
                        className="text-[10px]"
                        style={{ backgroundColor: RAID_TYPE_COLORS[r.type] ?? "#6b7280", color: "white" }}
                      >
                        {RAID_TYPE_LABELS[r.type] ?? r.type}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-sm max-w-[250px]">
                    <div className="truncate font-medium text-primary hover:underline">
                      {r.intitule}
                    </div>
                    {r.domaine && (
                      <div className="text-[10px] text-muted-foreground truncate">{r.domaine}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.categorie || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {r.chantier ? (
                      <span className="text-xs">{r.chantier.code}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.responsable || "—"}</TableCell>
                  {isRisqueView && (
                    <TableCell>
                      {score ? (
                        <Badge
                          className="text-[10px]"
                          style={{ backgroundColor: CRITICITE_COLORS[critLabel!] ?? "#6b7280", color: "white" }}
                        >
                          {score}/25 {critLabel}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      className="text-[10px]"
                      style={{ backgroundColor: statusConfigs?.length ? getStatutColorFromConfig(r.type, r.statut, statusConfigs) : getStatutColor(r.type, r.statut), color: "white" }}
                    >
                      {r.statut || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.date_identification
                      ? format(new Date(r.date_identification), "dd MMM yyyy", { locale: fr })
                      : "—"}
                  </TableCell>
                  {isActionView && (
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.date_echeance ? (
                        <span className={new Date(r.date_echeance) < now && !["Clôturé", "Abandonné"].includes(r.statut) ? "text-destructive font-medium" : ""}>
                          {format(new Date(r.date_echeance), "dd MMM yyyy", { locale: fr })}
                        </span>
                      ) : "—"}
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Ouvrir"
                        onClick={() => router.push(`/raid/${r.id}`)}
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                      {formEditCtx &&
                        canEditRaidFormClient(r, formEditCtx) && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Modifier (formulaire)"
                            onClick={() => onEdit(r)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                      {formEditCtx?.chantierScopeAll && (
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

export function RaidList({ items, filterType, initialProbabilite, initialImpact, initialStatut, initialOverdue, initialCritical, initialRaidScope = "mine", statusConfigs, fieldOptions }: Props) {
  const { ressourceId, displayName } = useUser();
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
      .filter((r) => r.date_echeance || r.date_revision || r.date_identification)
      .map((r) => ({
        id: r.id,
        date: new Date((r.date_echeance ?? r.date_revision ?? r.date_identification)!),
        label: r.intitule,
        color: RAID_TYPE_COLORS[r.type] ?? "#6b7280",
        type: r.type,
        details: {
          "Type": RAID_TYPE_LABELS[r.type] ?? r.type,
          "Statut": r.statut || "",
          "Catégorie": r.categorie || "",
          "Domaine": r.domaine || "",
          "Responsable": r.responsable || "",
          "Chantier": r.chantier ? `${r.chantier.code} - ${r.chantier.nom}` : "",
          "Échéance": r.date_echeance
            ? format(new Date(r.date_echeance), "dd MMM yyyy", { locale: fr })
            : "",
        },
      }));
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
    const typeItems = grouped.get(filterType) ?? [];
    const typeCalendar = calendarEvents.filter((e) => e.type === filterType);
    return (
      <>
        <div className="mb-4">{scopeBar}</div>
        <Tabs defaultValue="table" className="space-y-4" key={`scope-${raidScope}-${filterType}`}>
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
          canEditRaidFormClient(editItem, formEditCtx) && (
          <RaidFormDialog
            open={!!editItem}
            onOpenChange={(open) => !open && setEditItem(null)}
            raid={editItem}
            statusConfigs={statusConfigs}
            fieldOptions={fieldOptions}
          />
        )}
        <DeleteConfirmDialog
          open={!!deleteId && !!formEditCtx?.chantierScopeAll}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={async () => {
            try {
              if (deleteId) await deleteRaid(deleteId);
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
          const tItems = grouped.get(t) ?? [];
          return (
            <TabsContent key={t} value={t}>
              <Tabs defaultValue="table" className="space-y-4">
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
                <TabsContent value="table">
                  <RaidTable
                    items={tItems}
                    showType={false}
                    onEdit={setEditItem}
                    onDelete={(id) => { setDeleteError(null); setDeleteId(id); }}
                    statusConfigs={statusConfigs}
                    fieldOptions={fieldOptions}
                    formEditCtx={formEditCtx}
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
        canEditRaidFormClient(editItem, formEditCtx) && (
        <RaidFormDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          raid={editItem}
          statusConfigs={statusConfigs}
          fieldOptions={fieldOptions}
        />
      )}
      <DeleteConfirmDialog
        open={!!deleteId && !!formEditCtx?.chantierScopeAll}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={async () => {
          try {
            if (deleteId) await deleteRaid(deleteId);
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
