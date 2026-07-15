import { requirePageAccess } from "@/lib/auth";
import { getWorkflowRequestsForUi } from "../actions";
import { WorkflowRequestsClient } from "@/components/workflow-requests-client";
import { AccessDenied } from "@/components/access-denied";

export default async function WorkflowDemandesPage() {
  try {
    await requirePageAccess("/workflow/demandes", "/workflow/historique");
  } catch {
    return (
      <AccessDenied message="Vous n'avez pas accès au centre de validation." />
    );
  }

  const { requests, caps, isValidator } = await getWorkflowRequestsForUi({
    pendingOnly: false,
  });

  // Prefer pending for validation center default filter (client-side)
  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <WorkflowRequestsClient
        initialRequests={requests}
        caps={caps}
        mode="validation"
        isValidator={isValidator}
      />
    </main>
  );
}
