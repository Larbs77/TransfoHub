"use client";

import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Milestone,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Wand2,
  MapPin,
} from "lucide-react";
import { deleteJalon, applyJalonTemplate } from "@/app/(app)/actions";
import { JalonFormDialog } from "@/components/jalon-form-dialog";
import {
  PHASES,
  PHASE_COLORS,
  STATUT_JALON_COLORS,
} from "@/lib/jalon-labels";

interface JalonData {
  id: string;
  chantierId: string;
  phase: string;
  nom: string;
  description: string;
  ordre: number;
  date_cible: Date;
  date_reelle: Date | null;
  statut: string;
  livrables: string;
  commentaire: string;
}

interface Props {
  jalons: JalonData[];
  chantierId: string;
  dateDebut: Date;
  dateFin: Date;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className="flex size-9 items-center justify-center rounded-md"
        style={{ backgroundColor: color + "18" }}
      >
        <Icon className="size-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function ChantierJalonsTab({ jalons, chantierId, dateDebut, dateFin }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editJalon, setEditJalon] = useState<JalonData | null>(null);
  const [defaultPhase, setDefaultPhase] = useState<string | undefined>();
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Stable "now" to avoid SSR/client hydration mismatch
  const [now] = useState(() => new Date());

  // KPI calculations
  const total = jalons.length;
  const atteints = jalons.filter((j) => j.statut === "Atteint").length;
  const enRetard = jalons.filter(
    (j) => new Date(j.date_cible) < now && !["Atteint", "Annulé"].includes(j.statut)
  ).length;
  const prochaine = jalons
    .filter((j) => new Date(j.date_cible) >= now && !["Atteint", "Annulé"].includes(j.statut))
    .sort((a, b) => new Date(a.date_cible).getTime() - new Date(b.date_cible).getTime())[0];

  // Group by phase
  const phaseGroups = PHASES.map((phase) => {
    const items = jalons.filter((j) => j.phase === phase);
    const phaseAtteints = items.filter((j) => j.statut === "Atteint").length;
    return { phase, items, atteints: phaseAtteints, total: items.length };
  });

  // Find the first phase that has items for default tab
  const defaultTab = phaseGroups.find((g) => g.total > 0)?.phase ?? PHASES[0];

  function ecart(j: JalonData): { days: number; label: string; color: string } | null {
    if (!j.date_reelle) {
      if (new Date(j.date_cible) < now && !["Atteint", "Annulé"].includes(j.statut)) {
        const days = differenceInDays(now, new Date(j.date_cible));
        return { days, label: `+${days}j`, color: "#ef4444" };
      }
      return null;
    }
    const days = differenceInDays(new Date(j.date_reelle), new Date(j.date_cible));
    if (days === 0) return { days: 0, label: "0j", color: "#22c55e" };
    if (days > 0) return { days, label: `+${days}j`, color: "#ef4444" };
    return { days, label: `${days}j`, color: "#22c55e" };
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce jalon ?")) return;
    await deleteJalon(id);
  }

  async function handleApplyTemplate() {
    setApplyingTemplate(true);
    try {
      await applyJalonTemplate(chantierId);
    } catch {
      // template already applied
    }
    setApplyingTemplate(false);
  }

  // Phase timeline visualization — extend range to include all jalons
  const allDates = jalons.map((j) => new Date(j.date_cible).getTime());
  const timelineStart = new Date(Math.min(new Date(dateDebut).getTime(), ...allDates));
  const timelineEnd = new Date(Math.max(new Date(dateFin).getTime(), ...allDates));
  const totalDuration = Math.max(differenceInDays(timelineEnd, timelineStart), 1);
  const todayPct = Math.min(
    Math.max((differenceInDays(now, timelineStart) / totalDuration) * 100, 0),
    100
  );
  const chantierStartPct = (differenceInDays(new Date(dateDebut), timelineStart) / totalDuration) * 100;
  const chantierEndPct = (differenceInDays(new Date(dateFin), timelineStart) / totalDuration) * 100;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total jalons" value={total} icon={Milestone} color="#6366f1" />
        <KpiCard label="Atteints" value={atteints} icon={CheckCircle2} color="#22c55e" />
        <KpiCard label="En retard" value={enRetard} icon={AlertTriangle} color="#ef4444" />
        <KpiCard
          label="Prochaine échéance"
          value={
            prochaine
              ? format(new Date(prochaine.date_cible), "dd MMM", { locale: fr })
              : "—"
          }
          icon={Clock}
          color="#3b82f6"
        />
      </div>

