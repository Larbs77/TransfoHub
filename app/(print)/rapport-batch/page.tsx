import { getChantiersByIds, getChantiers } from "@/app/(app)/actions";
import { ChantierRapport } from "@/components/chantier-rapport";
import { PrintButton } from "@/components/print-button";

interface Props {
  searchParams: Promise<{ ids?: string }>;
}

export default async function RapportBatchPage({ searchParams }: Props) {
  const { ids } = await searchParams;

  let chantiers;
  if (ids) {
    const idList = ids.split(",").filter(Boolean).slice(0, 20);
    chantiers = await getChantiersByIds(idList);
  } else {
    // No ids = all active chantiers
    const all = await getChantiers();
    const activeIds = all
      .filter((c) => !["Clôturé", "Non démarré"].includes(c.statut))
      .map((c) => c.id);
    chantiers = await getChantiersByIds(activeIds);
  }

  if (chantiers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Aucun chantier trouvé.
      </div>
    );
  }

  return (
    <div>
      {/* Print button — first page only */}
      <div className="no-print flex items-center justify-between px-6 py-3 border-b bg-gray-50 sticky top-0 z-10">
        <span className="text-sm text-gray-600 font-medium">
          {chantiers.length} rapport(s) sélectionné(s)
        </span>
        <PrintButton count={chantiers.length} />
      </div>

      {chantiers.map((chantier, i) => (
        <div key={chantier.id} className={i > 0 ? "page-break" : ""}>
          <ChantierRapport chantier={chantier} showPrintButton={false} />
        </div>
      ))}
    </div>
  );
}
