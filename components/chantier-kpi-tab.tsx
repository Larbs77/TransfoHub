"use client";

import { useState } from "react";
import {
  Users,
  Zap,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  CheckCircle2,
  Clock,
  Shield,
  Hourglass,
  BarChart3,
  UsersRound,
  Coins,
  Gauge,
  HelpCircle,
  AlertCircle,
  Link2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { scoreCriticite } from "@/lib/utils-pmo";

interface RaidItem {
  type: string;
  statut: string;
  probabilite: number | null;
  impact: number | null;
  mitigation: string;
  date_echeance: Date | null;
}

interface MembreItem {
  equipe: string;
}

interface BurnRateTotals {
  cout_reel: number;
  cout_planifie: number;
  jours_reels: number;
  jours_planifies: number;
  taux_consommation: number;
}

interface QuestionItem {
  statut: string;
  priorite: string;
}

interface AdherenceItem {
  criticite: string;
}

interface KpiData {
  avancement: number;
  statut: string;
  date_debut: Date;
  date_fin: Date;
  budget: number;
  raids: RaidItem[];
  membres: MembreItem[];
  burnRateTotals: BurnRateTotals | null;
  questions: QuestionItem[];
  adherencesSource: AdherenceItem[];
  adherencesDependant: AdherenceItem[];
  chantierCode: string;
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
  variant?: "success" | "warning" | "danger" | "neutral";
}

const EQUIPE_TYPES = ["AMOA", "MOE", "Métiers", "Sécurité", "EI"];

function KpiCard({ icon, label, value, subtitle, color, variant = "neutral" }: KpiCardProps) {
  const variantBg = {
    success: "bg-emerald-50 dark:bg-emerald-950/30",
    warning: "bg-amber-50 dark:bg-amber-950/30",
    danger: "bg-red-50 dark:bg-red-950/30",
    neutral: "bg-muted/30",
  }[variant];

  const variantText = {
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
    neutral: "",
  }[variant];

  return (
    <Card className={`${variantBg} border`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${variantText}`}>{value}</p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className="rounded-lg p-2 shrink-0"
            style={{ backgroundColor: color + "18" }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChantierKpiTab({ data }: { data: KpiData }) {
  const [now] = useState(() => new Date());

  const actions = data.raids.filter((r) => r.type === "Action");
  const risks = data.raids.filter((r) => r.type === "Risque");
  const decisions = data.raids.filter((r) => r.type === "Décision");

  // --- Schedule & Progress ---
  const dateDebut = new Date(data.date_debut);
  const dateFin = new Date(data.date_fin);
  const totalDays = Math.max((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24), 1);
  const elapsedDays = Math.max((now.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24), 0);
  const timeElapsedPct = Math.min((elapsedDays / totalDays) * 100, 100);
  const spi = timeElapsedPct > 0 ? data.avancement / timeElapsedPct : data.avancement > 0 ? 2 : 1;
  const spiRounded = Math.round(spi * 100) / 100;

  const daysRemaining = Math.max(Math.ceil((dateFin.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)), 0);

  // --- Actions ---
  const activeActions = actions.filter((a) => a.statut !== "Clôturé" && a.statut !== "Abandonné");
  const closedActions = actions.filter((a) => a.statut === "Clôturé");
  const actionCompletionRate = actions.length > 0
    ? Math.round((closedActions.length / actions.length) * 100)
    : 0;
  const overdueActions = activeActions.filter(
    (a) => a.date_echeance && new Date(a.date_echeance) < now
  );

  // --- Risks ---
  const openRisks = risks.filter((r) => r.statut !== "Clos");
  const criticalRisks = risks.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
  );
  const avgCriticite = openRisks.length > 0
    ? Math.round(
        openRisks
          .filter((r) => r.probabilite && r.impact)
          .reduce((sum, r) => sum + scoreCriticite(r.impact!, r.probabilite!), 0) /
          Math.max(openRisks.filter((r) => r.probabilite && r.impact).length, 1) * 10
      ) / 10
    : 0;
  const risksWithMitigation = openRisks.filter((r) => r.mitigation && r.mitigation.trim() !== "");
  const mitigationRate = openRisks.length > 0
    ? Math.round((risksWithMitigation.length / openRisks.length) * 100)
    : 100;

  // --- Decisions ---
  const pendingDecisions = decisions.filter((d) => d.statut === "En attente");

  // --- Capacités & Coûts ---
  const bt = data.burnRateTotals;
  const budgetMAD = data.budget;
  const coutReel = bt?.cout_reel ?? 0;
  const joursReels = bt?.jours_reels ?? 0;
  const joursPlanifies = bt?.jours_planifies ?? 0;
  const tauxConsommation = bt?.taux_consommation ?? 0;

  // --- Q&A ---
  const totalQuestions = data.questions.length;
  const questionsOuvertes = data.questions.filter((q) => q.statut === "Ouverte").length;
  const questionsCritiques = data.questions.filter((q) => q.priorite === "Critique" && q.statut === "Ouverte").length;

  // --- Adhérences ---
  const totalAdherences = data.adherencesSource.length + data.adherencesDependant.length;
  const adherencesSource = data.adherencesSource.length;
  const adherencesDependant = data.adherencesDependant.length;
  const adherencesBloquantes = [...data.adherencesSource, ...data.adherencesDependant].filter(
    (a) => a.criticite === "BLOQUANTE"
  ).length;

  // --- Team ---
  const equipesCovered = EQUIPE_TYPES.filter((eq) =>
    data.membres.some((m) => m.equipe === eq)
  );

  return (
    <div className="space-y-6">
      {/* Schedule & Progress */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Planification & Avancement
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            icon={<TrendingUp className="size-5" />}
            label="SPI"
            value={spiRounded}
            subtitle={
              spiRounded >= 1
                ? "Dans les temps"
                : spiRounded >= 0.8
                  ? "Léger retard"
                  : "En retard"
            }
            color="#2563eb"
            variant={spiRounded >= 1 ? "success" : spiRounded >= 0.8 ? "warning" : "danger"}
          />
          <KpiCard
            icon={<BarChart3 className="size-5" />}
            label="Avancement"
            value={`${data.avancement}%`}
            subtitle={`Temps écoulé: ${Math.round(timeElapsedPct)}%`}
            color="#8b5cf6"
            variant={
              data.avancement >= timeElapsedPct
                ? "success"
                : data.avancement >= timeElapsedPct * 0.8
                  ? "warning"
                  : "danger"
            }
          />
          <KpiCard
            icon={<CalendarClock className="size-5" />}
            label="Jours Restants"
            value={daysRemaining}
            subtitle={daysRemaining === 0 ? "Échéance atteinte" : `sur ${Math.round(totalDays)}j au total`}
            color="#0891b2"
            variant={daysRemaining > 30 ? "neutral" : daysRemaining > 7 ? "warning" : "danger"}
          />
          <KpiCard
            icon={<Users className="size-5" />}
            label="Membres"
            value={data.membres.length}
            subtitle={`${equipesCovered.length}/${EQUIPE_TYPES.length} équipes`}
            color="#2563eb"
            variant="neutral"
          />
        </div>
      </div>

      {/* Capacités & Coûts */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Capacités & Coûts
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            icon={<Coins className="size-5" />}
            label="Budget"
            value={budgetMAD > 0 ? `${(budgetMAD / 1_000_000).toFixed(1)}M` : "—"}
            subtitle="MAD"
            color="#f59e0b"
            variant="neutral"
          />
          <KpiCard
            icon={<Gauge className="size-5" />}
            label="Coût Réel"
            value={coutReel > 0 ? `${(coutReel / 1_000_000).toFixed(1)}M` : "—"}
            subtitle="MAD"
            color="#f97316"
            variant={budgetMAD > 0 && coutReel > budgetMAD ? "danger" : coutReel > budgetMAD * 0.8 ? "warning" : "neutral"}
          />
          <KpiCard
            icon={<CalendarClock className="size-5" />}
            label="Jours Planifiés"
            value={joursPlanifies}
            subtitle={`${joursReels} réels`}
            color="#0891b2"
            variant="neutral"
          />
          <KpiCard
            icon={<TrendingUp className="size-5" />}
            label="Taux Consommation"
            value={`${tauxConsommation}%`}
            subtitle={tauxConsommation === 0 ? "Aucune donnée" : tauxConsommation > 100 ? "Dépassement" : "Dans le budget"}
            color="#7c3aed"
            variant={tauxConsommation === 0 ? "neutral" : tauxConsommation <= 80 ? "success" : tauxConsommation <= 100 ? "warning" : "danger"}
          />
        </div>
      </div>

      {/* Actions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Actions
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            icon={<Zap className="size-5" />}
            label="Total Actions"
            value={actions.length}
            subtitle={`${activeActions.length} en cours`}
            color="#f59e0b"
            variant="neutral"
          />
          <KpiCard
            icon={<CheckCircle2 className="size-5" />}
            label="Taux Complétion"
            value={`${actionCompletionRate}%`}
            subtitle={`${closedActions.length}/${actions.length} clôturées`}
            color="#10b981"
            variant={actionCompletionRate >= 70 ? "success" : actionCompletionRate >= 40 ? "warning" : "neutral"}
          />
          <KpiCard
            icon={<Clock className="size-5" />}
            label="Actions en Retard"
            value={overdueActions.length}
            subtitle={
              overdueActions.length === 0
                ? "Aucun retard"
                : `sur ${activeActions.length} actives`
            }
            color="#ef4444"
            variant={overdueActions.length === 0 ? "success" : overdueActions.length <= 2 ? "warning" : "danger"}
          />
          <KpiCard
            icon={<Hourglass className="size-5" />}
            label="Décisions en Attente"
            value={pendingDecisions.length}
            subtitle={
              pendingDecisions.length === 0
                ? "Aucune en attente"
                : "Peut bloquer l'avancement"
            }
            color="#7c3aed"
            variant={pendingDecisions.length === 0 ? "success" : pendingDecisions.length <= 2 ? "warning" : "danger"}
          />
        </div>
      </div>

      {/* Risks */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Risques
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            icon={<ShieldAlert className="size-5" />}
            label="Risques Ouverts"
            value={openRisks.length}
            subtitle={`${risks.length} au total`}
            color="#7c3aed"
            variant="neutral"
          />
          <KpiCard
            icon={<AlertTriangle className="size-5" />}
            label="Risques Critiques"
            value={criticalRisks.length}
            subtitle={criticalRisks.length === 0 ? "Aucun risque critique" : "Score >= 12"}
            color="#ef4444"
            variant={criticalRisks.length === 0 ? "success" : "danger"}
          />
          <KpiCard
            icon={<BarChart3 className="size-5" />}
            label="Score Risque Moyen"
            value={avgCriticite}
            subtitle={
              avgCriticite === 0
                ? "Aucun risque évalué"
                : avgCriticite < 6
                  ? "Niveau faible"
                  : avgCriticite < 12
                    ? "Niveau modéré"
                    : "Niveau élevé"
            }
            color="#f97316"
            variant={avgCriticite === 0 ? "neutral" : avgCriticite < 6 ? "success" : avgCriticite < 12 ? "warning" : "danger"}
          />
          <KpiCard
            icon={<Shield className="size-5" />}
            label="Taux Mitigation"
            value={`${mitigationRate}%`}
            subtitle={`${risksWithMitigation.length}/${openRisks.length} mitigés`}
            color="#10b981"
            variant={mitigationRate >= 70 ? "success" : mitigationRate >= 40 ? "warning" : "danger"}
          />
        </div>
      </div>

      {/* Q&A */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Q&A
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KpiCard
            icon={<HelpCircle className="size-5" />}
            label="Total Questions"
            value={totalQuestions}
            subtitle={`${questionsOuvertes} ouverte(s)`}
            color="#0ea5e9"
            variant="neutral"
          />
          <KpiCard
            icon={<Clock className="size-5" />}
            label="Ouvertes"
            value={questionsOuvertes}
            subtitle={questionsOuvertes === 0 ? "Tout traité" : "En attente de réponse"}
            color="#f97316"
            variant={questionsOuvertes === 0 ? "success" : questionsOuvertes <= 3 ? "warning" : "danger"}
          />
          <KpiCard
            icon={<AlertCircle className="size-5" />}
            label="Critiques Ouvertes"
            value={questionsCritiques}
            subtitle={questionsCritiques === 0 ? "Aucune critique" : "Priorité haute"}
            color="#ef4444"
            variant={questionsCritiques === 0 ? "success" : "danger"}
          />
        </div>
      </div>

      {/* Adhérences */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Adhérences
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            icon={<Link2 className="size-5" />}
            label="Total Adhérences"
            value={totalAdherences}
            subtitle={`${adherencesSource} sortantes, ${adherencesDependant} entrantes`}
            color="#6366f1"
            variant="neutral"
          />
          <KpiCard
            icon={<ArrowRight className="size-5" />}
            label={`Dépendent de ${data.chantierCode}`}
            value={adherencesSource}
            subtitle="Sortantes"
            color="#f97316"
            variant="neutral"
          />
          <KpiCard
            icon={<ArrowLeft className="size-5" />}
            label={`${data.chantierCode} dépend de`}
            value={adherencesDependant}
            subtitle="Entrantes"
            color="#3b82f6"
            variant="neutral"
          />
          <KpiCard
            icon={<AlertTriangle className="size-5" />}
            label="Bloquantes"
            value={adherencesBloquantes}
            subtitle={adherencesBloquantes === 0 ? "Aucune bloquante" : "Attention requise"}
            color="#ef4444"
            variant={adherencesBloquantes === 0 ? "success" : "danger"}
          />
        </div>
      </div>

      {/* Team Coverage */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Couverture Équipe
        </h3>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              {EQUIPE_TYPES.map((eq) => {
                const count = data.membres.filter((m) => m.equipe === eq).length;
                const covered = count > 0;
                return (
                  <div
                    key={eq}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      covered
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                        : "bg-muted/30 border-dashed"
                    }`}
                  >
                    <UsersRound
                      className={`size-4 ${covered ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                    />
                    <span className={covered ? "font-medium" : "text-muted-foreground"}>
                      {eq}
                    </span>
                    <span
                      className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        covered
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
