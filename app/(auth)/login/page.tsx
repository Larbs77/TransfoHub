"use client";

import { Suspense, useActionState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Lock, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { loginAction } from "./actions";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <Card className="w-full overflow-hidden border border-[#0A3C74]/10 bg-white/95 shadow-[0_20px_50px_-20px_rgba(10,60,116,0.28)] backdrop-blur-sm">
      {/* Brand accent bar */}
      <div
        aria-hidden
        className="h-1 w-full bg-gradient-to-r from-[#0A3C74] via-[#00BDBB] to-[#0A3C74]"
      />

      <CardHeader className="space-y-4 px-6 pb-2 pt-7 text-center">
        {/* Bank of Africa logo */}
        <div className="mx-auto flex items-center justify-center rounded-2xl border border-[#00BDBB]/20 bg-gradient-to-br from-white to-[#00BDBB]/8 px-5 py-3 shadow-sm">
          <Image
            src="/boa-logo.png"
            alt="Bank of Africa"
            width={200}
            height={56}
            priority
            className="h-12 w-auto object-contain"
          />
        </div>
        <div className="space-y-1.5">
          <CardTitle className="flex items-center justify-center gap-2.5 text-xl font-bold tracking-tight text-[#0A3C74]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0A3C74] text-white shadow-inner shadow-[#0A3C74]/30">
              <Sparkles className="size-4 text-[#00BDBB]" strokeWidth={2} />
            </span>
            TransfoHub
          </CardTitle>
          <CardDescription className="text-[13px] text-[#0A3C74]/65">
            PMO · Pilotage de la transformation bancaire
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-7 pt-4">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />

          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium text-[#0A3C74]"
            >
              Nom d&apos;utilisateur
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#0A3C74]/45" />
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="border-[#0A3C74]/15 bg-white pl-9 text-[#0A3C74] placeholder:text-[#0A3C74]/35 focus-visible:border-[#00BDBB] focus-visible:ring-[#00BDBB]/30"
                placeholder="admin"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#0A3C74]"
            >
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#0A3C74]/45" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="border-[#0A3C74]/15 bg-white pl-9 text-[#0A3C74] focus-visible:border-[#00BDBB] focus-visible:ring-[#00BDBB]/30"
              />
            </div>
          </div>

          {state?.error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="h-10 w-full bg-[#0A3C74] font-semibold text-white shadow-md shadow-[#0A3C74]/20 transition-all hover:bg-[#0c4a8f] hover:shadow-lg hover:shadow-[#00BDBB]/20 focus-visible:ring-[#00BDBB]/40"
          >
            {isPending ? "Connexion..." : "Se connecter"}
          </Button>

          <p className="pt-1 text-center text-[11px] leading-relaxed text-[#0A3C74]/50">
            Accès sécurisé · Programme de transformation
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto h-80 w-full max-w-sm animate-pulse rounded-xl bg-white/80 shadow-md" />
      }
    >
      <LoginForm />
    </Suspense>
  );
}
