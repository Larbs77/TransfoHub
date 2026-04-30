"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getSaisiesTempsForWeek,
  upsertSaisiesTempsBatch,
  getRessourceById,
} from "@/app/(app)/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Save, CalendarDays } from "lucide-react";
import { getRAGColor, getRAGStatus, RAG_LABELS } from "@/lib/capacite-labels";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  ressources: { id: string; nom_complet: string; type: string; organisation: string }[];
}

interface ChantierRow {
  chantierId: string;
  code: string;
  nom: string;
  charge_pourcentage: number;
  jours_planifies: number;
  jours_travailles: number;
  commentaire: string;
}

function getMonday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function SaisieTempsGrid({ ressources }: Props) {
  const [selectedRessourceId, setSelectedRessourceId] = useState(ressources[0]?.id ?? "");
  const [monday, setMonday] = useState(() => getMonday(new Date()));
  const [rows, setRows] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const friday = useMemo(() => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 4);
    return d;
  }, [monday]);

  const weekLabel = useMemo(() => {
    return `Semaine du ${format(monday, "d MMM", { locale: fr })} au ${format(friday, "d MMM yyyy", { locale: fr })}`;
  }, [monday, friday]);

  // Load data when resource or week changes
  useEffect(() => {
    if (!selectedRessourceId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRessourceId, monday]);

  async function loadData() {
    setLoading(true);
    setSaved(false);
    const [ressource, saisies] = await Promise.all([
      getRessourceById(selectedRessourceId),
      getSaisiesTempsForWeek(selectedRessourceId, monday.toISOString()),
    ]);

    if (!ressource) {
      setRows([]);
      setLoading(false);
      return;
    }

    // Build rows from team assignments (active chantiers only)
    const newRows: ChantierRow[] = ressource.membres
      .filter((m) => {
        const debut = new Date(m.chantier.date_debut);
        const fin = new Date(m.chantier.date_fin);
        return m.chantier.statut !== "Clôturé" && debut <= friday && fin >= monday;
      })
      .map((m) => {
        const existing = saisies.find((s) => s.chantier.id === m.chantier.id);
        return {
          chantierId: m.chantier.id,
          code: m.chantier.code,
          nom: m.chantier.nom,
          charge_pourcentage: m.charge_pourcentage,
          jours_planifies: Math.round(((m.charge_pourcentage / 100) * 5) * 10) / 10,
          jours_travailles: existing?.jours_travailles ?? 0,
          commentaire: existing?.commentaire ?? "",
        };
      });

    setRows(newRows);
    setLoading(false);
  }

  function updateRow(index: number, field: "jours_travailles" | "commentaire", value: number | string) {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const entries = rows.map((r) => ({
      ressourceId: selectedRessourceId,
      chantierId: r.chantierId,
      date_lundi: monday.toISOString(),
      jours_travailles: r.jours_travailles,
      commentaire: r.commentaire,
    }));
    await upsertSaisiesTempsBatch(entries);
    setSaving(false);
    setSaved(true);
  }

  // Totals
  const totalPlanifie = rows.reduce((s, r) => s + r.jours_planifies, 0);
  const totalTravaille = rows.reduce((s, r) => s + r.jours_travailles, 0);
  const capaciteHebdo = 5;
  const chargePct = capaciteHebdo > 0 ? Math.round((totalPlanifie / capaciteHebdo) * 100) : 0;
  const ragStatus = getRAGStatus(chargePct);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={selectedRessourceId} onValueChange={setSelectedRessourceId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Sélectionner une ressource" />
          </SelectTrigger>
          <SelectContent>
            {ressources.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nom_complet}
                {r.organisation ? ` (${r.organisation})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-xs" onClick={() => setMonday(subWeeks(monday, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium min-w-[240px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon-xs" onClick={() => setMonday(addWeeks(monday, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonday(getMonday(new Date()))}
          className="gap-1.5"
        >
          <CalendarDays className="size-3.5" />
          Aujourd&apos;hui
        </Button>
      </div>

      {/* Grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Feuille de temps
            </CardTitle>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="text-xs text-emerald-600 font-medium">Enregistré</span>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving || loading || rows.length === 0} className="gap-1.5">
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {selectedRessourceId
                ? "Aucun chantier actif cette semaine pour cette ressource"
                : "Sélectionnez une ressource"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Chantier</TableHead>
                  <TableHead className="w-20 text-center">Charge %</TableHead>
                  <TableHead className="w-24 text-center">Planifié (j)</TableHead>
                  <TableHead className="w-28 text-center">Travaillé (j)</TableHead>
                  <TableHead className="w-20 text-center">Écart</TableHead>
                  <TableHead className="min-w-[120px]">Commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => {
                  const ecart = Math.round((row.jours_travailles - row.jours_planifies) * 10) / 10;
                  return (
                    <TableRow key={row.chantierId}>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground mr-1.5">{row.code}</span>
                        <span className="text-sm font-medium truncate max-w-[200px] inline-block align-bottom">
                          {row.nom}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px]">
                          {row.charge_pourcentage}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{row.jours_planifies}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          step={0.5}
                          value={row.jours_travailles}
                          onChange={(e) => updateRow(i, "jours_travailles", parseFloat(e.target.value) || 0)}
                          className="w-20 mx-auto text-center text-sm tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-sm tabular-nums font-medium ${ecart > 0 ? "text-red-500" : ecart < 0 ? "text-emerald-500" : ""}`}>
                          {ecart > 0 ? "+" : ""}{ecart}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.commentaire}
                          onChange={(e) => updateRow(i, "commentaire", e.target.value)}
                          placeholder="—"
                          className="text-xs"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: getRAGColor(chargePct) }}
                    >
                      {chargePct}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{Math.round(totalPlanifie * 10) / 10}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{Math.round(totalTravaille * 10) / 10}</TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const ecart = Math.round((totalTravaille - totalPlanifie) * 10) / 10;
                      return (
                        <span className={`text-sm tabular-nums font-medium ${ecart > 0 ? "text-red-500" : ecart < 0 ? "text-emerald-500" : ""}`}>
                          {ecart > 0 ? "+" : ""}{ecart}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Capacité : {capaciteHebdo} j — {RAG_LABELS[ragStatus]}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
