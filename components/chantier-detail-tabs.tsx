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

const TAB_COLORS = {
  equipe: "#2563eb",
  raid: "#7c3aed",
  kpi: "#10b981",
  capacite: "#f59e0b",
  jalons: "#6366f1",
  adherences: "#f97316",
  consultation: "#0ea5e9",
} as const;

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
      <TabsList>
        <TabsTrigger value="kpi" className="gap-2">
          <BarChart3 className="size-4" style={{ color: TAB_COLORS.kpi }} />
          Indicateurs
        </TabsTrigger>
        <TabsTrigger value="equipe" className="gap-2">
          <Users className="size-4" style={{ color: TAB_COLORS.equipe }} />
          Équipe Chantier
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: TAB_COLORS.equipe }}
          >
            {membresCount}
          </span>
        </TabsTrigger>
        <TabsTrigger value="raid" className="gap-2">
          <ShieldAlert className="size-4" style={{ color: TAB_COLORS.raid }} />
          RAID
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: TAB_COLORS.raid }}
          >
            {raidCount}
          </span>
        </TabsTrigger>
        {consultationTab && (
          <TabsTrigger value="consultation" className="gap-2">
            <HelpCircle className="size-4" style={{ color: TAB_COLORS.consultation }} />
            Backlog Consultation
            {(consultationCount ?? 0) > 0 && (
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: TAB_COLORS.consultation }}
              >
                {consultationCount}
              </span>
            )}
          </TabsTrigger>
        )}
        {adherencesTab && (
          <TabsTrigger value="adherences" className="gap-2">
            <Link2 className="size-4" style={{ color: TAB_COLORS.adherences }} />
            Adhérences
            {(adherencesCount ?? 0) > 0 && (
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: TAB_COLORS.adherences }}
              >
                {adherencesCount}
              </span>
            )}
          </TabsTrigger>
        )}
        {capaciteTab && (
          <TabsTrigger value="capacite" className="gap-2">
            <Coins className="size-4" style={{ color: TAB_COLORS.capacite }} />
            Capacité & Coûts
          </TabsTrigger>
        )}
        {jalonsTab && (
          <TabsTrigger value="jalons" className="gap-2">
            <Milestone className="size-4" style={{ color: TAB_COLORS.jalons }} />
            Jalons
            <span
              className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: TAB_COLORS.jalons }}
            >
              {jalonsCount ?? 0}
            </span>
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
