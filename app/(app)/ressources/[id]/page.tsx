import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getRessourceById, getCapaciteRessource } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, Mail, Phone, Building2, CalendarClock } from "lucide-react";
import {
  RESSOURCE_TYPE_LABELS,
  RESSOURCE_TYPE_COLORS,
} from "@/lib/ressource-labels";
import {
  DOMAINE_LABELS,
  DOMAINE_COLORS,
  STATUT_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
} from "@/lib/chantier-labels";
import { EQUIPE_LABELS, EQUIPE_COLORS } from "@/lib/equipe-labels";
import { getRAGColor, getRAGStatus, RAG_LABELS, MOIS_LABELS } from "@/lib/capacite-labels";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RessourceDetailPage({ params }: Props) {
  const { id } = await params;
  const [ressource, capacite] = await Promise.all([
    getRessourceById(id),
    getCapaciteRessource(id),
  ]);

  if (!ressource) return notFound();

  // Deduplicate chantiers for KPI
  const uniqueChantierIds = new Set(ressource.membres.map((m) => m.chantier.id));
  const activeRaids = ressource.raids.filter(
    (r) => !["Clôturé", "Abandonné", "Clos"].includes(r.statut)
  );

  // Current month charge
  const now = new Date();
  const currentMonthData = capacite?.monthlyData.find(
    (m) => m.annee === now.getFullYear() && m.mois === now.getMonth() + 1
  );
  const currentCharge = currentMonthData?.charge_pct ?? 0;
  const currentMonthWorked = currentMonthData?.jours_travailles ?? 0;

  // Current year heatmap data (12 months)
  const currentYearData = capacite?.monthlyData.filter(
    (m) => m.annee === now.getFullYear()
  ) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge
              style={{
                backgroundColor: RESSOURCE_TYPE_COLORS[ressource.type],
                color: "white",
              }}
            >
              {RESSOURCE_TYPE_LABELS[ressource.type] ?? ressource.type}
            </Badge>
            {ressource.profil && (
              <Badge variant="outline">
                {ressource.profil.nom}
              </Badge>
            )}
            <Badge
              variant={ressource.actif ? "default" : "secondary"}
              className={ressource.actif ? "bg-emerald-500 hover:bg-emerald-600" : ""}
            >
              {ressource.actif ? "Actif" : "Inactif"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ressource.nom_complet}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {ressource.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" />
                {ressource.email}
              </span>
            )}
            {ressource.telephone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3.5" />
                {ressource.telephone}
              </span>
            )}
            {ressource.organisation && (
              <span className="flex items-center gap-1">
                <Building2 className="size-3.5" />
                {ressource.organisation}
              </span>
            )}
          </div>
        </div>

        {/* KPI — 6 cards */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {uniqueChantierIds.size}
              </div>
              <p className="text-xs text-muted-foreground">Chantiers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{activeRaids.length}</div>
              <p className="text-xs text-muted-foreground">RAID actifs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {ressource.tarif_journalier > 0
                  ? `${(ressource.tarif_journalier / 1000).toFixed(0)}k`
                  : "—"}
              </div>
              <p className="text-xs text-muted-foreground">TJM (MAD)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {ressource.capacite_jours_mois}
              </div>
              <p className="text-xs text-muted-foreground">
                Capacité (j/mois)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div
                className="text-3xl font-bold"
                style={{ color: getRAGColor(currentCharge) }}
              >
                {currentCharge}%
              </div>
              <p className="text-xs text-muted-foreground">
                Charge ({MOIS_LABELS[now.getMonth()]})
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {currentMonthWorked > 0 ? currentMonthWorked : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                Jours saisis ({MOIS_LABELS[now.getMonth()]})
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Charge Heatmap Mini */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Charge {now.getFullYear()}</CardTitle>
            <CardDescription>
              Taux de charge mensuel — {RAG_LABELS[getRAGStatus(currentCharge)]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1.5">
              {currentYearData.map((m) => {
                const status = getRAGStatus(m.charge_pct);
                const isCurrentMonth = m.mois === now.getMonth() + 1;
                return (
                  <div key={m.mois} className="flex-1 text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      {MOIS_LABELS[m.mois - 1]}
                    </div>
                    <div
                      className={`rounded py-2 text-xs font-bold transition-transform ${isCurrentMonth ? "ring-2 ring-primary ring-offset-1" : ""}`}
                      style={{
                        backgroundColor: getRAGColor(m.charge_pct),
                        color: status === "gray" ? "#6b7280" : "white",
                      }}
                    >
                      {m.charge_pct > 0 ? `${m.charge_pct}%` : "—"}
                    </div>
                    {m.jours_travailles > 0 && (
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        {m.jours_travailles}j
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Disponibilité prévisionnelle */}
        {capacite?.disponibleFrom && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4 text-emerald-500" />
                Disponibilité prévisionnelle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Prochaine disponibilité significative (&lt;50% de charge) :{" "}
                <span className="font-bold text-emerald-600">
                  {MOIS_LABELS[capacite.disponibleFrom.mois - 1]} {capacite.disponibleFrom.annee}
                </span>
                {" "}— charge prévisionnelle : {capacite.disponibleFrom.charge_pct}%
              </p>
              {capacite.disponibleFrom.chantiers_actifs.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Chantiers restants : {capacite.disponibleFrom.chantiers_actifs.map((c) => c.code).join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Linked Chantiers */}
        <Card>
          <CardHeader>
            <CardTitle>Chantiers liés</CardTitle>
            <CardDescription>
              {uniqueChantierIds.size} chantier(s) via{" "}
              {ressource.membres.length} affectation(s) d&apos;équipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ressource.membres.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun chantier lié
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Équipe</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead className="text-center">Charge</TableHead>
                    <TableHead>Domaine</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ressource.membres.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">
                        {m.chantier.code}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm font-medium">
                        {m.chantier.nom}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="text-[10px]"
                          style={{
                            backgroundColor: EQUIPE_COLORS[m.equipe] ?? "#6b7280",
                            color: "white",
                          }}
                        >
                          {EQUIPE_LABELS[m.equipe] ?? m.equipe}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{m.role}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px] tabular-nums">
                          {m.charge_pourcentage}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="text-[10px]"
                          style={{
                            backgroundColor: DOMAINE_COLORS[m.chantier.domaine],
                            color: "white",
                          }}
                        >
                          {DOMAINE_LABELS[m.chantier.domaine] ??
                            m.chantier.domaine}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className="text-[10px]"
                          style={{
                            backgroundColor:
                              STATUT_CHANTIER_COLORS[m.chantier.statut],
                            color: "white",
                          }}
                        >
                          {STATUT_CHANTIER_LABELS[m.chantier.statut] ??
                            m.chantier.statut}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/chantiers/${m.chantier.id}`}>
                          <Button variant="ghost" size="icon-xs">
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* RAID Items */}
        <Card>
          <CardHeader>
            <CardTitle>Éléments RAID responsable</CardTitle>
            <CardDescription>
              {ressource.raids.length} élément(s) RAID assigné(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ressource.raids.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun élément RAID assigné
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Intitulé</TableHead>
                    <TableHead>Chantier</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Échéance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ressource.raids.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm font-medium">
                        {r.intitule}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.chantier
                          ? `${r.chantier.code} — ${r.chantier.nom}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.statut || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.date_echeance
                          ? format(new Date(r.date_echeance), "dd MMM yyyy", {
                              locale: fr,
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
