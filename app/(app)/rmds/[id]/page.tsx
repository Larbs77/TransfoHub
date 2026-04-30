import { notFound } from "next/navigation";
import Link from "next/link";
import { getRmdById } from "@/app/(app)/actions";
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
import { ArrowRight } from "lucide-react";
import {
  DOMAINE_LABELS,
  DOMAINE_COLORS,
  PRIORITE_CHANTIER_LABELS,
  PRIORITE_CHANTIER_COLORS,
  STATUT_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
} from "@/lib/chantier-labels";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RmdDetailPage({ params }: Props) {
  const { id } = await params;
  const rmd = await getRmdById(id);

  if (!rmd) return notFound();

  const linkedChantiers = rmd.chantiers.map((cr) => cr.chantier);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge style={{ backgroundColor: DOMAINE_COLORS[rmd.domaine], color: "white" }}>{DOMAINE_LABELS[rmd.domaine] ?? rmd.domaine}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{rmd.nom_complet}</h1>
          {rmd.suppleant && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Suppléant(e):</span> {rmd.suppleant}
            </p>
          )}
        </div>

        {/* KPI */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{linkedChantiers.length}</div>
              <p className="text-xs text-muted-foreground">Chantiers assignés</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {linkedChantiers.filter((c) => c.statut === "Exécution" || c.statut === "Cadrage").length}
              </div>
              <p className="text-xs text-muted-foreground">Chantiers actifs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">
                {linkedChantiers.filter((c) => c.statut === "Clôturé").length}
              </div>
              <p className="text-xs text-muted-foreground">Chantiers clôturés</p>
            </CardContent>
          </Card>
        </section>

        {/* Linked Chantiers table */}
        <Card>
          <CardHeader>
            <CardTitle>Chantiers liés</CardTitle>
            <CardDescription>
              {linkedChantiers.length} chantier(s) assigné(s) à ce RMD
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedChantiers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun chantier lié
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Chantier</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Domaine</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedChantiers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm font-medium">
                        {c.nom}
                      </TableCell>
                      <TableCell>
                        <Badge className="text-[10px]" style={{ backgroundColor: DOMAINE_COLORS[c.domaine], color: "white" }}>
                          {DOMAINE_LABELS[c.domaine] ?? c.domaine}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="text-[10px]" style={{ backgroundColor: PRIORITE_CHANTIER_COLORS[c.priorite], color: "white" }}>
                          {PRIORITE_CHANTIER_LABELS[c.priorite] ?? c.priorite}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="text-[10px]" style={{ backgroundColor: STATUT_CHANTIER_COLORS[c.statut], color: "white" }}>
                          {STATUT_CHANTIER_LABELS[c.statut] ?? c.statut}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/chantiers/${c.id}`}>
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
      </main>
    </div>
  );
}
