"use client";

import { useState, useEffect } from "react";
import {
  createConsultationQuestion,
  updateConsultationQuestion,
  getChantiersForSelect,
} from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  QA_CATEGORIES,
  QA_PRIORITES,
  QA_STATUTS,
} from "@/lib/consultation-labels";
import { format } from "date-fns";

interface QuestionData {
  id: string;
  chantierId: string;
  dossier_ref: string;
  question: string;
  categorie: string;
  priorite: string;
  statut: string;
  remontee_par: string;
  affectee_a: string;
  echeance: Date | null;
  resolution: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: QuestionData | null;
  defaultChantierId?: string;
}

export function ConsultationQuestionForm({
  open,
  onOpenChange,
  question,
  defaultChantierId,
}: Props) {
  const isEdit = !!question;

  const [chantierId, setChantierId] = useState(question?.chantierId ?? defaultChantierId ?? "");
  const [dossierRef, setDossierRef] = useState(question?.dossier_ref ?? "");
  const [questionText, setQuestionText] = useState(question?.question ?? "");
  const [categorie, setCategorie] = useState(question?.categorie ?? "Générale");
  const [priorite, setPriorite] = useState(question?.priorite ?? "Moyenne");
  const [statut, setStatut] = useState(question?.statut ?? "Ouverte");
  const [remonteePar, setRemonteePar] = useState(question?.remontee_par ?? "");
  const [affecteeA, setAffecteeA] = useState(question?.affectee_a ?? "");
  const [echeance, setEcheance] = useState(
    question?.echeance ? format(new Date(question.echeance), "yyyy-MM-dd") : ""
  );
  const [resolution, setResolution] = useState(question?.resolution ?? "");
  const [saving, setSaving] = useState(false);
  const [chantiers, setChantiers] = useState<{ id: string; code: string; nom: string }[]>([]);

  useEffect(() => {
    if (open) {
      getChantiersForSelect().then(setChantiers);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setChantierId(question?.chantierId ?? defaultChantierId ?? "");
      setDossierRef(question?.dossier_ref ?? "");
      setQuestionText(question?.question ?? "");
      setCategorie(question?.categorie ?? "Générale");
      setPriorite(question?.priorite ?? "Moyenne");
      setStatut(question?.statut ?? "Ouverte");
      setRemonteePar(question?.remontee_par ?? "");
      setAffecteeA(question?.affectee_a ?? "");
      setEcheance(
        question?.echeance ? format(new Date(question.echeance), "yyyy-MM-dd") : ""
      );
      setResolution(question?.resolution ?? "");
    }
  }, [open, question, defaultChantierId]);

  async function handleSubmit() {
    if (!chantierId || !questionText.trim()) return;
    if (statut === "Résolue" && !resolution.trim()) return;

    setSaving(true);
    try {
      const payload = {
        chantierId,
        dossier_ref: dossierRef,
        question: questionText,
        categorie,
        priorite,
        statut,
        remontee_par: remonteePar,
        affectee_a: affecteeA,
        echeance: echeance || null,
        resolution,
      };

      if (isEdit) {
        await updateConsultationQuestion(question.id, payload);
      } else {
        await createConsultationQuestion(payload);
      }
      onOpenChange(false);
    } catch {
      // Error handled by server action
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la question" : "Nouvelle question"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Chantier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Chantier *</label>
              <Select value={chantierId} onValueChange={setChantierId} disabled={!!defaultChantierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {chantiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Réf. Dossier</label>
              <Input
                value={dossierRef}
                onChange={(e) => setDossierRef(e.target.value)}
                placeholder="DCE-001, AO-2024-xxx..."
              />
            </div>
          </div>

          {/* Question */}
          <div>
            <label className="text-sm font-medium">Question *</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Décrivez la question..."
            />
          </div>

          {/* Catégorie + Priorité + Statut */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Catégorie</label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QA_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Priorité</label>
              <Select value={priorite} onValueChange={setPriorite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QA_PRIORITES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Statut</label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QA_STATUTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Remontée par + Affectée à + Échéance */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Remontée par</label>
              <Input
                value={remonteePar}
                onChange={(e) => setRemonteePar(e.target.value)}
                placeholder="Nom..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Affectée à</label>
              <Input
                value={affecteeA}
                onChange={(e) => setAffecteeA(e.target.value)}
                placeholder="Nom..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Échéance</label>
              <Input
                type="date"
                value={echeance}
                onChange={(e) => setEcheance(e.target.value)}
              />
            </div>
          </div>

          {/* Resolution — visible/required when Résolue */}
          {statut === "Résolue" && (
            <div>
              <label className="text-sm font-medium">Résolution *</label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Décrivez la résolution..."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !chantierId || !questionText.trim() || (statut === "Résolue" && !resolution.trim())}
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
