import { ShieldX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl p-6">
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldX className="size-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Accès non autorisé</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {message || "Vous n'avez pas les droits nécessaires pour accéder à cette page."}
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/">Retour au tableau de bord</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
