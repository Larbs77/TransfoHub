import { requirePageAccess } from "@/lib/auth";
import { getWorkflowDashboardForUi } from "../actions";
import { WorkflowDashboardClient } from "@/components/workflow-dashboard-client";
import { AccessDenied } from "@/components/access-denied";

export default async function WorkflowDashboardPage() {
  try {
    await requirePageAccess("/workflow/dashboard");
  } catch {
    return (
      <AccessDenied message="Vous n'avez pas accès au dashboard workflow." />
    );
  }

  try {
    const { stats } = await getWorkflowDashboardForUi();
    return (
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <WorkflowDashboardClient stats={stats} />
      </main>
    );
  } catch (e) {
    return (
      <AccessDenied
        message={
          e instanceof Error
            ? e.message
            : "Accès non autorisé au dashboard workflow."
        }
      />
    );
  }
}