      {/* Phase Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline des phases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-28">
            {/* Chantier expected date range background */}
            <div
              className="absolute top-0 h-6 rounded-md bg-blue-50/40 border border-dashed border-blue-500/30"
              style={{
                left: `${chantierStartPct}%`,
                width: `${Math.max(chantierEndPct - chantierStartPct, 1)}%`,
              }}
            />

            {/* Phase bands */}
            <div className="absolute inset-x-0 top-0 h-6 rounded-md overflow-visible">
              {PHASES.map((phase) => {
                const phaseJalons = jalons.filter((j) => j.phase === phase);
                if (phaseJalons.length === 0) return null;
                const firstDate = new Date(
                  Math.min(...phaseJalons.map((j) => new Date(j.date_cible).getTime()))
                );
                const lastDate = new Date(
                  Math.max(...phaseJalons.map((j) => new Date(j.date_cible).getTime()))
                );
                const leftPct = (differenceInDays(firstDate, timelineStart) / totalDuration) * 100;
                const widthPct = Math.max(
                  (differenceInDays(lastDate, firstDate) / totalDuration) * 100,
                  3
                );
                return (
                  <div
                    key={phase}
                    className="absolute h-full flex items-center justify-center text-[10px] font-medium text-white rounded-sm"
                    style={{
                      left: `${Math.max(leftPct, 0)}%`,
                      width: `${widthPct}%`,
                      backgroundColor: PHASE_COLORS[phase],
                    }}
                  >
                    {widthPct > 8 && phase}
                  </div>
                );
              })}
            </div>

            {/* Chantier start/end dashed lines */}
            <div
              className="absolute top-0 border-l border-dashed border-blue-500/60"
              style={{ left: `${chantierStartPct}%`, height: "60%" }}
            >
              <span className="absolute bottom-0 translate-y-full -translate-x-1/2 text-[9px] text-blue-500 font-medium whitespace-nowrap">
                {format(new Date(dateDebut), "dd MMM yy", { locale: fr })}
              </span>
            </div>
            <div
              className="absolute top-0 border-l border-dashed border-blue-500/60"
              style={{ left: `${chantierEndPct}%`, height: "60%" }}
            >
              <span className="absolute bottom-0 translate-y-full -translate-x-1/2 text-[9px] text-blue-500 font-medium whitespace-nowrap">
                {format(new Date(dateFin), "dd MMM yy", { locale: fr })}
              </span>
            </div>

