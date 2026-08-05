import { notFound } from "next/navigation";
import { getConsultationQuestionById } from "@/app/(app)/actions";
import { ConsultationQuestionForm } from "@/components/consultation-question-form";

function safeRetour(raw: string | undefined): string {
  if (!raw) return "/consultation-backlog";
  // Only allow internal absolute paths (no open redirect)
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "/consultation-backlog";
  }
  return raw;
}

export default async function ModifierConsultationQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const backHref = safeRetour(sp.retour);

  const question = await getConsultationQuestionById(id);
  if (!question) notFound();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <ConsultationQuestionForm
          variant="page"
          question={question}
          backHref={backHref}
        />
      </main>
    </div>
  );
}
