"use client";

import { Check, X } from "lucide-react";
import { getPasswordRuleResults } from "@/lib/password-rules";

export function PasswordRulesHint({ password }: { password: string }) {
  const results = getPasswordRuleResults(password);
  return (
    <ul className="space-y-0.5 text-[11px]">
      {results.map((r) => (
        <li
          key={r.id}
          className={`flex items-center gap-1.5 ${
            r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        >
          {r.ok ? (
            <Check className="size-3 shrink-0" />
          ) : (
            <X className="size-3 shrink-0" />
          )}
          {r.label}
        </li>
      ))}
    </ul>
  );
}
