import { getDashboardStats, getDashboardPMO, getCapaciteGlobale } from "./actions";
import { requireAuth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  StatusPieChart,
  PrioritePieChart,
  ChantierStatutBarChart,
  RaidTypePieChart,
  RiskMatrixChart,
  ChantierTimelineChart,
  OverdueByDomaineChart,
  BudgetByDomaineChart,
  BurndownChart,
  RiskEvolutionChart,
  WorkloadByResponsableChart,
  DomaineHealthRadarChart,
  DecisionTimelineChart,
  ActionCompletionByDomaineChart,
  CapaciteRessourceChart,
} from "@/components/dashboard-charts";
import { KpiCards } from "@/components/kpi-cards";
import { DashboardPMO } from "@/components/dashboard-pmo";

export default async function Home() {
  const session = await requireAuth();
  const isPMO = session.role === "PMO_Chantier";

  if (isPMO) {
    const stats = await getDashboardPMO();
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl space-y-6 p-6">
          <DashboardPMO
            stats={stats}
            dashboardType={session.dashboardType || "complete"}
            nowMs={Date.now()}
          />
        </main>
      </div>
    );
  }

  // Admin / Programme_Office / Workforce_Manager → full dashboard
  const currentYear = new Date().getFullYear();
  const [stats, capaciteData] = await Promise.all([
    getDashboardStats(),
    getCapaciteGlobale(currentYear).catch(() => null),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* KPI Cards */}
        <KpiCards stats={stats} />

        {/* Row 1: Statuts Actions + RAID par Type */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Statuts Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusPieChart statusCounts={stats.statusCounts} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>RAID par Type</CardTitle>
            </CardHeader>
            <CardContent>
              <RaidTypePieChart raidTypeCounts={stats.raidTypeCounts} />
            </CardContent>
          </Card>
        </section>

        {/* Row 2: Chantiers par Priorité + Chantiers par Statut */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Chantiers par Priorité</CardTitle>
            </CardHeader>
            <CardContent>
              <PrioritePieChart prioriteCounts={stats.prioriteCounts} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Chantiers par Statut</CardTitle>
            </CardHeader>
            <CardContent>
              <ChantierStatutBarChart chantierStatutCounts={stats.chantierStatutCounts} />
            </CardContent>
          </Card>
        </section>

        {/* Row 3: Matrice des Risques + Actions échues par Domaine */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Matrice des Risques</CardTitle>
            </CardHeader>
            <CardContent>
              <RiskMatrixChart riskMatrix={stats.riskMatrix} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Actions Échues par Domaine</CardTitle>
            </CardHeader>
            <CardContent>
              <OverdueByDomaineChart overdueByDomaine={stats.overdueByDomaine} />
            </CardContent>
          </Card>
        </section>

        {/* Row 4: Burndown Actions + Évolution des Risques */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Burndown Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <BurndownChart burndownData={stats.burndownData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Évolution des Risques</CardTitle>
            </CardHeader>
            <CardContent>
              <RiskEvolutionChart riskEvolutionData={stats.riskEvolutionData} />
            </CardContent>
          </Card>
        </section>

        {/* Row 5: Charge Ressources + Santé des Domaines */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {capaciteData && (
            <Card>
              <CardHeader>
                <CardTitle>Charge Ressources (RAG)</CardTitle>
              </CardHeader>
              <CardContent>
                <CapaciteRessourceChart capaciteData={capaciteData} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Santé des Domaines</CardTitle>
            </CardHeader>
            <CardContent>
              <DomaineHealthRadarChart healthData={stats.healthData} />
            </CardContent>
          </Card>
        </section>

        {/* Row 6: Tendance Décisions + Taux Complétion Actions */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tendance Décisions</CardTitle>
            </CardHeader>
            <CardContent>
              <DecisionTimelineChart decisionTimelineData={stats.decisionTimelineData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Taux Complétion Actions par Domaine</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionCompletionByDomaineChart actionCompletionByDomaine={stats.actionCompletionByDomaine} />
            </CardContent>
          </Card>
        </section>

        {/* Row 7: Budget par Domaine */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Budget par Domaine (MAD)</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetByDomaineChart budgetByDomaine={stats.budgetByDomaine} />
            </CardContent>
          </Card>
        </section>

        {/* Row 8: Timeline Chantiers (full width) */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline Chantiers</CardTitle>
          </CardHeader>
          <CardContent>
            <ChantierTimelineChart
              chantierTimeline={stats.chantierTimeline}
              nowMs={Date.now()}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
