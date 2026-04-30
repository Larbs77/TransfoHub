"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, ArrowLeft, AlertTriangle, Link2, TableProperties, GitFork } from "lucide-react";
import {
  ADHERENCE_TYPE_COLORS,
  ADHERENCE_STATUT_COLORS,
  ADHERENCE_CRITICITE_COLORS,
} from "@/lib/adherence-labels";
import { AdherenceGraph } from "@/components/adherence-graph";
import Link from "next/link";

interface ChantierRef {
  id: string;
  code: string;
  nom: string;
  domaine: string;
  statut: string;
}

interface AdherenceRow {
  id: string;
  code: string;
  chantierDependantId: string | null;
  chantierDependant?: ChantierRef | null;
  chantierSourceId: string;
  chantierSource?: ChantierRef | null;
  chantierDependantLabel: string;
  type: string;
  domaine: string;
  description: string;
  criticite: string;
  statut: string;
  date_resolution_prevue: Date | null;
  responsable: string;
  contrat_interface: string;
}

interface Props {
  asSource: AdherenceRow[];
  asDependant: AdherenceRow[];
  chantierCode: string;
  chantierId: string;
}

function AdherenceTable({
  items,
  direction,
}: {
  items: AdherenceRow[];
  direction: "source" | "dependant";
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        Aucune adhérence
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[70px]">Code</TableHead>
            <TableHead className="w-[200px]">
              {direction === "source" ? "Chantier dépendant" : "Chantier source"}
            </TableHead>
            <TableHead className="w-[90px]">Type</TableHead>
            <TableHead className="w-[90px]">Criticité</TableHead>
            <TableHead className="w-[80px]">Statut</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Échéance</TableHead>
            <TableHead className="w-[90px]">Responsable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => {
            const relatedChantier =
              direction === "source" ? a.chantierDependant : a.chantierSource;
            return (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs font-medium">
                  {a.code}
                </TableCell>
                <TableCell>
                  {relatedChantier ? (
                    <Link
                      href={`/chantiers/${relatedChantier.id}`}
                      className="hover:underline"
                    >
                      <span className="text-xs font-medium">
                        {relatedChantier.code}
                      </span>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {relatedChantier.nom}
                      </p>
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {a.chantierDependantLabel || "Transverse"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor:
                        (ADHERENCE_TYPE_COLORS[a.type] ?? "#94a3b8") + "20",
                      color: ADHERENCE_TYPE_COLORS[a.type] ?? "#94a3b8",
                    }}
                  >
                    {a.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor:
                        (ADHERENCE_CRITICITE_COLORS[a.criticite] ?? "#94a3b8") +
                        "20",
                      color:
                        ADHERENCE_CRITICITE_COLORS[a.criticite] ?? "#94a3b8",
                    }}
                  >
                    {a.criticite === "BLOQUANTE" && (
                      <AlertTriangle className="size-3 mr-0.5" />
                    )}
                    {a.criticite}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor:
                        (ADHERENCE_STATUT_COLORS[a.statut] ?? "#94a3b8") + "20",
                      color: ADHERENCE_STATUT_COLORS[a.statut] ?? "#94a3b8",
                    }}
                  >
                    {a.statut}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">
                  {a.description}
                </TableCell>
                <TableCell className="text-xs">
                  {a.date_resolution_prevue
                    ? format(new Date(a.date_resolution_prevue), "dd MMM yyyy", {
                        locale: fr,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="text-xs">{a.responsable}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ChantierAdherencesTab({
  asSource,
  asDependant,
  chantierCode,
  chantierId,
}: Props) {
  const [viewMode, setViewMode] = useState<"table" | "graph">("table");
  const totalSource = asSource.length;
  const totalDependant = asDependant.length;
  const total = totalSource + totalDependant;
  const bloquantes = [...asSource, ...asDependant].filter(
    (a) => a.criticite === "BLOQUANTE"
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-indigo-500/10">
            <Link2 className="size-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total adhérences</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-orange-500/10">
            <ArrowRight className="size-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{totalSource}</p>
            <p className="text-xs text-muted-foreground">Dépendent de {chantierCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-blue-500/10">
            <ArrowLeft className="size-4 text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{totalDependant}</p>
            <p className="text-xs text-muted-foreground">{chantierCode} dépend de</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-red-500/10">
            <AlertTriangle className="size-4 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold">{bloquantes}</p>
            <p className="text-xs text-muted-foreground">Bloquantes</p>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
        >
          <TableProperties className="size-4" />
          Table
        </Button>
        <Button
          variant={viewMode === "graph" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("graph")}
        >
          <GitFork className="size-4" />
          Graphe
        </Button>
      </div>

      {viewMode === "graph" ? (
        <AdherenceGraph
          adherences={[...asSource, ...asDependant]}
          centerId={chantierId}
          height={450}
        />
      ) : (
      <>
      {/* Dépendent de ce chantier (Source) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="size-4 text-orange-500" />
            Chantiers dépendant de {chantierCode}
          </CardTitle>
          <CardDescription>
            {totalSource} chantier(s) dépendent des livrables de ce chantier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdherenceTable items={asSource} direction="source" />
        </CardContent>
      </Card>

      {/* Ce chantier dépend de (Dependant) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowLeft className="size-4 text-blue-500" />
            {chantierCode} dépend de
          </CardTitle>
          <CardDescription>
            {totalDependant} chantier(s) dont ce chantier dépend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdherenceTable items={asDependant} direction="dependant" />
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
