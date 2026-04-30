import { getComites } from "@/app/(app)/actions";
import { ComitesList } from "@/components/comites-list";
import { AddComiteButton } from "@/components/add-comite-button";
import { CalendarDays, CalendarClock, History, MailX } from "lucide-react";
import { startOfWeek, endOfWeek, isWithinInterval, isBefore, isAfter } from "date-fns";

export default async function ComitesPage() {
  const allComites = await getComites();

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const thisWeekCount = allComites.filter((c) =>
    isWithinInterval(new Date(c.date), { start: weekStart, end: weekEnd })
  ).length;

  const upcomingCount = allComites.filter((c) =>
    isAfter(new Date(c.date), weekEnd)
  ).length;

  const invitPendingCount = allComites.filter(
    (c) => !c.invitation_envoyee && !isBefore(new Date(c.date), weekStart)
  ).length;

  const kpis = [
    { label: "Total comités", value: allComites.length, icon: CalendarDays, color: "bg-blue-500/10 text-blue-500" },
    { label: "Cette semaine", value: thisWeekCount, icon: CalendarClock, color: "bg-emerald-500/10 text-emerald-500" },
    { label: "À venir", value: upcomingCount, icon: History, color: "bg-amber-500/10 text-amber-500" },
    { label: "Invit. en attente", value: invitPendingCount, icon: MailX, color: "bg-red-500/10 text-red-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Suivi Comités</h1>
            <p className="text-sm text-muted-foreground">
              {allComites.length} comité(s) planifié(s) — {upcomingCount + thisWeekCount} à venir
            </p>
          </div>
          <AddComiteButton />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex items-center gap-3 rounded-lg border p-3">
              <div className={`flex size-9 items-center justify-center rounded-md ${kpi.color}`}>
                <kpi.icon className="size-5" />
              </div>
              <div>
                <p className="text-lg font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        <ComitesList comites={allComites} />
      </main>
    </div>
  );
}
