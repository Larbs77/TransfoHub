"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getCapaciteGlobale } from "@/app/(app)/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getRAGColor, getRAGStatus, MOIS_LABELS, RAG_COLORS, RAG_LABELS } from "@/lib/capacite-labels";
import { RESSOURCE_TYPE_COLORS } from "@/lib/ressource-labels";

type CapaciteData = Awaited<ReturnType<typeof getCapaciteGlobale>>;

interface Props {
  initialData: CapaciteData;
  initialYear: number;
}

export function CapaciteHeatmap({ initialData, initialYear }: Props) {
  const [data, setData] = useState(initialData);
  const [year, setYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  async function changeYear(newYear: number) {
    setLoading(true);
    setYear(newYear);
    const newData = await getCapaciteGlobale(newYear);
    setData(newData);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (search && !r.nom_complet.toLowerCase().includes(search.toLowerCase()) &&
          !r.organisation.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all" && r.type !== filterType) return false;
      return true;
    }).sort((a, b) => b.avgCharge - a.avgCharge);
  }, [data, search, filterType]);

  // Summary stats
  const overloaded = filtered.filter((r) => r.avgCharge > 100).length;
  const loaded = filtered.filter((r) => r.avgCharge >= 80 && r.avgCharge <= 100).length;
  const available = filtered.filter((r) => r.avgCharge > 0 && r.avgCharge < 80).length;

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{filtered.length}</div>
            <p className="text-xs text-muted-foreground">Ressources actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold" style={{ color: RAG_COLORS.red }}>{overloaded}</div>
            <p className="text-xs text-muted-foreground">Surchargées (&gt;100%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold" style={{ color: RAG_COLORS.orange }}>{loaded}</div>
            <p className="text-xs text-muted-foreground">Chargées (80-100%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold" style={{ color: RAG_COLORS.green }}>{available}</div>
            <p className="text-xs text-muted-foreground">Disponibles (&lt;80%)</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-4">
              <Button variant="outline" size="icon-xs" onClick={() => changeYear(year - 1)} disabled={loading || year <= 2026}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-lg font-bold tabular-nums">{year}</span>
              <Button variant="outline" size="icon-xs" onClick={() => changeYear(year + 1)} disabled={loading || year >= 2030}>
                <ChevronRight className="size-4" />
              </Button>
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-48"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="Interne">Interne</SelectItem>
                  <SelectItem value="Externe">Externe</SelectItem>
                  <SelectItem value="Consultant">Consultant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded" style={{ backgroundColor: RAG_COLORS.green }} />
              {RAG_LABELS.green} (&lt;80%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded" style={{ backgroundColor: RAG_COLORS.orange }} />
              {RAG_LABELS.orange} (80-100%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded" style={{ backgroundColor: RAG_COLORS.red }} />
              {RAG_LABELS.red} (&gt;100%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded" style={{ backgroundColor: RAG_COLORS.gray }} />
              {RAG_LABELS.gray}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Aucune ressource trouvée</p>
          ) : (
            <div className="overflow-x-auto">
              <TooltipProvider delayDuration={200}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left font-medium min-w-[180px]">Ressource</th>
                      <th className="py-2 px-1 text-center font-medium w-10">Type</th>
                      <th className="py-2 px-1 text-center font-medium w-12">Moy.</th>
                      {MOIS_LABELS.map((m, i) => (
                        <th key={i} className="py-2 px-1 text-center font-medium w-12">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-1.5 pr-4">
                          <Link href={`/ressources/${r.id}`} className="hover:underline font-medium text-xs">
                            {r.nom_complet}
                          </Link>
                          {r.organisation && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                              ({r.organisation})
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <Badge className="text-[9px] px-1" style={{ backgroundColor: RESSOURCE_TYPE_COLORS[r.type], color: "white" }}>
                            {r.type.charAt(0)}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: getRAGColor(r.avgCharge) }}
                          >
                            {r.avgCharge}%
                          </span>
                        </td>
                        {r.months.map((m, i) => {
                          const status = getRAGStatus(m.charge_pct);
                          return (
                            <td key={i} className="py-1.5 px-0.5 text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="mx-auto flex size-8 items-center justify-center rounded text-[10px] font-semibold cursor-default transition-transform hover:scale-110"
                                    style={{
                                      backgroundColor: getRAGColor(m.charge_pct),
                                      color: status === "gray" ? "#6b7280" : "white",
                                    }}
                                  >
                                    {m.charge_pct > 0 ? `${m.charge_pct}` : "—"}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p className="font-bold">{r.nom_complet} — {MOIS_LABELS[i]} {year}</p>
                                  <p>Charge : {m.charge_pct}%</p>
                                  <p>Planifié : {m.jours_planifies} j</p>
                                  <p>Travaillé : {m.jours_travailles} j</p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
