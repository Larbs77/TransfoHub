"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Presentation, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDashboardCTP, getDashboardCTR } from "@/app/(app)/actions";
import { DashboardCTP } from "@/components/dashboard-ctp";
import { DashboardCTR } from "@/components/dashboard-ctr";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function DashboardsPage() {
  const [now] = useState(() => new Date());
  const [tab, setTab] = useState("ctp");

  // CTP state
  const [ctpMonth, setCtpMonth] = useState(String(now.getMonth() + 1));
  const [ctpYear, setCtpYear] = useState(String(now.getFullYear()));
  const [ctpData, setCtpData] = useState<Awaited<ReturnType<typeof getDashboardCTP>> | null>(null);
  const [ctpLoading, setCtpLoading] = useState(false);

  // CTR state
  const [ctrStart, setCtrStart] = useState(format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
  const [ctrEnd, setCtrEnd] = useState(format(now, "yyyy-MM-dd"));
  const [ctrData, setCtrData] = useState<Awaited<ReturnType<typeof getDashboardCTR>> | null>(null);
  const [ctrLoading, setCtrLoading] = useState(false);

  const generateCTP = async () => {
    setCtpLoading(true);
    try {
      const data = await getDashboardCTP(Number(ctpMonth), Number(ctpYear));
      setCtpData(data);
    } finally {
      setCtpLoading(false);
    }
  };

  const generateCTR = async () => {
    setCtrLoading(true);
    try {
      const data = await getDashboardCTR(ctrStart, ctrEnd);
      setCtrData(data);
    } finally {
      setCtrLoading(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Presentation className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dashboards Gouvernance</h1>
            <p className="text-sm text-muted-foreground">
              Générer les tableaux de bord CTP et CTR
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="ctp">Dashboard CTP</TabsTrigger>
            <TabsTrigger value="ctr">Dashboard CTR</TabsTrigger>
          </TabsList>

          <TabsContent value="ctp" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comité de Transformation Programme (CTP)</CardTitle>
                <CardDescription>
                  Dashboard mensuel — sélectionnez le mois et l&apos;année
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Mois</label>
                    <Select value={ctpMonth} onValueChange={setCtpMonth}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Année</label>
                    <Select value={ctpYear} onValueChange={setCtpYear}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={generateCTP} disabled={ctpLoading}>
                    <CalendarDays className="size-4 mr-2" />
                    {ctpLoading ? "Génération..." : "Générer"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {ctpData && <DashboardCTP data={ctpData} />}
          </TabsContent>

          <TabsContent value="ctr" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comité de Transformation Restreint (CTR)</CardTitle>
                <CardDescription>
                  Dashboard périodique — sélectionnez la période
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Du</label>
                    <Input
                      type="date"
                      value={ctrStart}
                      onChange={(e) => setCtrStart(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Au</label>
                    <Input
                      type="date"
                      value={ctrEnd}
                      onChange={(e) => setCtrEnd(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <Button onClick={generateCTR} disabled={ctrLoading}>
                    <CalendarDays className="size-4 mr-2" />
                    {ctrLoading ? "Génération..." : "Générer"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {ctrData && <DashboardCTR data={ctrData} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
