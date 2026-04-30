"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarView, type CalendarEvent } from "./calendar-view";
import {
  RAID_TYPE_LABELS,
  RAID_TYPE_COLORS,
  DOMAINE_LIST,
  CATEGORIE_LIST,
} from "@/lib/raid-labels";
import {
  INSTANCE_LABELS,
  INSTANCE_COLORS,
  STATUT_COMITE_LABELS,
} from "@/lib/comite-labels";

interface RaidItem {
  id: string;
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  domaine: string;
  responsable: string;
  statut: string;
  date_identification: Date | null;
  date_revision: Date | null;
  date_echeance: Date | null;
  chantier?: { id: string; code: string; nom: string } | null;
  comite?: { id: string; instance: string; numero: number } | null;
}

interface ComiteItem {
  id: string;
  instance: string;
  numero: number;
  date: Date;
  heure_casablanca: string;
  heure_belgique: string;
  statut: string;
  ordre_du_jour: string;
  invitation_envoyee: boolean;
}

interface Props {
  raidItems: RaidItem[];
  comites: ComiteItem[];
}

type SourceFilter = "__all__" | "raid" | "comites";

export function CalendarPageClient({ raidItems, comites }: Props) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("__all__");
  const [raidTypeFilter, setRaidTypeFilter] = useState("__all__");
  const [domaineFilter, setDomaineFilter] = useState("__all__");
  const [categorieFilter, setCategorieFilter] = useState("__all__");
  const [instanceFilter, setInstanceFilter] = useState("__all__");
  const [responsableFilter, setResponsableFilter] = useState("__all__");

  // Unique responsables from RAID items
  const responsables = useMemo(() => {
    const set = new Set<string>();
    for (const r of raidItems) {
      if (r.responsable) set.add(r.responsable);
    }
    return [...set].sort();
  }, [raidItems]);

  // Determine effective source: if a RAID-specific filter is active, only show RAID; if instance filter is active, only show comités
  const hasRaidFilter = raidTypeFilter !== "__all__" || domaineFilter !== "__all__" || categorieFilter !== "__all__" || responsableFilter !== "__all__";
  const hasComiteFilter = instanceFilter !== "__all__";

  const effectiveSource = useMemo(() => {
    if (sourceFilter !== "__all__") return sourceFilter;
    if (hasRaidFilter && !hasComiteFilter) return "raid" as const;
    if (hasComiteFilter && !hasRaidFilter) return "comites" as const;
    return "__all__" as const;
  }, [sourceFilter, hasRaidFilter, hasComiteFilter]);

  // Build events
  const events = useMemo(() => {
    const result: CalendarEvent[] = [];
    const q = search.toLowerCase();

    // RAID events
    if (effectiveSource === "__all__" || effectiveSource === "raid") {
      for (const r of raidItems) {
        const eventDate = r.date_echeance ?? r.date_revision ?? r.date_identification;
        if (!eventDate) continue;

        // Apply filters
        if (raidTypeFilter !== "__all__" && r.type !== raidTypeFilter) continue;
        if (domaineFilter !== "__all__" && r.domaine !== domaineFilter) continue;
        if (categorieFilter !== "__all__" && r.categorie !== categorieFilter) continue;
        if (responsableFilter !== "__all__" && r.responsable !== responsableFilter) continue;
        if (q && !r.intitule.toLowerCase().includes(q) && !r.responsable.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) continue;

        result.push({
          id: `raid-${r.id}`,
          date: new Date(eventDate),
          label: r.intitule,
          color: RAID_TYPE_COLORS[r.type] ?? "#6b7280",
          sublabel: r.type,
          details: {
            "Type": RAID_TYPE_LABELS[r.type] ?? r.type,
            "Statut": r.statut || "",
            "Catégorie": r.categorie || "",
            "Domaine": r.domaine || "",
            "Responsable": r.responsable || "",
            "Chantier": r.chantier ? `${r.chantier.code} - ${r.chantier.nom}` : "",
            "Échéance": r.date_echeance
              ? format(new Date(r.date_echeance), "dd MMM yyyy", { locale: fr })
              : "",
          },
        });
      }
    }

    // Comité events
    if (effectiveSource === "__all__" || effectiveSource === "comites") {
      for (const c of comites) {
        // Apply filters
        if (instanceFilter !== "__all__" && c.instance !== instanceFilter) continue;
        const label = `${INSTANCE_LABELS[c.instance] ?? c.instance} #${c.numero}`;
        if (q && !label.toLowerCase().includes(q) && !c.ordre_du_jour.toLowerCase().includes(q)) continue;

        result.push({
          id: `comite-${c.id}`,
          date: new Date(c.date),
          label,
          color: INSTANCE_COLORS[c.instance] ?? "#6b7280",
          sublabel: c.heure_casablanca ? `${c.heure_casablanca} (Casa)` : "Comité",
          details: {
            "Instance": INSTANCE_LABELS[c.instance] ?? c.instance,
            "Numéro": `#${c.numero}`,
            "Heure Casablanca": c.heure_casablanca || "",
            "Heure Belgique": c.heure_belgique || "",
            "Statut": STATUT_COMITE_LABELS[c.statut] ?? c.statut,
            "Ordre du jour": c.ordre_du_jour || "",
            "Invitation envoyée": c.invitation_envoyee ? "Oui" : "Non",
          },
        });
      }
    }

    return result;
  }, [raidItems, comites, search, effectiveSource, raidTypeFilter, domaineFilter, categorieFilter, instanceFilter, responsableFilter]);

  const showRaidFilters = effectiveSource === "__all__" || effectiveSource === "raid";
  const showComiteFilters = effectiveSource === "__all__" || effectiveSource === "comites";

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Filter className="size-4 text-muted-foreground shrink-0" />

        {/* Search */}
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        {/* Source */}
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tout</SelectItem>
            <SelectItem value="raid">RAID</SelectItem>
            <SelectItem value="comites">Comités</SelectItem>
          </SelectContent>
        </Select>

        {/* RAID type filter */}
        {showRaidFilters && (
          <Select value={raidTypeFilter} onValueChange={setRaidTypeFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Type RAID" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous types</SelectItem>
              <SelectItem value="Action">Action</SelectItem>
              <SelectItem value="Risque">Risque</SelectItem>
              <SelectItem value="Information">Information</SelectItem>
              <SelectItem value="Décision">Décision</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Domaine */}
        {showRaidFilters && (
          <Select value={domaineFilter} onValueChange={setDomaineFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Domaine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous domaines</SelectItem>
              {DOMAINE_LIST.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Catégorie */}
        {showRaidFilters && (
          <Select value={categorieFilter} onValueChange={setCategorieFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes catégories</SelectItem>
              {CATEGORIE_LIST.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Responsable */}
        {showRaidFilters && (
          <Select value={responsableFilter} onValueChange={setResponsableFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous responsables</SelectItem>
              {responsables.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Comité instance filter */}
        {showComiteFilters && (
          <Select value={instanceFilter} onValueChange={setInstanceFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Instance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes instances</SelectItem>
              {Object.entries(INSTANCE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">Légende :</span>
        {(effectiveSource === "__all__" || effectiveSource === "raid") && (
          <>
            {Object.entries(RAID_TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
                {RAID_TYPE_LABELS[type]}
              </span>
            ))}
          </>
        )}
        {(effectiveSource === "__all__" || effectiveSource === "comites") && (
          <>
            {Object.entries(INSTANCE_COLORS).map(([inst, color]) => (
              <span key={inst} className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
                {INSTANCE_LABELS[inst]}
              </span>
            ))}
          </>
        )}
        <span className="ml-auto">
          <Badge variant="secondary" className="text-[10px]">
            {events.length} événement{events.length !== 1 ? "s" : ""}
          </Badge>
        </span>
      </div>

      {/* Calendar */}
      <CalendarView events={events} />
    </div>
  );
}
