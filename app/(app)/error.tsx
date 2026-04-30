"use client";

import { ShieldX, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isAccessDenied =
    error.message.includes("non autorisé") ||
    error.message.includes("Accès non autorisé");

  if (isAccessDenied) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="size-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Accès non autorisé</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/">Retour au tableau de bord</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle className="size-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "Veuillez réessayer."}
      </p>
      <div className="flex gap-2 mt-2">
        <Button variant="outline" onClick={reset}>
          Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Retour au tableau de bord</Link>
        </Button>
      </div>
    </div>
  );
}
