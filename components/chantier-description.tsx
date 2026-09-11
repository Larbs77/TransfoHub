"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ChantierDescription({ description }: { description: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Description du chantier</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-expanded={open}
            aria-label={
              open ? "Réduire la description" : "Afficher toute la description"
            }
            title={
              open ? "Réduire la description" : "Afficher toute la description"
            }
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div
          className={[
            "prose prose-sm max-w-none text-sm text-muted-foreground leading-relaxed",
            open ? "whitespace-pre-line" : "line-clamp-3",
          ].join(" ")}
        >
          {description}
        </div>
      </CardContent>
    </Card>
  );
}
