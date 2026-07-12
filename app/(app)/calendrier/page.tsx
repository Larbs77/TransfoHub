import { getRaidItems, getComites } from "@/app/(app)/actions";
import { getComiteParametresForSelect } from "@/app/(app)/admin/comites-parametres/actions";
import { CalendarPageClient } from "@/components/calendar-page-client";

export default async function CalendrierPage() {
  const [raidItems, comites, instances] = await Promise.all([
    getRaidItems(),
    getComites().catch(() => []),
    getComiteParametresForSelect().catch(() => []),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Calendrier</h1>
        </div>
        <CalendarPageClient
          raidItems={raidItems}
          comites={comites}
          instances={instances}
        />
      </main>
    </div>
  );
}
