import { getRaidItems, getStatusConfigs, getRaidFieldOptions } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";

interface Props {
  searchParams: Promise<{ scope?: string }>;
}

export default async function RaidInformationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [items, statusConfigs, fieldOptions] = await Promise.all([
    getRaidItems("Information"),
    getStatusConfigs(),
    getRaidFieldOptions().catch(() => []),
  ]);
  const initialRaidScope = params.scope === "all" ? "all" : "mine";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Informations</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} information(s)
            </p>
          </div>
          <AddRaidButton defaultType="Information" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <RaidList
              items={items}
              filterType="Information"
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
