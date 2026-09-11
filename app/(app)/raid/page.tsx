import { getRaidItems, getStatusConfigs, getRaidFieldOptions, getChantiersForSelect, getComitesForSelect } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";

interface Props {
  searchParams: Promise<{ scope?: string }>;
}

export default async function RaidPage({ searchParams }: Props) {
  const params = await searchParams;
  const [items, statusConfigs, fieldOptions, chantiers, comites] = await Promise.all([
    getRaidItems(),
    getStatusConfigs(),
    getRaidFieldOptions().catch(() => []),
    getChantiersForSelect().catch(() => []),
    getComitesForSelect().catch(() => []),
  ]);
  const initialRaidScope = params.scope === "all" ? "all" : "mine";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RAID</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} élément(s) — Risques, Actions, Informations, Décisions
            </p>
          </div>
          <AddRaidButton />
        </div>
        <Card>
          <CardContent className="pt-6">
            <RaidList
              items={items}
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
