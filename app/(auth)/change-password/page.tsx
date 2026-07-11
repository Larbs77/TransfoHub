"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { changePasswordAction } from "./actions";

export default function ChangePasswordPage() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    null
  );

  return (
    <Card className="w-full overflow-hidden border border-[#0A3C74]/10 bg-white/95 shadow-[0_20px_50px_-20px_rgba(10,60,116,0.28)] backdrop-blur-sm">
      <div
        aria-hidden
        className="h-1 w-full bg-gradient-to-r from-[#0A3C74] via-[#00BDBB] to-[#0A3C74]"
      />

      <CardHeader className="space-y-4 px-6 pb-2 pt-7 text-center">
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
            Mot de passe
          </CardTitle>
          <CardDescription className="text-[13px] text-[#0A3C74]/65">
            Changez le mot de passe temporaire pour continuer.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-7 pt-4">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="current_password"
              className="text-sm font-medium text-[#0A3C74]"
            >
              Mot de passe actuel
            </label>
            <Input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              className="border-[#0A3C74]/15 bg-white text-[#0A3C74] focus-visible:border-[#00BDBB] focus-visible:ring-[#00BDBB]/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="new_password"
              className="text-sm font-medium text-[#0A3C74]"
            >
              Nouveau mot de passe
            </label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
              className="border-[#0A3C74]/15 bg-white text-[#0A3C74] focus-visible:border-[#00BDBB] focus-visible:ring-[#00BDBB]/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirm_password"
              className="text-sm font-medium text-[#0A3C74]"
            >
              Confirmer le nouveau mot de passe
            </label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
              className="border-[#0A3C74]/15 bg-white text-[#0A3C74] focus-visible:border-[#00BDBB] focus-visible:ring-[#00BDBB]/30"
            />
          </div>

          <p className="text-[10px] leading-relaxed text-[#0A3C74]/50">
            Min. 8 caractères, une majuscule, une minuscule, un chiffre et un
            caractère spécial.
          </p>

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
            {isPending ? "Mise à jour..." : "Changer le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
