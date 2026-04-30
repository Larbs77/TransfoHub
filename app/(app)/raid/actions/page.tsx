import { getRaidItems, getStatusConfigs } from "@/app/(app)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { RaidList } from "@/components/raid-list";
import { AddRaidButton } from "@/components/add-raid-button";

interface Props {
  searchParams: Promise<{ statut?: string; overdue?: string }>;
}

export default async function RaidActionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [items, statusConfigs] = await Promise.all([
    getRaidItems("Action"),
    getStatusConfigs(),
  ]);
  const activeCount = items.filter((a) => a.statut !== "Clôturé" && a.statut !== "Abandonné").length;

  const initialStatut = params.statut || undefined;
  const initialOverdue = params.overdue === "true" || undefined;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Actions</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} action(s) — {activeCount} active(s)
            </p>
          </div>
          <AddRaidButton defaultType="Action" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <RaidList
              items={items}
              filterType="Action"
              initialStatut={initialStatut}
              initialOverdue={initialOverdue}
              statusConfigs={statusConfigs}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
