"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EQUIPE_LABELS, EQUIPE_COLORS } from "@/lib/equipe-labels";
import { DOMAINE_COLORS } from "@/lib/chantier-labels";
import { Crown, User, UserCheck } from "lucide-react";

interface Membre {
  id: string;
  equipe: string;
  role: string;
  nom_complet: string;
  is_directeur?: boolean;
}

interface RmdInfo {
  rmd: { id: string; nom_complet: string; domaine: string };
}

interface Props {
  directeur: string;
  membres: Membre[];
  rmds?: RmdInfo[];
}

const TEAM_ORDER = ["PMO", "AMOA", "MOE", "Métiers", "Sécurité", "EI"];

export function OrganigrammeChantier({ directeur, membres, rmds }: Props) {
  // Find suppléants and group remaining members by team
  const suppleants = membres.filter((m) => m.role === "Directeur de chantier - suppléant");
  const grouped = new Map<string, Membre[]>();
  for (const m of membres) {
    if (m.is_directeur) continue;
    if (m.role === "Directeur de chantier - suppléant") continue;
    const list = grouped.get(m.equipe) ?? [];
    list.push(m);
    grouped.set(m.equipe, list);
  }

  const teamsWithMembers = TEAM_ORDER.filter((e) => grouped.has(e));
  const hasRmds = rmds && rmds.length > 0;

  return (
    <div className="overflow-x-auto py-6">
      <div className="flex gap-8 min-w-fit">
        {/* Left: Org chart */}
        <div className="flex flex-col items-center flex-1">
          {/* Root: Directeur de chantier + suppléant */}
          <Card className="px-6 py-4 shadow-md border-2 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-center gap-6">
              {/* Directeur */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Crown className="size-5 text-primary" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Directeur de chantier
                  </span>
                </div>
                <p className="text-base font-bold">
                  {directeur || "Non défini"}
                </p>
              </div>
              {/* Suppléant(s) */}
              {suppleants.length > 0 && (
                <>
                  <div className="w-px h-10 bg-border" />
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Crown className="size-4 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Suppléant
                      </span>
                    </div>
                    {suppleants.map((s) => (
                      <p key={s.id} className="text-sm font-semibold text-muted-foreground">
                        {s.nom_complet}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Vertical line from root */}
          <div className="w-px h-8 bg-border" />

          {teamsWithMembers.length > 0 && (
            <>

              {/* Horizontal connector line */}
              <div className="relative w-full flex justify-center">
                {teamsWithMembers.length > 1 && (
                  <div
                    className="absolute top-0 h-px bg-border"
                    style={{
                      left: `${100 / (teamsWithMembers.length * 2)}%`,
                      right: `${100 / (teamsWithMembers.length * 2)}%`,
                    }}
                  />
                )}
              </div>

              {/* Team branches */}
              <div className="flex gap-4 items-start">
                {teamsWithMembers.map((equipe) => {
                  const membresEquipe = grouped.get(equipe) ?? [];
                  const color = EQUIPE_COLORS[equipe] ?? "hsl(0, 0%, 50%)";
                  return (
                    <div
                      key={equipe}
                      className="flex flex-col items-center"
                    >
                      {/* Vertical line to team card */}
                      <div className="w-px h-8 bg-border" />

                      {/* Team card */}
                      <Card
                        className="w-52 overflow-hidden shadow-sm"
                        style={{ borderTop: `3px solid ${color}` }}
                      >
                        {/* Team header */}
                        <div
                          className="px-3 py-2 text-center"
                          style={{
                            backgroundColor: color,
                            color: "white",
                          }}
                        >
                          <span className="text-sm font-semibold">
                            {EQUIPE_LABELS[equipe] ?? equipe}
                          </span>
                          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold">
                            {membresEquipe.length}
                          </span>
                        </div>

                        {/* Members list */}
                        <div className="divide-y">
                          {membresEquipe.map((m) => (
                            <div
                              key={m.id}
                              className="px-3 py-2 flex items-start gap-2"
                            >
                              <User className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {m.nom_complet}
                                </p>
                                <p
                                  className="text-[10px] truncate"
                                  style={{ color }}
                                >
                                  {m.role}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {teamsWithMembers.length === 0 && (
            <p className="text-center text-muted-foreground py-8 mt-4">
              Aucun membre dans l&apos;équipe pour afficher l&apos;organigramme
            </p>
          )}
        </div>

        {/* Right: RMDs linked to chantier */}
        {hasRmds && (
          <div className="shrink-0 w-56 self-start mt-0">
            <Card className="overflow-hidden shadow-sm border-2 border-dashed border-muted-foreground/30">
              <div className="px-3 py-2 text-center bg-muted/50">
                <div className="flex items-center justify-center gap-1.5">
                  <UserCheck className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">
                    RMD
                  </span>
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-bold text-muted-foreground">
                    {rmds.length}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Hors périmètre Directeur
                </p>
              </div>
              <div className="divide-y">
                {rmds.map((cr) => (
                  <div
                    key={cr.rmd.id}
                    className="px-3 py-2 flex items-start gap-2"
                  >
                    <UserCheck className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {cr.rmd.nom_complet}
                      </p>
                      <Badge
                        className="text-[9px] px-1 py-0 h-4 mt-0.5"
                        style={{
                          backgroundColor: DOMAINE_COLORS[cr.rmd.domaine],
                          color: "white",
                        }}
                      >
                        {cr.rmd.domaine}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
