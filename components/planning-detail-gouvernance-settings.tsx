"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updatePlanningDetailGouvernance } from "@/app/(app)/actions";
import {
  PLANNING_DETAIL_GOUVERNANCE,
  type PlanningDetailGouvernance,
} from "@/lib/planning-coherence";
import { Loader2, Check, Shield } from "lucide-react";

interface Props {
  value?: string | null;
}

export function PlanningDetailGouvernanceSettings({ value }: Props) {
  const [gouv, setGouv] = useState<PlanningDetailGouvernance>(
    value === PLANNING_DETAIL_GOUVERNANCE.ALIGNEE_JALON
      ? PLANNING_DETAIL_GOUVERNANCE.ALIGNEE_JALON
      : PLANNING_DETAIL_GOUVERNANCE.LIBRE
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setSaved(false);
    setError("");
    try {
      await updatePlanningDetailGouvernance(gouv);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Contrôle si la création, la modification et la suppression des{" "}
        <strong>workstreams</strong> et <strong>activités</strong> sur le
        planning chantier suivent le même circuit workflow que les jalons
        (Direct / Validation / Interdit selon le rôle).
      </p>

      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name="planningDetailGouv"
            className="mt-1"
            checked={gouv === PLANNING_DETAIL_GOUVERNANCE.LIBRE}
            onChange={() => setGouv(PLANNING_DETAIL_GOUVERNANCE.LIBRE)}
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Libre</span>
            <span className="block text-xs text-muted-foreground">
              CRUD direct pour workstreams et activités (recommandé par défaut).
              Les jalons restent soumis à leur workflow habituel.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input
            type="radio"
            name="planningDetailGouv"
            className="mt-1"
            checked={gouv === PLANNING_DETAIL_GOUVERNANCE.ALIGNEE_JALON}
            onChange={() => setGouv(PLANNING_DETAIL_GOUVERNANCE.ALIGNEE_JALON)}
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              Alignée sur le jalon
            </span>
            <span className="block text-xs text-muted-foreground">
              Création, modification et suppression des workstreams / activités
              suivent les droits workflow du rôle (même circuit que les jalons).
            </span>
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="button" size="sm" disabled={loading} onClick={handleSave}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : saved ? (
          <Check className="size-4" />
        ) : (
          <Shield className="size-4" />
        )}
        {saved ? "Enregistré" : "Enregistrer"}
      </Button>
    </div>
  );
}
