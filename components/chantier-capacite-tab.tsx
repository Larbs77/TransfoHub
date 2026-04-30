"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getRAGColor } from "@/lib/capacite-labels";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface BurnRateData {
  chantier: { id: string; code: string; nom: string; budget: number };
  monthlyBurn: {
    label: string;
    jours_planifies: number;
    jours_reels: number;
    cout_planifie: number;
    cout_reel: number;
  }[];
  teamDetails: {
    id: string;
    nom_complet: string;
    equipe: string;
    role: string;
    charge_pourcentage: number;
    tarif_journalier: number;
    jours_travailles: number;
    cout_reel: number;
  }[];
  totals: {
    cout_reel: number;
    cout_planifie: number;
    jours_reels: number;
    jours_planifies: number;
    taux_consommation: number;
  };
}

interface Props {
  data: BurnRateData | null;
}

export function ChantierCapaciteTab({ data }: Props) {
  if (!data) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Aucune donnée de capacité disponible
      </p>
    );
  }

  const { chantier, monthlyBurn, teamDetails, totals } = data;

  // Build cumulative data for chart
  const cumulativeData = monthlyBurn.reduce<
    { label: string; planifie_cumul: number; reel_cumul: number; cout_planifie_cumul: number; cout_reel_cumul: number }[]
  >((acc, m) => {
    const prev = acc[acc.length - 1] ?? { planifie_cumul: 0, reel_cumul: 0, cout_planifie_cumul: 0, cout_reel_cumul: 0 };
    acc.push({
      label: m.label,
      planifie_cumul: Math.round((prev.planifie_cumul + m.jours_planifies) * 10) / 10,
      reel_cumul: Math.round((prev.reel_cumul + m.jours_reels) * 10) / 10,
      cout_planifie_cumul: prev.cout_planifie_cumul + m.cout_planifie,
      cout_reel_cumul: prev.cout_reel_cumul + m.cout_reel,
    });
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {chantier.budget > 0 ? `${(chantier.budget / 1_000_000).toFixed(1)}M` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Budget (MAD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {totals.cout_reel > 0 ? `${(totals.cout_reel / 1_000_000).toFixed(2)}M` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Coût réel (MAD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold tabular-nums">
              {totals.jours_planifies}
            </div>
            <p className="text-xs text-muted-foreground">Jours planifiés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold tabular-nums">
              {totals.jours_reels}
            </div>
            <p className="text-xs text-muted-foreground">Jours réels</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ color: getRAGColor(totals.taux_consommation) }}
            >
              {totals.taux_consommation}%
            </div>
            <p className="text-xs text-muted-foreground">Taux consommation</p>
          </CardContent>
        </Card>
      </div>

      {/* Burn Rate Charts */}
      {cumulativeData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Jours cumulés — Planifié vs Réel</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="planifie_cumul" name="Planifié" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reel_cumul" name="Réel" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Coûts cumulés — Planifié vs Réel (MAD)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `${Number(v).toLocaleString("fr-MA")} MAD`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="cout_planifie_cumul" name="Coût planifié" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cout_reel_cumul" name="Coût réel" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Team Allocation Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Allocation équipe</CardTitle>
        </CardHeader>
        <CardContent>
          {teamDetails.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground text-sm">
              Aucune ressource liée avec tarif journalier
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Équipe</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="text-center">Charge %</TableHead>
                  <TableHead className="text-right">TJM</TableHead>
                  <TableHead className="text-right">Jours travaillés</TableHead>
                  <TableHead className="text-right">Coût réel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamDetails.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{t.nom_complet}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{t.equipe}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.role}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px] tabular-nums">
                        {t.charge_pourcentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {t.tarif_journalier > 0 ? `${(t.tarif_journalier / 1000).toFixed(0)}k` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{t.jours_travailles}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {t.cout_reel > 0 ? `${(t.cout_reel / 1000).toFixed(0)}k` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
