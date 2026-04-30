"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAlerts } from "@/app/(app)/actions";
import Link from "next/link";

interface Alert {
  id: string;
  type: string;
  message: string;
  detail?: string;
  responsable: string;
  date: Date | null;
}

export function AlertBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    getAlerts().then(setAlerts);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3">
          <h4 className="text-sm font-semibold">
            Notifications ({alerts.length})
          </h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucune alerte
            </p>
          ) : (
            alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.type === "qa_critique_echue" ? "/consultation-backlog" : "/raid/actions"}
                className="flex flex-col gap-0.5 border-b px-4 py-3 text-sm hover:bg-accent transition-colors last:border-b-0"
              >
                <span className={`font-medium ${alert.type === "qa_critique_echue" ? "text-orange-600" : "text-destructive"}`}>
                  {alert.message}
                </span>
                {alert.detail && (
                  <span className="text-xs text-muted-foreground">
                    {alert.detail}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Responsable : {alert.responsable || "—"} | Échéance :{" "}
                  {alert.date
                    ? format(new Date(alert.date), "dd/MM/yyyy", { locale: fr })
                    : "—"}
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
