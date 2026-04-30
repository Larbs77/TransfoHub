"use client";

import { useState } from "react";
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
import { deleteConsultationQuestion } from "@/app/(app)/actions";

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
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<QuestionItem | null>(null);

  // KPIs
  const total = questions.length;
  const ouvertes = questions.filter((q) => q.statut === "Ouverte").length;
  const critiquesOuvertes = questions.filter((q) => q.priorite === "Critique" && q.statut === "Ouverte").length;

  // Filter
  const filtered = questions.filter((q) => {
    if (filterStatut !== "__all__" && q.statut !== filterStatut) return false;
    if (filterPriorite !== "__all__" && q.priorite !== filterPriorite) return false;
    if (filterCategorie !== "__all__" && q.categorie !== filterCategorie) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.question.toLowerCase().includes(s) || q.dossier_ref.toLowerCase().includes(s) || q.remontee_par.toLowerCase().includes(s) || q.affectee_a.toLowerCase().includes(s);
    }
    return true;
  });

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = pageSize === 0 ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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
      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-blue-500/10">
            <HelpCircle className="size-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total questions</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-orange-500/10">
            <Clock className="size-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{ouvertes}</p>
            <p className="text-xs text-muted-foreground">Ouvertes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-red-500/10">
            <AlertCircle className="size-4 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{critiquesOuvertes}</p>
            <p className="text-xs text-muted-foreground">Critiques ouvertes</p>
          </div>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={filterCategorie} onValueChange={(v) => { setFilterCategorie(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes</SelectItem>
            {QA_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriorite} onValueChange={(v) => { setFilterPriorite(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Priorité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes</SelectItem>
            {QA_PRIORITES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatut} onValueChange={(v) => { setFilterStatut(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous</SelectItem>
            {QA_STATUTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-1 size-4" />
          Ajouter
        </Button>
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
              <TableHead className="w-[90px]">Échéance</TableHead>
              <TableHead className="w-[100px]">Affectée à</TableHead>
              <TableHead className="w-[50px]" />
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
                <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(q)}>
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
                  <TableCell className="text-xs">
                    {q.echeance ? format(new Date(q.echeance), "dd MMM yyyy", { locale: fr }) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{q.affectee_a || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
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

      <ConsultationQuestionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        question={editItem}
        defaultChantierId={chantierId}
      />
    </div>
  );
}
