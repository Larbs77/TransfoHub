"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSettings } from "@/app/(app)/actions";
import { Loader2, Check } from "lucide-react";

interface Props {
  settings: {
    id: number;
    seuil_relance_jours: number;
    seuil_qa_critique_heures: number;
    poids_precadrage: number;
    poids_cadrage: number;
    poids_execution: number;
    poids_cloture: number;
  } | null;
}

export function SettingsForm({ settings }: Props) {
  const [seuil, setSeuil] = useState(settings?.seuil_relance_jours ?? 3);
  const [seuilQa, setSeuilQa] = useState(settings?.seuil_qa_critique_heures ?? 48);
  const [poidsPrecadrage, setPoidsPrecadrage] = useState(settings?.poids_precadrage ?? 10);
  const [poidsCadrage, setPoidsCadrage] = useState(settings?.poids_cadrage ?? 20);
  const [poidsExecution, setPoidsExecution] = useState(settings?.poids_execution ?? 50);
  const [poidsCloture, setPoidsCloture] = useState(settings?.poids_cloture ?? 20);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const weightSum = poidsPrecadrage + poidsCadrage + poidsExecution + poidsCloture;
  const isValidSum = weightSum === 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSum) return;
    setLoading(true);
    setSaved(false);
    try {
      await updateSettings({
        seuil_relance_jours: seuil,
        seuil_qa_critique_heures: seuilQa,
        poids_precadrage: poidsPrecadrage,
        poids_cadrage: poidsCadrage,
        poids_execution: poidsExecution,
        poids_cloture: poidsCloture,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium whitespace-nowrap">
          Seuil de relance (jours avant échéance) :
        </label>
        <Input
          type="number"
          value={seuil}
          onChange={(e) => setSeuil(Number(e.target.value))}
          className="w-24"
          min={1}
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium whitespace-nowrap">
          Seuil alerte Q&A critique (heures) :
        </label>
        <Input
          type="number"
          value={seuilQa}
          onChange={(e) => setSeuilQa(Number(e.target.value))}
          className="w-24"
          min={1}
        />
      </div>

      <div className="border-t pt-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">Pondération des phases (%)</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Précadrage</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={poidsPrecadrage}
              onChange={(e) => setPoidsPrecadrage(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Cadrage</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={poidsCadrage}
              onChange={(e) => setPoidsCadrage(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Exécution</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={poidsExecution}
              onChange={(e) => setPoidsExecution(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Clôture</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={poidsCloture}
              onChange={(e) => setPoidsCloture(Number(e.target.value))}
            />
          </div>
        </div>
        <p className={`text-xs mt-2 ${isValidSum ? "text-muted-foreground" : "text-destructive font-medium"}`}>
          Total : {weightSum}%{isValidSum ? "" : " (doit être 100%)"}
        </p>
      </div>

      <Button type="submit" disabled={loading || !isValidSum} size="sm">
        {loading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : saved ? (
          <Check className="mr-2 size-4" />
        ) : null}
        {saved ? "Enregistré" : "Enregistrer"}
      </Button>
    </form>
  );
}
