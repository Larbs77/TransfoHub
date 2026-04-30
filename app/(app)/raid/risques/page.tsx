import { getRaidItems, getStatusConfigs } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";
import { scoreCriticite } from "@/lib/utils-pmo";

interface Props {
  searchParams: Promise<{ prob?: string; impact?: string; statut?: string; critical?: string }>;
}

export default async function RaidRisquesPage({ searchParams }: Props) {
  const params = await searchParams;
  const [items, statusConfigs] = await Promise.all([
    getRaidItems("Risque"),
    getStatusConfigs(),
  ]);
  const criticalCount = items.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
  ).length;

  const initialProb = params.prob ? Number(params.prob) : undefined;
  const initialImpact = params.impact ? Number(params.impact) : undefined;
  const initialStatut = params.statut || undefined;
  const initialCritical = params.critical === "true" || undefined;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Risques</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} risque(s) — {criticalCount} critique(s)
            </p>
          </div>
          <AddRaidButton defaultType="Risque" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <RaidList
              items={items}
              filterType="Risque"
              initialProbabilite={initialProb}
              initialImpact={initialImpact}
              initialStatut={initialStatut}
              initialCritical={initialCritical}
              statusConfigs={statusConfigs}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
