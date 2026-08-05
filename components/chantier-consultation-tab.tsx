"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
import {
  HelpCircle,
  AlertCircle,
  Clock,
  Plus,
  Pencil,
  Eye,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
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
  questions: QuestionItem[];
  chantierId: string;
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
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
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
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">{start}–{end} sur {totalItems}</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, i) => p === "..." ? (
          <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
        ) : (
          <Button key={p} variant={p === currentPage ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => onPageChange(p)}>
            {p}
          </Button>
        ))}
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function ChantierConsultationTab({ questions, chantierId }: Props) {
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("__all__");
  const [filterPriorite, setFilterPriorite] = useState("__all__");
  const [filterCategorie, setFilterCategorie] = useState("__all__");
  const [filterEnRetard, setFilterEnRetard] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<QuestionItem | null>(null);
  const [qaModes, setQaModes] = useState({
    create: "DIRECT",
    update: "DIRECT",
    delete: "DIRECT",
  });

  useEffect(() => {
    getQaWorkflowUiState()
      .then(setQaModes)
      .catch(() =>
        setQaModes({ create: "INTERDIT", update: "INTERDIT", delete: "INTERDIT" })
      );
  }, []);

  // KPIs
  const total = questions.length;
  const ouvertes = questions.filter((q) => q.statut === "Ouverte").length;
  const critiquesOuvertes = questions.filter((q) => q.priorite === "Critique" && q.statut === "Ouverte").length;
  const enRetard = questions.filter((q) =>
    isQuestionEnRetard(
      q.echeance_actualisee ?? q.echeance,
      q.statut,
      new Date(),
      q.echeance
    )
  ).length;

  const kpiActive = {
    total:
      filterStatut === "__all__" &&
      filterPriorite === "__all__" &&
      filterCategorie === "__all__" &&
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
  };

  function applyKpiFilter(
    mode: "total" | "ouvertes" | "critiques" | "enRetard"
  ) {
    if (
      (mode === "total" && kpiActive.total) ||
      (mode === "ouvertes" && kpiActive.ouvertes) ||
      (mode === "critiques" && kpiActive.critiques) ||
      (mode === "enRetard" && kpiActive.enRetard)
    ) {
      setFilterStatut("__all__");
      setFilterPriorite("__all__");
      setFilterCategorie("__all__");
      setFilterEnRetard(false);
      setSearch("");
      setCurrentPage(1);
      return;
    }
    setSearch("");
    setFilterCategorie("__all__");
    setCurrentPage(1);
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
    setFilterStatut("__all__");
    setFilterPriorite("__all__");
    setFilterEnRetard(true);
  }

  // Filter
  const filtered = questions.filter((q) => {
    if (filterStatut !== "__all__" && q.statut !== filterStatut) return false;
    if (filterPriorite !== "__all__" && q.priorite !== filterPriorite) return false;
    if (filterCategorie !== "__all__" && q.categorie !== filterCategorie) return false;
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
        q.remontee_par.toLowerCase().includes(s) ||
        formatAffecteeADisplay(q.affectee_a).toLowerCase().includes(s) ||
        q.affectee_a.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleView(q: QuestionItem) {
    setViewItem(q);
    setViewOpen(true);
  }

  function handleAdd() {
    if (qaModes.create === "INTERDIT") {
      alert("Vous n'êtes pas habilité à créer une question Q&A.");
      return;
    }
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (qaModes.delete === "INTERDIT") {
      alert("Vous n'êtes pas habilité à supprimer une question Q&A.");
      return;
    }
    if (qaModes.delete === "VALIDATION") {
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
      {/* Mini KPIs — cliquables → filtres */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => applyKpiFilter("total")}
          aria-pressed={kpiActive.total}
          title="Afficher toutes les questions"
          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-[#0A3C74]/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45 ${
            kpiActive.total
              ? "border-[#0A3C74] bg-[#0A3C74]/[0.05] shadow-sm ring-1 ring-[#0A3C74]/20"
              : ""
          }`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
            <HelpCircle className="size-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground">Total questions</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => applyKpiFilter("ouvertes")}
          aria-pressed={kpiActive.ouvertes}
          title="Filtrer : statut Ouverte"
          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-[#0A3C74]/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45 ${
            kpiActive.ouvertes
              ? "border-[#0A3C74] bg-[#0A3C74]/[0.05] shadow-sm ring-1 ring-[#0A3C74]/20"
              : ""
          }`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-orange-500/10">
            <Clock className="size-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">{ouvertes}</p>
            <p className="text-xs text-muted-foreground">Ouvertes</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => applyKpiFilter("critiques")}
          aria-pressed={kpiActive.critiques}
          title="Filtrer : Ouverte + priorité Critique"
          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-[#0A3C74]/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45 ${
            kpiActive.critiques
              ? "border-[#0A3C74] bg-[#0A3C74]/[0.05] shadow-sm ring-1 ring-[#0A3C74]/20"
              : ""
          }`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-500/10">
            <AlertCircle className="size-4 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">{critiquesOuvertes}</p>
            <p className="text-xs text-muted-foreground">Critiques ouvertes</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => applyKpiFilter("enRetard")}
          aria-pressed={kpiActive.enRetard}
          title="Filtrer : échéance dépassée (hors Résolue / Abandonnée)"
          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-[#0A3C74]/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45 ${
            kpiActive.enRetard
              ? "border-[#0A3C74] bg-[#0A3C74]/[0.05] shadow-sm ring-1 ring-[#0A3C74]/20"
              : ""
          }`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-800/10">
            <AlertCircle className="size-4 text-red-800" />
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-red-800">{enRetard}</p>
            <p className="text-xs text-muted-foreground">En retard</p>
          </div>
        </button>
      </div>

      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative min-w-0 flex-1 basis-[min(100%,12rem)]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={filterCategorie} onValueChange={(v) => { setFilterCategorie(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-9 w-full min-w-0 max-w-[11rem] overflow-hidden sm:w-[11rem] [&_[data-slot=select-value]]:truncate">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-w-[min(96vw,20rem)]">
            <SelectItem value="__all__">Toutes</SelectItem>
            {QA_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="truncate">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriorite} onValueChange={(v) => { setFilterPriorite(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-9 w-full min-w-0 max-w-[9rem] overflow-hidden sm:w-[9rem] [&_[data-slot=select-value]]:truncate">
            <SelectValue placeholder="Priorité" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="__all__">Toutes</SelectItem>
            {QA_PRIORITES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v); setCurrentPage(1); }}>
          <SelectTrigger className="h-9 w-full min-w-0 max-w-[9rem] overflow-hidden sm:w-[9rem] [&_[data-slot=select-value]]:truncate">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="__all__">Tous</SelectItem>
            {QA_STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {qaModes.create !== "INTERDIT" && (
          <Button onClick={handleAdd} size="sm" className="shrink-0">
            <Plus className="mr-1 size-4" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">Dossier</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-[100px]">Catégorie</TableHead>
              <TableHead className="w-[80px]">Priorité</TableHead>
              <TableHead className="w-[80px]">Statut</TableHead>
              <TableHead className="w-[100px]">Éch. act.</TableHead>
              <TableHead className="w-[100px]">Affectée à</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucune question
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
                  <TableCell className="text-sm max-w-[280px] truncate">{q.question}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" style={{ backgroundColor: (QA_CATEGORIE_COLORS[q.categorie] ?? "#94a3b8") + "20", color: QA_CATEGORIE_COLORS[q.categorie] ?? "#94a3b8" }}>
                      {q.categorie}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" style={{ backgroundColor: (QA_PRIORITE_COLORS[q.priorite] ?? "#94a3b8") + "20", color: QA_PRIORITE_COLORS[q.priorite] ?? "#94a3b8" }}>
                      {q.priorite}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" style={{ backgroundColor: (QA_STATUT_COLORS[q.statut] ?? "#94a3b8") + "20", color: QA_STATUT_COLORS[q.statut] ?? "#94a3b8" }}>
                      {q.statut}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-xs"
                    title={
                      q.echeance
                        ? `Initiale : ${format(new Date(q.echeance), "dd/MM/yyyy", { locale: fr })}`
                        : undefined
                    }
                  >
                    <span
                      className={
                        isQuestionEnRetard(
                          q.echeance_actualisee ?? q.echeance,
                          q.statut,
                          new Date(),
                          q.echeance
                        )
                          ? "font-semibold text-red-700 dark:text-red-400"
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
                    </span>
                  </TableCell>
                  <TableCell className="text-xs" title={formatAffecteeADisplay(q.affectee_a)}>
                    {formatAffecteeADisplay(q.affectee_a)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Consulter"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(q);
                        }}
                      >
                        <Eye className="size-3.5 text-[#0A3C74]" />
                      </Button>
                      {qaModes.update !== "INTERDIT" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Modifier"
                          asChild
                        >
                          <Link
                            href={`/consultation-backlog/${q.id}/modifier?retour=${encodeURIComponent(`/chantiers/${chantierId}`)}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="size-3" />
                          </Link>
                        </Button>
                      )}
                      {qaModes.delete !== "INTERDIT" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Supprimer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(q.id);
                          }}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
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
        <PaginationControls currentPage={safePage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} pageSize={pageSize} />
      )}

      <ConsultationQuestionViewDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        question={viewItem}
      />

      {/* Création uniquement (dialog) — modification = page dédiée */}
      <ConsultationQuestionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultChantierId={chantierId}
      />
    </div>
  );
}
