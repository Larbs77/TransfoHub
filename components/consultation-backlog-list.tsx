"use client";

import { useState, useMemo, useEffect } from "react";
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
  Eye,
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
import { ConsultationQuestionViewDialog } from "@/components/consultation-question-view-dialog";
import {
  deleteConsultationQuestion,
  getQaWorkflowUiState,
} from "@/app/(app)/actions";
import { formatAffecteeADisplay } from "@/lib/consultation-affectation";
import { isQuestionEnRetard } from "@/lib/consultation-labels";
import Link from "next/link";
import { useCanWritePage, useUser } from "@/components/user-provider";

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
  echeance_actualisee?: Date | null;
  date_fin_reelle?: Date | null;
  resolution: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  items: QuestionItem[];
  initialPriorite?: string;
  initialStatut?: string;
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
  const [filterEnRetard, setFilterEnRetard] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<QuestionItem | null>(null);
  const [qaModes, setQaModes] = useState({
    create: "DIRECT",
    update: "DIRECT",
    delete: "DIRECT",
  });
  const canWriteQa = useCanWritePage("/consultation-backlog");
  const { consultationChantierIds } = useUser();
  const effectiveQa = {
    create: canWriteQa ? qaModes.create : "INTERDIT",
    update: canWriteQa ? qaModes.update : "INTERDIT",
    delete: canWriteQa ? qaModes.delete : "INTERDIT",
  };

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    getQaWorkflowUiState()
      .then(setQaModes)
      .catch(() =>
        setQaModes({ create: "INTERDIT", update: "INTERDIT", delete: "INTERDIT" })
      );
  }, []);

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
  const enRetard = items.filter((q) =>
    isQuestionEnRetard(
      q.echeance_actualisee ?? q.echeance,
      q.statut,
      new Date(),
      q.echeance
    )
  ).length;
  const resolues = items.filter((q) => q.statut === "Résolue").length;
  const tauxResolution = total > 0 ? Math.round((resolues / total) * 100) : 0;

  // Filter + sort
  const filtered = useMemo(() => {
    const result = items.filter((q) => {
      if (filterCategorie !== "__all__" && q.categorie !== filterCategorie) return false;
      if (filterPriorite !== "__all__" && q.priorite !== filterPriorite) return false;
      if (filterStatut !== "__all__" && q.statut !== filterStatut) return false;
      if (filterChantier !== "__all__" && q.chantier.id !== filterChantier) return false;
      if (
        filterEnRetard &&
        !isQuestionEnRetard(
          q.echeance_actualisee ?? q.echeance,
          q.statut,
          new Date(),
          q.echeance
        )
      )
        return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          q.question.toLowerCase().includes(s) ||
          q.dossier_ref.toLowerCase().includes(s) ||
          q.chantier.code.toLowerCase().includes(s) ||
          q.remontee_par.toLowerCase().includes(s) ||
          formatAffecteeADisplay(q.affectee_a).toLowerCase().includes(s) ||
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
  }, [items, search, filterCategorie, filterPriorite, filterStatut, filterChantier, filterEnRetard, sortField, sortDir]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    filterCategorie,
    filterPriorite,
    filterStatut,
    filterChantier,
    filterEnRetard,
    pageSize,
  ]);

  const kpiActive = {
    total:
      filterStatut === "__all__" &&
      filterPriorite === "__all__" &&
      filterCategorie === "__all__" &&
      filterChantier === "__all__" &&
      !filterEnRetard &&
      !search,
    ouvertes:
      filterStatut === "Ouverte" &&
      filterPriorite === "__all__" &&
      !filterEnRetard,
    critiques:
      filterStatut === "Ouverte" &&
      filterPriorite === "Critique" &&
      !filterEnRetard,
    enRetard: filterEnRetard,
    resolues:
      filterStatut === "Résolue" &&
      filterPriorite === "__all__" &&
      !filterEnRetard,
  };

  function applyKpiFilter(
    mode: "total" | "ouvertes" | "critiques" | "enRetard" | "resolues"
  ) {
    // Re-click same KPI → reset to all
    if (
      (mode === "total" && kpiActive.total) ||
      (mode === "ouvertes" && kpiActive.ouvertes) ||
      (mode === "critiques" && kpiActive.critiques) ||
      (mode === "enRetard" && kpiActive.enRetard) ||
      (mode === "resolues" && kpiActive.resolues)
    ) {
      setFilterStatut("__all__");
      setFilterPriorite("__all__");
      setFilterCategorie("__all__");
      setFilterChantier("__all__");
      setFilterEnRetard(false);
      setSearch("");
      return;
    }

    setSearch("");
    setFilterCategorie("__all__");
    setFilterChantier("__all__");

    if (mode === "total") {
      setFilterStatut("__all__");
      setFilterPriorite("__all__");
      setFilterEnRetard(false);
      return;
    }
    if (mode === "ouvertes") {
      setFilterStatut("Ouverte");
      setFilterPriorite("__all__");
      setFilterEnRetard(false);
      return;
    }
    if (mode === "critiques") {
      setFilterStatut("Ouverte");
      setFilterPriorite("Critique");
      setFilterEnRetard(false);
      return;
    }
    if (mode === "enRetard") {
      setFilterStatut("__all__");
      setFilterPriorite("__all__");
      setFilterEnRetard(true);
      return;
    }
    // resolues
    setFilterStatut("Résolue");
    setFilterPriorite("__all__");
    setFilterEnRetard(false);
  }

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

  function handleView(q: QuestionItem) {
    setViewItem(q);
    setViewOpen(true);
  }

  function handleAdd() {
    if (effectiveQa.create === "INTERDIT") {
      alert("Vous n'êtes pas habilité à créer une question Q&A.");
      return;
    }
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (effectiveQa.delete === "INTERDIT") {
      alert("Vous n'êtes pas habilité à supprimer une question Q&A.");
      return;
    }
    if (effectiveQa.delete === "VALIDATION") {
      const motif = window.prompt(
        "Motif de suppression (demande workflow) :"
      );
      if (motif == null) return;
      if (!motif.trim()) {
        alert("Le motif est obligatoire pour une suppression en validation.");
        return;
      }
      try {
        const r = await deleteConsultationQuestion(id, { motif: motif.trim() });
        if (r.mode === "validation") {
          alert(
            "Demande de suppression soumise au workflow. Elle sera appliquée après approbation."
          );
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "Suppression impossible.");
      }
      return;
    }
    if (!confirm("Supprimer cette question ?")) return;
    try {
      await deleteConsultationQuestion(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Suppression impossible.");
    }
  }

  return (
    <div className="space-y-4">
      {/* KPIs — cliquables → filtres */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total questions"
          value={total}
          color="#3b82f6"
          active={kpiActive.total}
          onClick={() => applyKpiFilter("total")}
          title="Afficher toutes les questions"
        />
        <KpiCard
          label="Ouvertes"
          value={ouvertes}
          color="#f97316"
          active={kpiActive.ouvertes}
          onClick={() => applyKpiFilter("ouvertes")}
          title="Filtrer : statut Ouverte"
        />
        <KpiCard
          label="Critiques ouvertes"
          value={critiquesOuvertes}
          color="#dc2626"
          active={kpiActive.critiques}
          onClick={() => applyKpiFilter("critiques")}
          title="Filtrer : Ouverte + priorité Critique"
        />
        <KpiCard
          label="En retard"
          value={enRetard}
          color="#b91c1c"
          active={kpiActive.enRetard}
          onClick={() => applyKpiFilter("enRetard")}
          title="Filtrer : échéance dépassée (hors Résolue / Abandonnée)"
        />
        <KpiCard
          label={`Résolues · ${tauxResolution}%`}
          value={resolues}
          color="#22c55e"
          active={kpiActive.resolues}
          onClick={() => applyKpiFilter("resolues")}
          title="Filtrer : statut Résolue"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Registre Q&A Consultation</CardTitle>
          <CardDescription>
            {filtered.length} question(s) sur {total}
          </CardDescription>
          <CardAction>
            {effectiveQa.create !== "INTERDIT" && (
              <Button size="sm" onClick={handleAdd}>
                <Plus className="size-4" />
                Ajouter une question
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Filters + Page size */}
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="relative min-w-0 sm:col-span-2 xl:col-span-2">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterCategorie} onValueChange={(v) => { setFilterCategorie(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:truncate">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-w-[min(96vw,22rem)]">
                <SelectItem value="__all__">Toutes catégories</SelectItem>
                {QA_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="truncate">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriorite} onValueChange={(v) => { setFilterPriorite(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:truncate">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="__all__">Toutes priorités</SelectItem>
                {QA_PRIORITES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-9 w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:truncate">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="__all__">Tous statuts</SelectItem>
                {QA_STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterChantier} onValueChange={(v) => { setFilterChantier(v); setCurrentPage(1); }}>
              <SelectTrigger
                className="h-9 w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate"
                title={
                  filterChantier !== "__all__"
                    ? uniqueChantiers.find((c) => c.id === filterChantier)
                      ? `${uniqueChantiers.find((c) => c.id === filterChantier)!.code} — ${uniqueChantiers.find((c) => c.id === filterChantier)!.nom}`
                      : undefined
                    : undefined
                }
              >
                <SelectValue placeholder="Chantier" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                className="w-[var(--radix-select-trigger-width)] min-w-[min(100%,18rem)] max-w-[min(96vw,28rem)]"
              >
                <SelectItem value="__all__">Tous chantiers</SelectItem>
                {uniqueChantiers.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    className="max-w-full py-2"
                    title={`${c.code} — ${c.nom}`}
                  >
                    <span className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
                      <span className="shrink-0 rounded border bg-muted/60 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                        {c.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {c.nom}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex min-w-0 items-center gap-2 sm:col-span-2 xl:col-span-1">
              <label className="shrink-0 text-xs text-muted-foreground">
                Afficher
              </label>
              <Select
                value={pageSize === 0 ? "all" : String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(v === "all" ? 0 : Number(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-0 sm:w-24" size="sm">
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
                  <SortableHead field="echeance" className="w-[110px]">
                    Éch. act.
                  </SortableHead>
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
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleView(q)}
                    >
                      <TableCell className="font-mono text-xs">{q.dossier_ref || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{q.question}</TableCell>
                      <TableCell className="max-w-[140px]">
                        <Link
                          href={`/chantiers/${q.chantier.id}`}
                          className="block min-w-0 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          title={`${q.chantier.code} — ${q.chantier.nom}`}
                        >
                          <span className="block text-xs font-semibold tabular-nums">
                            {q.chantier.code}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {q.chantier.nom}
                          </span>
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
                      <TableCell
                        className={`text-xs ${
                          isQuestionEnRetard(
                            q.echeance_actualisee ?? q.echeance,
                            q.statut,
                            new Date(),
                            q.echeance
                          )
                            ? "font-semibold text-red-700 dark:text-red-400"
                            : ""
                        }`}
                        title={
                          q.echeance
                            ? `Initiale : ${format(new Date(q.echeance), "dd/MM/yyyy", { locale: fr })}`
                            : undefined
                        }
                      >
                        {(q.echeance_actualisee ?? q.echeance)
                          ? format(
                              new Date(
                                (q.echeance_actualisee ?? q.echeance) as Date
                              ),
                              "dd MMM yyyy",
                              { locale: fr }
                            )
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[140px] truncate text-xs"
                        title={formatAffecteeADisplay(q.affectee_a)}
                      >
                        {formatAffecteeADisplay(q.affectee_a)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Consulter"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(q);
                            }}
                          >
                            <Eye className="size-3.5 text-[#0A3C74]" />
                          </Button>
                          {effectiveQa.update !== "INTERDIT" &&
                            !consultationChantierIds.includes(q.chantierId) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Modifier"
                              asChild
                            >
                              <Link
                                href={`/consultation-backlog/${q.id}/modifier`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Pencil className="size-3" />
                              </Link>
                            </Button>
                          )}
                          {effectiveQa.delete !== "INTERDIT" &&
                            !consultationChantierIds.includes(q.chantierId) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              title="Supprimer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(q.id);
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
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

      <ConsultationQuestionViewDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        question={viewItem}
      />

      {/* Création uniquement (dialog) — modification = page dédiée */}
      <ConsultationQuestionForm
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
