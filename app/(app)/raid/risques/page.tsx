import { requirePageAccess } from "@/lib/auth";
import { getRaidItems, getStatusConfigs, getRaidFieldOptions, getChantiersForSelect, getComitesForSelect } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";
import { isRisqueAttention } from "@/lib/raid-labels";

interface Props {
  searchParams: Promise<{
    prob?: string;
    impact?: string;
    risque?: string;
    maitrise?: string;
    statut?: string;
    critical?: string;
    scope?: string;
  }>;
}

export default async function RaidRisquesPage({ searchParams }: Props) {
  await requirePageAccess("/raid");
  const params = await searchParams;
  const [items, statusConfigs, fieldOptions, chantiers, comites] = await Promise.all([
    getRaidItems("Risque", { includeDeleted: true }),
    getStatusConfigs(),
    getRaidFieldOptions().catch(() => []),
    getChantiersForSelect().catch(() => []),
    getComitesForSelect().catch(() => []),
  ]);
  const criticalCount = items.filter((r) => isRisqueAttention(r)).length;

  const initialProb = params.prob ? Number(params.prob) : undefined;
  const initialImpact = params.impact ? Number(params.impact) : undefined;
  const initialRisque = params.risque || undefined;
  const initialMaitrise = params.maitrise || undefined;
  const initialStatut = params.statut || undefined;
  const initialCritical = params.critical === "true" || undefined;
  const initialRaidScope = params.scope === "all" ? "all" : "mine";

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
              initialRisque={initialRisque}
              initialMaitrise={initialMaitrise}
              initialStatut={initialStatut}
              initialCritical={initialCritical}
              initialRaidScope={initialRaidScope}
              statusConfigs={statusConfigs}
              fieldOptions={fieldOptions}
              chantiers={chantiers}
              comites={comites}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
