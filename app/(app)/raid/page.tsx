import { getRaidItems, getStatusConfigs } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";

export default async function RaidPage() {
  const [items, statusConfigs] = await Promise.all([
    getRaidItems(),
    getStatusConfigs(),
  ]);

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
            <RaidList items={items} statusConfigs={statusConfigs} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
