import { requirePageAccess } from "@/lib/auth";
import { getRaidItems, getStatusConfigs, getRaidFieldOptions, getChantiersForSelect, getComitesForSelect } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";

interface Props {
  searchParams: Promise<{ statut?: string; scope?: string }>;
}

export default async function RaidDecisionsPage({ searchParams }: Props) {
  await requirePageAccess("/raid");
  const params = await searchParams;
  const [items, statusConfigs, fieldOptions, chantiers, comites] = await Promise.all([
    getRaidItems("Décision", { includeDeleted: true }),
    getStatusConfigs(),
    getRaidFieldOptions().catch(() => []),
    getChantiersForSelect().catch(() => []),
    getComitesForSelect().catch(() => []),
  ]);

  const initialStatut = params.statut || undefined;
  const initialRaidScope = params.scope === "all" ? "all" : "mine";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Décisions</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} décision(s)
            </p>
          </div>
          <AddRaidButton defaultType="Décision" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <RaidList
              items={items}
              filterType="Décision"
              initialStatut={initialStatut}
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
