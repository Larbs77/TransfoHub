import { getRaidItems, getStatusConfigs, getRaidFieldOptions } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";

interface Props {
  searchParams: Promise<{ statut?: string; scope?: string }>;
}

export default async function RaidDecisionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [items, statusConfigs, fieldOptions] = await Promise.all([
    getRaidItems("Décision"),
    getStatusConfigs(),
    getRaidFieldOptions().catch(() => []),
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
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