            {/* Milestone markers */}
            <div className="absolute inset-x-0 top-7 h-8">
              {jalons.map((j) => {
                const leftPct = (differenceInDays(new Date(j.date_cible), timelineStart) / totalDuration) * 100;
                const color = STATUT_JALON_COLORS[j.statut] ?? "#94a3b8";
                return (
                  <div
                    key={j.id}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
                    title={`${j.nom} — ${j.statut} — ${format(new Date(j.date_cible), "dd MMM yyyy", { locale: fr })}`}
                  >
                    <div
                      className="size-3 rotate-45 rounded-sm border-2 border-white"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Today marker */}
            {todayPct >= 0 && todayPct <= 100 && (
              <div
                className="absolute top-0 border-l-2 border-dashed border-red-500 z-10"
                style={{ left: `${todayPct}%`, height: "60%" }}
              >
                <MapPin className="absolute -top-5 -left-[9px] size-[18px] fill-red-500 text-white drop-shadow-sm" />
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-0 inset-x-0 flex gap-3 text-[10px] text-muted-foreground">
              {Object.entries(STATUT_JALON_COLORS).map(([statut, color]) => (
                <span key={statut} className="flex items-center gap-1">
                  <span
                    className="inline-block size-2 rotate-45 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  {statut}
                </span>
              ))}
              <span className="flex items-center gap-1 ml-2">
                <span className="inline-block w-3 h-0 border-t border-dashed border-blue-500/60" />
                Dates prévues
              </span>
              <span className="flex items-center gap-1 ml-2">
                <MapPin className="size-2.5 fill-red-500 text-white" />
                Aujourd&apos;hui
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Tabs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Jalons par phase</CardTitle>
          <CardDescription>
            {total} jalon(s) — {atteints}/{total} atteints
          </CardDescription>
          <CardAction>
            <div className="flex gap-2">
              {total === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyTemplate}
                  disabled={applyingTemplate}
                >
                  {applyingTemplate ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  Appliquer modèle
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  setEditJalon(null);
                  setDefaultPhase(undefined);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Nouveau jalon
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aucun jalon. Cliquez sur &quot;Appliquer modèle&quot; pour créer les jalons standard.
            </div>
          ) : (
            <Tabs defaultValue={defaultTab} className="space-y-3">
              <TabsList>
                {phaseGroups.map((group) => (
                  <TabsTrigger
                    key={group.phase}
                    value={group.phase}
                    className="gap-1.5"
                    disabled={group.total === 0}
                  >
                    <div
                      className="size-2 rounded-full"
                      style={{ backgroundColor: PHASE_COLORS[group.phase] }}
                    />
                    <span style={{ color: group.total > 0 ? undefined : "#9ca3af" }}>
                      {group.phase}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                      style={
                        group.atteints === group.total && group.total > 0
                          ? { backgroundColor: "#22c55e20", color: "#22c55e" }
                          : undefined
                      }
                    >
                      {group.atteints}/{group.total}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {phaseGroups.map((group) => (
                <TabsContent key={group.phase} value={group.phase}>
                  {group.total === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Aucun jalon pour cette phase
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Add button for this phase */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditJalon(null);
                            setDefaultPhase(group.phase);
                            setDialogOpen(true);
                          }}
                        >
                          <Plus className="size-3" />
                          Ajouter à {group.phase}
                        </Button>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Nom</TableHead>
                            <TableHead className="w-[100px]">Date cible</TableHead>
                            <TableHead className="w-[100px]">Date réelle</TableHead>
                            <TableHead className="w-[70px] text-center">Écart</TableHead>
                            <TableHead className="w-[90px]">Statut</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((j) => {
                            const e = ecart(j);
                            return (
                              <TableRow key={j.id}>
                                <TableCell>
                                  <div>
                                    <span className="text-sm font-medium">{j.nom}</span>
                                    {j.description && (
                                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                        {j.description}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {format(new Date(j.date_cible), "dd MMM yyyy", { locale: fr })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {j.date_reelle
                                    ? format(new Date(j.date_reelle), "dd MMM yyyy", { locale: fr })
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {e ? (
                                    <span
                                      className="text-xs font-semibold"
                                      style={{ color: e.color }}
                                    >
                                      {e.label}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    style={{
                                      backgroundColor: (STATUT_JALON_COLORS[j.statut] ?? "#94a3b8") + "20",
                                      color: STATUT_JALON_COLORS[j.statut] ?? "#94a3b8",
                                    }}
                                  >
                                    {j.statut}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setEditJalon(j);
                                        setDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => handleDelete(j.id)}
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <JalonFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jalon={editJalon}
        chantierId={chantierId}
        defaultPhase={defaultPhase}
      />
    </div>
  );
}
