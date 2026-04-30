import { getRmds } from "@/app/(app)/actions";
import { RmdsList } from "@/components/rmds-list";
import { AddRmdButton } from "@/components/add-rmd-button";

export default async function RmdsPage() {
  const rmds = await getRmds();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RMD</h1>
            <p className="text-sm text-muted-foreground">
              {rmds.length} responsable(s) métier délégué(s)
            </p>
          </div>
          <AddRmdButton />
        </div>
        <RmdsList rmds={rmds} />
      </main>
    </div>
  );
}
