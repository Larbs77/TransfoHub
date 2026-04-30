"use client";

import { useActionState } from "react";
import { KeyRound, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { changePasswordAction } from "./actions";

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, null);

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FolderKanban className="size-8 text-primary" />
        </div>
        <CardTitle className="text-xl flex items-center justify-center gap-2">
          <KeyRound className="size-5" />
          Changement de mot de passe
        </CardTitle>
        <CardDescription>
          Vous devez changer votre mot de passe temporaire avant de continuer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="current_password" className="text-sm font-medium">
              Mot de passe actuel
            </label>
            <Input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new_password" className="text-sm font-medium">
              Nouveau mot de passe
            </label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm_password" className="text-sm font-medium">
              Confirmer le nouveau mot de passe
            </label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Min. 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.
          </p>

          {state?.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Mise à jour..." : "Changer le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
