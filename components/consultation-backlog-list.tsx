"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
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
import {
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import {
  QA_CATEGORIES,
  QA_PRIORITES,
  QA_STATUTS,
  QA_CATEGORIE_COLORS,
  QA_PRIORITE_COLORS,
  QA_STATUT_COLORS,
} from "@/lib/consultation-labels";
import { ConsultationQuestionForm } from "@/components/consultation-question-form";
import { deleteConsultationQuestion } from "@/app/(app)/actions";
import Link from "next/link";

interface QuestionItem {
  id: string;
  chantierId: string;
  chantier: { id: string; code: string; nom: string };
  dossier_ref: string;
  question: string;
  categorie: string;
  priorite: string;
  statut: string;
  remontee_par: string;
  affectee_a: string;
  echeance: Date | null;
  resolution: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  items: QuestionItem[];
  initialPriorite?: string;
  initialStatut?: string;
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
  onPageChange: (p: number) => void;
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

type SortField = "dossier_ref" | "question" | "chantier" | "categorie" | "priorite" | "statut" | "echeance" | "affectee_a" | "createdAt";
type SortDir = "asc" | "desc";

const PRIORITE_ORDER: Record<string, number> = { Critique: 0, Haute: 1, Moyenne: 2, Basse: 3 };
const STATUT_ORDER: Record<string, number> = { Ouverte: 0, "En cours": 1, Résolue: 2, Fermée: 3 };

export function ConsultationBacklogList({ items, initialPriorite, initialStatut }: Props) {
  const [search, setSearch] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("__all__");
  const [filterPriorite, setFilterPriorite] = useState(initialPriorite ?? "__all__");
  const [filterStatut, setFilterStatut] = useState(initialStatut ?? "__all__");
  const [filterChantier, setFilterChantier] = useState("__all__");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<QuestionItem | null>(null);

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Unique chantiers for filter dropdown
  const uniqueChantiers = Array.from(
    new Map(items.map((q) => [q.chantier.id, q.chantier])).values()
  ).sort((a, b) => a.code.localeCompare(b.code));

  // KPIs
  const total = items.length;
  const ouvertes = items.filter((q) => q.statut === "Ouverte").length;
  const critiquesOuvertes = items.filter(
    (q) => q.priorite === "Critique" && q.statut === "Ouverte"
  ).length;
  const resolues = items.filter((q) => q.statut === "Résolue").length;
  const tauxResolution = total > 0 ? Math.round((resolues / total) * 100) : 0;

  // Filter + sort
  const filtered = useMemo(() => {
    setCurrentPage(1);
    const result = items.filter((q) => {
      if (filterCategorie !== "__all__" && q.categorie !== filterCategorie) return false;
      if (filterPriorite !== "__all__" && q.priorite !== filterPriorite) return false;
      if (filterStatut !== "__all__" && q.statut !== filterStatut) return false;
      if (filterChantier !== "__all__" && q.chantier.id !== filterChantier) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          q.question.toLowerCase().includes(s) ||
          q.dossier_ref.toLowerCase().includes(s) ||
          q.chantier.code.toLowerCase().includes(s) ||
          q.remontee_par.toLowerCase().includes(s) ||
          q.affectee_a.toLowerCase().includes(s)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "dossier_ref": return dir * a.dossier_ref.localeCompare(b.dossier_ref);
        case "question": return dir * a.question.localeCompare(b.question);
        case "chantier": return dir * a.chantier.code.localeCompare(b.chantier.code);
        case "categorie": return dir * a.categorie.localeCompare(b.categorie);
        case "priorite": return dir * ((PRIORITE_ORDER[a.priorite] ?? 9) - (PRIORITE_ORDER[b.priorite] ?? 9));
        case "statut": return dir * ((STATUT_ORDER[a.statut] ?? 9) - (STATUT_ORDER[b.statut] ?? 9));
        case "echeance": {
          const da = a.echeance ? new Date(a.echeance).getTime() : Infinity;
          const db = b.echeance ? new Date(b.echeance).getTime() : Infinity;
          return dir * (da - db);
        }
        case "affectee_a": return dir * a.affectee_a.localeCompare(b.affectee_a);
        case "createdAt": return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        default: return 0;
      }
    });

    return result;
  }, [items, search, filterCategorie, filterPriorite, filterStatut, filterChantier, sortField, sortDir]);

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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

  function handleEdit(q: QuestionItem) {
    setEditItem(q);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditItem(null);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette question ?")) return;
    await deleteConsultationQuestion(id);
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total questions" value={total} color="#3b82f6" />
        <KpiCard label="Ouvertes" value={ouvertes} color="#f97316" />
        <KpiCard label="Critiques ouvertes" value={critiquesOuvertes} color="#dc2626" />
        <KpiCard label={`Taux résolution ${tauxResolution}%`} value={resolues} color="#22c55e" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registre Q&A Consultation</CardTitle>
          <CardDescription>
            {filtered.length} question(s) sur {total}
          </CardDescription>
          <CardAction>
            <Button
              size="sm"
              onClick={handleAdd}
            >
              <Plus className="size-4" />
              Ajouter une question
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
            <Select value={filterCategorie} onValueChange={(v) => { setFilterCategorie(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes catégories</SelectItem>
                {QA_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriorite} onValueChange={(v) => { setFilterPriorite(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priorité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes priorités</SelectItem>
                {QA_PRIORITES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous statuts</SelectItem>
                {QA_STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterChantier} onValueChange={(v) => { setFilterChantier(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Chantier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous chantiers</SelectItem>
                {uniqueChantiers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
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
                  <SortableHead field="dossier_ref" className="w-[100px]">Dossier</SortableHead>
                  <SortableHead field="question">Question</SortableHead>
                  <SortableHead field="chantier" className="w-[110px]">Chantier</SortableHead>
                  <SortableHead field="categorie" className="w-[110px]">Catégorie</SortableHead>
                  <SortableHead field="priorite" className="w-[90px]">Priorité</SortableHead>
                  <SortableHead field="statut" className="w-[90px]">Statut</SortableHead>
                  <SortableHead field="echeance" className="w-[100px]">Échéance</SortableHead>
                  <SortableHead field="affectee_a" className="w-[100px]">Affectée à</SortableHead>
                  <TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Aucune question trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((q) => (
                    <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(q)}>
                      <TableCell className="font-mono text-xs">{q.dossier_ref || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{q.question}</TableCell>
                      <TableCell>
                        <Link
                          href={`/chantiers/${q.chantier.id}`}
                          className="text-xs font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {q.chantier.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: (QA_CATEGORIE_COLORS[q.categorie] ?? "#94a3b8") + "20",
                            color: QA_CATEGORIE_COLORS[q.categorie] ?? "#94a3b8",
                          }}
                        >
                          {q.categorie}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: (QA_PRIORITE_COLORS[q.priorite] ?? "#94a3b8") + "20",
                            color: QA_PRIORITE_COLORS[q.priorite] ?? "#94a3b8",
                          }}
                        >
                          {q.priorite}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: (QA_STATUT_COLORS[q.statut] ?? "#94a3b8") + "20",
                            color: QA_STATUT_COLORS[q.statut] ?? "#94a3b8",
                          }}
                        >
                          {q.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {q.echeance
                          ? format(new Date(q.echeance), "dd MMM yyyy", { locale: fr })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{q.affectee_a || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(q);
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(q.id);
                            }}
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

      {/* Form Dialog */}
      <ConsultationQuestionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        question={editItem}
      />
    </div>
  );
}
