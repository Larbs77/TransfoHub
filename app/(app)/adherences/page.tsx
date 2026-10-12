import { requirePageAccess } from "@/lib/auth";
import { getAdherences, getChantiersForAdherenceForm, getNextAdherenceCode } from "@/app/(app)/actions";
import { AdherencesRegistre } from "@/components/adherences-registre";
import { Link2, Lightbulb } from "lucide-react";

export default async function AdherencesPage() {
  await requirePageAccess("/adherences");
  const [adherences, chantiersLists, nextCode] = await Promise.all([
    getAdherences(),
    getChantiersForAdherenceForm(),
    getNextAdherenceCode(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Link2 className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Adhérences Inter-Chantiers</h1>
            <p className="text-sm text-muted-foreground">
              Cartographie des dépendances entre chantiers du programme de transformation
            </p>
          </div>
        </div>

        <div className="flex max-w-3xl items-start gap-2.5 rounded-lg bg-gradient-to-r from-[#00BDBB]/12 to-[#0A3C74]/[0.06] px-3 py-2.5">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[#00BDBB]" />
          <p className="text-[11px] italic leading-relaxed text-muted-foreground">
            <span className="font-medium not-italic text-foreground">
              Explication :{" "}
            </span>
            Le chantier demandeur ne peut avancer que lorsque le chantier
            fournisseur a produit et clos les livrables et actions convenus.
            L&apos;adhérence consigne cet engagement entre les chantiers.
          </p>
        </div>

        <AdherencesRegistre
          adherences={adherences}
          chantiers={chantiersLists.source}
          chantiersDependant={chantiersLists.dependant}
          allowTransverse={chantiersLists.allowTransverse}
          nextCode={nextCode}
        />
      </main>
    </div>
  );
}
