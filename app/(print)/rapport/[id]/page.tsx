import { notFound } from "next/navigation";
import { getChantierById, getBurnRateChantier } from "@/app/(app)/actions";
import { ChantierRapport } from "@/components/chantier-rapport";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RapportPage({ params }: Props) {
  const { id } = await params;

  const [chantier, burnRate] = await Promise.all([
    getChantierById(id),
    getBurnRateChantier(id).catch(() => null),
  ]);

  if (!chantier) return notFound();

  return (
    <ChantierRapport
      chantier={chantier}
      burnRate={burnRate?.totals ?? null}
      showPrintButton
    />
  );
}
