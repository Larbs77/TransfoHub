"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loginAction } from "./actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FolderKanban className="size-8 text-primary" />
        </div>
        <CardTitle className="text-xl">PMO Transformation</CardTitle>
        <CardDescription>
          Connectez-vous pour accéder au tableau de bord
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />

          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">
              Nom d&apos;utilisateur
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="pl-9"
                placeholder="admin"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="pl-9"
              />
            </div>
          </div>

          {state?.error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
