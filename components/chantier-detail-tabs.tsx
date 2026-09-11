"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldAlert, BarChart3, Coins, Milestone, Link2, HelpCircle } from "lucide-react";

interface Props {
  equipeTab: React.ReactNode;
  raidTab: React.ReactNode;
  kpiTab: React.ReactNode;
  capaciteTab?: React.ReactNode;
  jalonsTab?: React.ReactNode;
  adherencesTab?: React.ReactNode;
  consultationTab?: React.ReactNode;
  membresCount: number;
  raidCount: number;
  jalonsCount?: number;
  adherencesCount?: number;
  consultationCount?: number;
}

const TAB_TRIGGER_CLASS = [
  "group/tab relative h-auto flex-none overflow-hidden rounded-xl border bg-card/95 px-3 py-2 shadow-sm",
  "text-sm font-medium text-foreground/70",
  "transition-[transform,box-shadow,border-color,background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
  "hover:-translate-y-1 hover:scale-[1.03] hover:border-[#00BDBB]/55 hover:text-[#0A3C74]",
  "hover:shadow-lg hover:shadow-[#0A3C74]/12",
  "data-[state=active]:border-[#0A3C74]/40 data-[state=active]:bg-[#0A3C74]/[0.06]",
  "data-[state=active]:text-[#0A3C74] data-[state=active]:shadow-md",
  "dark:hover:text-[#5ad4d2] dark:data-[state=active]:text-[#5ad4d2]",
  "dark:data-[state=active]:border-[#00BDBB]/40 dark:data-[state=active]:bg-[#00BDBB]/10",
  "after:hidden",
].join(" ");

function TabShine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-50 dark:via-white/20"
    />
  );
}

function TabGlow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -inset-px z-0 rounded-[inherit] bg-gradient-to-b from-[#00BDBB]/18 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/tab:opacity-100 group-data-[state=active]/tab:opacity-70"
    />
  );
}

function TabCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative z-10 ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#0A3C74]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0A3C74] transition-colors duration-300 group-hover/tab:bg-[#00BDBB]/20 dark:bg-[#00BDBB]/15 dark:text-[#5ad4d2] group-data-[state=active]/tab:bg-[#0A3C74] group-data-[state=active]/tab:text-white dark:group-data-[state=active]/tab:bg-[#00BDBB] dark:group-data-[state=active]/tab:text-[#0A3C74]">
      {children}
    </span>
  );
}

function TabIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Icon className="relative z-10 size-3.5 shrink-0 text-[#0A3C74] transition-transform duration-300 group-hover/tab:scale-110 dark:text-[#5ad4d2]" />
  );
}

export function ChantierDetailTabs({
  equipeTab,
  raidTab,
  kpiTab,
  capaciteTab,
  jalonsTab,
  adherencesTab,
  consultationTab,
  membresCount,
  raidCount,
  jalonsCount,
  adherencesCount,
  consultationCount,
}: Props) {
  return (
    <Tabs defaultValue="kpi" className="space-y-4">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-2 overflow-visible bg-transparent p-0 py-1">
        <TabsTrigger value="kpi" className={`${TAB_TRIGGER_CLASS} gap-2`}>
          <TabShine />
          <TabGlow />
          <TabIcon icon={BarChart3} />
          <span className="relative z-10">Indicateurs</span>
        </TabsTrigger>
        <TabsTrigger value="equipe" className={`${TAB_TRIGGER_CLASS} gap-2`}>
          <TabShine />
          <TabGlow />
          <TabIcon icon={Users} />
          <span className="relative z-10">Équipe Chantier</span>
          <TabCount>{membresCount}</TabCount>
        </TabsTrigger>
        <TabsTrigger value="raid" className={`${TAB_TRIGGER_CLASS} gap-2`}>
          <TabShine />
          <TabGlow />
          <TabIcon icon={ShieldAlert} />
          <span className="relative z-10">RAID</span>
          <TabCount>{raidCount}</TabCount>
        </TabsTrigger>
        {consultationTab && (
          <TabsTrigger value="consultation" className={`${TAB_TRIGGER_CLASS} gap-2`}>
            <TabShine />
            <TabGlow />
            <TabIcon icon={HelpCircle} />
            <span className="relative z-10">Backlog Consultation</span>
            {(consultationCount ?? 0) > 0 && (
              <TabCount>{consultationCount}</TabCount>
            )}
          </TabsTrigger>
        )}
        {adherencesTab && (
          <TabsTrigger value="adherences" className={`${TAB_TRIGGER_CLASS} gap-2`}>
            <TabShine />
            <TabGlow />
            <TabIcon icon={Link2} />
            <span className="relative z-10">Adhérences</span>
            {(adherencesCount ?? 0) > 0 && (
              <TabCount>{adherencesCount}</TabCount>
            )}
          </TabsTrigger>
        )}
        {capaciteTab && (
          <TabsTrigger value="capacite" className={`${TAB_TRIGGER_CLASS} gap-2`}>
            <TabShine />
            <TabGlow />
            <TabIcon icon={Coins} />
            <span className="relative z-10">Capacité & Coûts</span>
          </TabsTrigger>
        )}
        {jalonsTab && (
          <TabsTrigger value="jalons" className={`${TAB_TRIGGER_CLASS} gap-2`}>
            <TabShine />
            <TabGlow />
            <TabIcon icon={Milestone} />
            <span className="relative z-10">Jalons</span>
            <TabCount>{jalonsCount ?? 0}</TabCount>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="kpi">{kpiTab}</TabsContent>
      <TabsContent value="equipe">{equipeTab}</TabsContent>
      <TabsContent value="raid">{raidTab}</TabsContent>
      {consultationTab && <TabsContent value="consultation">{consultationTab}</TabsContent>}
      {adherencesTab && <TabsContent value="adherences">{adherencesTab}</TabsContent>}
      {capaciteTab && <TabsContent value="capacite">{capaciteTab}</TabsContent>}
      {jalonsTab && <TabsContent value="jalons">{jalonsTab}</TabsContent>}
    </Tabs>
  );
}
