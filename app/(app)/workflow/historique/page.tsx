import { requirePageAccess } from "@/lib/auth";
import { getWorkflowRequestsForUi } from "../actions";
import { WorkflowRequestsClient } from "@/components/workflow-requests-client";
import { AccessDenied } from "@/components/access-denied";

export default async function WorkflowHistoriquePage() {
  try {
    await requirePageAccess("/workflow/historique", "/workflow/demandes");
  } catch {
    return (
      <AccessDenied message="Vous n'avez pas accès à l'historique workflow." />
    );
  }

  const { requests, caps, isValidator } = await getWorkflowRequestsForUi();

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <WorkflowRequestsClient
        initialRequests={requests}
        caps={caps}
        mode="history"
        isValidator={isValidator}
      />
    </main>
  );
}
