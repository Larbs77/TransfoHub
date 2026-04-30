import { getConsultationQuestions } from "@/app/(app)/actions";
import { ConsultationBacklogList } from "@/components/consultation-backlog-list";

export default async function ConsultationBacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ priorite?: string; statut?: string }>;
}) {
  const params = await searchParams;
  const questions = await getConsultationQuestions();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backlog Q&A Consultation</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des questions issues des dossiers de consultation (RFP)
          </p>
        </div>
        <ConsultationBacklogList
          items={questions}
          initialPriorite={params.priorite}
          initialStatut={params.statut}
        />
      </main>
    </div>
  );
}
