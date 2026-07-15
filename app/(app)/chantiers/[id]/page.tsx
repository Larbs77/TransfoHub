import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getChantierById,
  getBurnRateChantier,
  getConsultationQuestions,
  getJalonWorkflowUiState,
} from "@/app/(app)/actions";
import { AccessDenied } from "@/components/access-denied";
import {
  DOMAINE_LABELS,
  DOMAINE_COLORS,
  STATUT_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
  TYPE_CHANTIER_LABELS,
  TYPE_CHANTIER_COLORS,
  PRIORITE_CHANTIER_LABELS,
  PRIORITE_CHANTIER_COLORS,
} from "@/lib/chantier-labels";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { EquipeTable } from "@/components/equipe-table";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";
import { ChantierDetailTabs } from "@/components/chantier-detail-tabs";
import { ChantierDetailActions } from "@/components/chantier-detail-actions";
import { ChantierKpiTab } from "@/components/chantier-kpi-tab";
import { ChantierCapaciteTab } from "@/components/chantier-capacite-tab";
import { ChantierJalonsTab } from "@/components/chantier-jalons-tab";
import { ChantierAdherencesTab } from "@/components/chantier-adherences-tab";
import { ChantierConsultationTab } from "@/components/chantier-consultation-tab";
import { formatMAD, formatJH } from "@/lib/utils-pmo";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChantierDetailPage({ params }: Props) {
  const { id } = await params;

  let chantier, burnRate, consultationQuestions, jalonWorkflow;
  try {
    [chantier, burnRate, consultationQuestions, jalonWorkflow] = await Promise.all([
      getChantierById(id),
      getBurnRateChantier(id),
      getConsultationQuestions(id),
      getJalonWorkflowUiState(id),
    ]);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("non autorisé")) {
      return <AccessDenied message="Vous n'êtes pas membre de ce chantier." />;
    }
    throw e;
  }

  if (!chantier) return notFound();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-base">
                {chantier.code}
              </Badge>
              <Badge style={{ backgroundColor: DOMAINE_COLORS[chantier.domaine], color: "white" }}>{DOMAINE_LABELS[chantier.domaine] ?? chantier.domaine}</Badge>
              <Badge style={{ backgroundColor: TYPE_CHANTIER_COLORS[chantier.type_chantier], color: "white" }}>{TYPE_CHANTIER_LABELS[chantier.type_chantier] ?? chantier.type_chantier}</Badge>
              <Badge style={{ backgroundColor: PRIORITE_CHANTIER_COLORS[chantier.priorite], color: "white" }}>{PRIORITE_CHANTIER_LABELS[chantier.priorite] ?? chantier.priorite}</Badge>
              <Badge style={{ backgroundColor: STATUT_CHANTIER_COLORS[chantier.statut], color: "white" }}>
                {STATUT_CHANTIER_LABELS[chantier.statut] ?? chantier.statut}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/rapport/${chantier.id}`} target="_blank">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="size-4" />
                  Synthèse PDF
                </Button>
              </Link>
              <ChantierDetailActions chantier={chantier} />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{chantier.nom}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              {format(new Date(chantier.date_debut), "dd MMM yyyy", {
                locale: fr,
              })}{" "}
              →{" "}
              {format(new Date(chantier.date_fin), "dd MMM yyyy", {
                locale: fr,
              })}
            </span>
            {chantier.budgetTotalMAD > 0 && (
              <span>
                <span className="font-medium">Budget Total:</span>{" "}
                {formatMAD(chantier.budgetTotalMAD)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 max-w-md">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Avancement</span>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${chantier.avancement}%`,
                  backgroundColor: STATUT_CHANTIER_COLORS[chantier.statut] ?? "#6b7280",
                }}
              />
            </div>
            <span className="text-sm font-bold" style={{ color: STATUT_CHANTIER_COLORS[chantier.statut] ?? "#6b7280" }}>
              {chantier.avancement}%
            </span>
          </div>
          {chantier.rmds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-muted-foreground">RMD:</span>
              {chantier.rmds.map((cr) => (
                <Link key={cr.rmd.id} href={`/rmds/${cr.rmd.id}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                    {cr.rmd.nom_complet}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        {chantier.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Description du chantier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {chantier.description}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Financial Overview */}
        {chantier.budgetTotalMAD > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Synthèse Financière</CardTitle>
                <div className="rounded-lg bg-primary/10 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Budget Total</p>
                  <p className="text-lg font-bold text-primary">{formatMAD(chantier.budgetTotalMAD)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Budget Projet (JH)</p>
                  <p className="text-sm font-semibold">{formatJH(chantier.budgetJH)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Budget Projet (MAD)</p>
                  <p className="text-sm font-semibold">{formatMAD(chantier.budgetProjetMAD)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Conseil Éditeurs</p>
                  <p className="text-sm font-semibold">{formatMAD(chantier.conseilEditeursMAD)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Licences Achat & Maintenance</p>
                  <p className="text-sm font-semibold">{formatMAD(chantier.licencesAchatsMAD)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Licences Abonnements</p>
                  <p className="text-sm font-semibold">{formatMAD(chantier.licencesAbonnementsMAD)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Coûts Infrastructures</p>
                  <p className="text-sm font-semibold">{formatMAD(chantier.coutsInfrasMAD)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: KPI / Equipe / RAID */}
        <ChantierDetailTabs
          membresCount={chantier.membres.length}
          raidCount={chantier.raids.length}
          kpiTab={
            <ChantierKpiTab
              data={{
                avancement: chantier.avancement,
                statut: chantier.statut,
                date_debut: chantier.date_debut,
                date_fin: chantier.date_fin,
                budget: chantier.budgetTotalMAD,
                raids: chantier.raids,
                membres: chantier.membres,
                burnRateTotals: burnRate?.totals ?? null,
                questions: consultationQuestions.map((q) => ({ statut: q.statut, priorite: q.priorite })),
                adherencesSource: chantier.adherencesSource.map((a) => ({ criticite: a.criticite })),
                adherencesDependant: chantier.adherencesDependant.map((a) => ({ criticite: a.criticite })),
                chantierCode: chantier.code,
              }}
            />
          }
          equipeTab={
            <Card>
              <CardHeader>
                <CardTitle>Équipe Chantier</CardTitle>
                <CardDescription>
                  Membres de l&apos;équipe organisés par origine (AMOA, MOE, Sécurité, EI)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EquipeTable
                  membres={chantier.membres}
                  chantierId={chantier.id}
                  directeur={chantier.directeur}
                  rmds={chantier.rmds}
                />
              </CardContent>
            </Card>
          }
          raidTab={
            <Card>
              <CardHeader>
                <CardTitle>RAID</CardTitle>
                <CardDescription>
                  {chantier.raids.length} élément(s) lié(s) à ce chantier
                </CardDescription>
                <CardAction>
                  <AddRaidButton defaultChantierId={chantier.id} />
                </CardAction>
              </CardHeader>
              <CardContent>
                <RaidList items={chantier.raids} initialRaidScope="all" />
              </CardContent>
            </Card>
          }
          consultationTab={
            <ChantierConsultationTab
              questions={consultationQuestions}
              chantierId={chantier.id}
            />
          }
          consultationCount={consultationQuestions.length}
          adherencesTab={
            <ChantierAdherencesTab
              asSource={chantier.adherencesSource}
              asDependant={chantier.adherencesDependant}
              chantierCode={chantier.code}
              chantierId={chantier.id}
            />
          }
          adherencesCount={chantier.adherencesSource.length + chantier.adherencesDependant.length}
          capaciteTab={<ChantierCapaciteTab data={burnRate} />}
          jalonsTab={
            <ChantierJalonsTab
              jalons={chantier.jalons}
              chantierId={chantier.id}
              dateDebut={chantier.date_debut}
              dateFin={chantier.date_fin}
              workflowCaps={jalonWorkflow.caps}
              pendingByEntityId={jalonWorkflow.pendingByEntityId}
              pendingCreatesCount={jalonWorkflow.pendingCreates.length}
            />
          }
          jalonsCount={chantier.jalons.length}
        />
      </main>
    </div>
  );
}
