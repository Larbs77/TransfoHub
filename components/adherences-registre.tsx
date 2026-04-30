"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowRight,
  AlertTriangle,
  TableProperties,
  GitFork,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { deleteAdherence } from "@/app/(app)/actions";
import { AdherenceFormDialog } from "@/components/adherence-form-dialog";
import { AdherenceGraph } from "@/components/adherence-graph";
import {
  ADHERENCE_TYPES,
  ADHERENCE_TYPE_COLORS,
  ADHERENCE_STATUTS,
  ADHERENCE_STATUT_COLORS,
  ADHERENCE_CRITICITES,
  ADHERENCE_CRITICITE_COLORS,
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
  chantierDependantId: string | null;
  chantierDependant: ChantierRef | null;
  chantierDependantLabel: string;
  type: string;
  domaine: string;
  description: string;
  criticite: string;
  statut: string;
  date_identification: Date | null;
  date_resolution_prevue: Date | null;
  responsable: string;
  contrat_interface: string;
  commentaires: string;
}

interface ChantierOption {
  id: string;
  code: string;
  nom: string;
}

interface Props {
  adherences: AdherenceItem[];
  chantiers: ChantierOption[];
  nextCode: string;
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className="flex size-9 items-center justify-center rounded-md"
        style={{ backgroundColor: color + "18" }}
      >
        <span className="text-lg font-bold" style={{ color }}>{value}</span>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
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

export function AdherencesRegistre({ adherences, chantiers, nextCode }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdherenceItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCriticite, setFilterCriticite] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");

  // Pagination
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sort
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

  // KPIs
  const total = adherences.length;
  const bloquantes = adherences.filter((a) => a.criticite === "BLOQUANTE").length;
  const enCours = adherences.filter((a) => a.statut === "En cours").length;
  const resolues = adherences.filter((a) => a.statut === "Résolu").length;
  const bloquees = adherences.filter((a) => a.statut === "Bloqué").length;

  // Filter + Sort
  const filtered = useMemo(() => {
    setCurrentPage(1);
    const result = adherences.filter((a) => {
      if (filterType !== "all" && a.type !== filterType) return false;
      if (filterCriticite !== "all" && a.criticite !== filterCriticite) return false;
      if (filterStatut !== "all" && a.statut !== filterStatut) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          a.code.toLowerCase().includes(s) ||
          a.description.toLowerCase().includes(s) ||
          a.chantierSource.code.toLowerCase().includes(s) ||
          a.chantierSource.nom.toLowerCase().includes(s) ||
          (a.chantierDependant?.code.toLowerCase().includes(s) ?? false) ||
          (a.chantierDependant?.nom.toLowerCase().includes(s) ?? false) ||
          a.responsable.toLowerCase().includes(s)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "code": return dir * a.code.localeCompare(b.code);
        case "source": return dir * a.chantierSource.code.localeCompare(b.chantierSource.code);
        case "dependant": return dir * (a.chantierDependant?.code ?? a.chantierDependantLabel ?? "").localeCompare(b.chantierDependant?.code ?? b.chantierDependantLabel ?? "");
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
  }, [adherences, search, filterType, filterCriticite, filterStatut, sortField, sortDir]);

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginated = pageSize === 0
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette adhérence ?")) return;
    await deleteAdherence(id);
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Total adhérences" value={total} color="#6366f1" />
        <KpiCard label="Bloquantes" value={bloquantes} color="#dc2626" />
        <KpiCard label="En cours" value={enCours} color="#3b82f6" />
        <KpiCard label="Résolues" value={resolues} color="#22c55e" />
        <KpiCard label="Bloquées" value={bloquees} color="#ef4444" />
      </div>

      <Tabs defaultValue="registre" className="space-y-4">
        <TabsList>
          <TabsTrigger value="registre" className="gap-2">
            <TableProperties className="size-4" />
            Registre
          </TabsTrigger>
          <TabsTrigger value="graphe" className="gap-2">
            <GitFork className="size-4" />
            Graphe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="graphe">
          <AdherenceGraph adherences={adherences} height={600} />
        </TabsContent>

        <TabsContent value="registre">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registre des Adhérences</CardTitle>
          <CardDescription>
            {filtered.length} adhérence(s) sur {total}
          </CardDescription>
          <CardAction>
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
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Filters + Page size */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {ADHERENCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCriticite} onValueChange={setFilterCriticite}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Criticité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {ADHERENCE_CRITICITES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {ADHERENCE_STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  {[10, 15, 20, 30].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                  <SelectItem value="all">Tout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="code" className="w-[80px]">Code</SortableHead>
                  <SortableHead field="source" className="w-[200px]">Source</SortableHead>
                  <TableHead className="w-[30px]" />
                  <SortableHead field="dependant" className="w-[200px]">Dépendant</SortableHead>
                  <SortableHead field="type" className="w-[100px]">Type</SortableHead>
                  <SortableHead field="criticite" className="w-[90px]">Criticité</SortableHead>
                  <SortableHead field="statut" className="w-[80px]">Statut</SortableHead>
                  <SortableHead field="echeance" className="w-[100px]">Échéance</SortableHead>
                  <SortableHead field="responsable" className="w-[100px]">Responsable</SortableHead>
                  <TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Aucune adhérence trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs font-medium">{a.code}</TableCell>
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
                        {a.chantierDependant ? (
                          <Link href={`/chantiers/${a.chantierDependant.id}`} className="hover:underline">
                            <span className="text-xs font-medium">{a.chantierDependant.code}</span>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {a.chantierDependant.nom}
                            </p>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {a.chantierDependantLabel || "Transverse"}
                          </span>
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
                      <TableCell>
                        <div className="flex gap-1">
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
                            onClick={() => handleDelete(a.id)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
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

        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <AdherenceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        adherence={editItem}
        chantiers={chantiers}
        nextCode={nextCode}
      />
    </div>
  );
}
