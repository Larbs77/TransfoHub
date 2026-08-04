import { notFound } from "next/navigation";
import { getChantierById } from "@/app/(app)/actions";
import { AccessDenied } from "@/components/access-denied";
import { ChantierGanttView } from "@/components/chantier-gantt-view";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function ChantierGanttPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const openedFromJalons = from === "jalons";

  let chantier;
  try {
    chantier = await getChantierById(id);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("non autorisé")) {
      return (
        <AccessDenied message="Vous n'êtes pas habilité à voir le planning de ce chantier." />
      );
    }
    throw e;
  }

  if (!chantier) return notFound();

  return (
    <ChantierGanttView
      nowMs={Date.now()}
      backHref={openedFromJalons ? "/jalons" : `/chantiers/${id}`}
      backLabel={openedFromJalons ? "Retour aux jalons" : "Fiche chantier"}
      chantier={{
        id: chantier.id,
        code: chantier.code,
        nom: chantier.nom,
        date_debut: chantier.date_debut,
        date_fin: chantier.date_fin,
        jalons: chantier.jalons.map((j) => ({
          id: j.id,
          phase: j.phase,
          nom: j.nom,
          ordre: j.ordre,
          date_debut: j.date_debut,
          date_cible: j.date_cible,
          date_reelle: j.date_reelle,
          statut: j.statut,
          workstreams: (j.workstreams ?? []).map((w) => ({
            id: w.id,
            nom: w.nom,
            ordre: w.ordre,
            date_debut: w.date_debut,
            date_fin: w.date_fin,
            statut: w.statut,
            activites: (w.activites ?? []).map((a) => ({
              id: a.id,
              nom: a.nom,
              ordre: a.ordre,
              date_debut: a.date_debut,
              date_fin: a.date_fin,
              statut: a.statut,
            })),
          })),
        })),
      }}
    />
  );
}
