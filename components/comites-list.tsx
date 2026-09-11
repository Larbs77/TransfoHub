"use client";

import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, isWithinInterval, isBefore, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  CalendarDays,
  CalendarClock,
  History,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComiteFormDialog } from "./comite-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { RaidFormDialog } from "./raid-form-dialog";
import { RaidExcelExportOnceButton } from "./raid-excel-export-button";
import { CalendarView, type CalendarEvent } from "./calendar-view";
import { deleteComite, deleteRaid } from "@/app/(app)/actions";
import { useCanCreateRaid, useUser } from "@/components/user-provider";
import {
  STATUT_COMITE_LABELS,
  STATUT_COMITE_COLORS,
  orderedInstanceNames,
  displayLabelForInstance,
  colorForInstance,
  type ComiteParametreOption,
} from "@/lib/comite-labels";
import {
  COMITE_NIVEAU_GOUVERNANCE,
  COMITE_NIVEAU_LABELS,
  COMITE_NIVEAU_OPERATIONNEL,
  isComiteNiveauOperationnel,
  canActOnComiteSeance,
} from "@/lib/comite-niveau";
import {
  RAID_TYPE_COLORS,
  RAID_TYPE_LABELS,
  getStatutColor,
} from "@/lib/raid-labels";

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
  date_echeance_actualisee?: Date | null;
  date_fin_reelle?: Date | null;
  createdAt?: Date | string;
  probabilite: number | null;
  impact: number | null;
  strategie: string;
  mitigation: string;
  commentaires: string;
  responsableRessourceId: string | null;
  chantierId: string | null;
  comiteId: string | null;
  chantier?: { id: string; code: string; nom: string } | null;
}

interface ComiteRow {
  id: string;
  instance: string;
  numero: number;
  date: Date;
  heure_casablanca: string;
  heure_belgique: string;
  statut: string;
  ordre_du_jour: string;
  invitation_envoyee: boolean;
  createdAt: Date;
  updatedAt: Date;
  chantierId?: string | null;
  chantier?: { id: string; code: string; nom: string } | null;
  raids: RaidItem[];
}

interface Props {
  comites: ComiteRow[];
  instances?: ComiteParametreOption[];
}

type ViewFilter = "week" | "upcoming" | "past" | "all";
type SortField = "numero" | "date" | "statut";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField | null;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded"
      onClick={() => onSort(field)}
    >
      {label}
      {current === field ? (
        dir === "asc" ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      ) : (
        <ArrowUpDown className="size-3.5 opacity-40" />
      )}
    </button>
  );
}



const VIEW_CONFIG: { key: ViewFilter; label: string; icon: typeof CalendarDays }[] = [
  { key: "week", label: "Cette semaine", icon: CalendarDays },
  { key: "upcoming", label: "À venir", icon: CalendarClock },
  { key: "past", label: "Passés", icon: History },
  { key: "all", label: "Tous", icon: ListChecks },
];

function formatRaidDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd/MM/yyyy");
}

function RaidDetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span>
      <span className="font-bold text-muted-foreground/80">{label} :</span>{" "}
      {value}
    </span>
  );
}

function ComiteRaidRow({
  raid: r,
  canActOn,
  onEditRaid,
  onDeleteRaid,
}: {
  raid: RaidItem;
  canActOn: boolean;
  onEditRaid: (raid: RaidItem) => void;
  onDeleteRaid: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const description = r.description?.trim() || "—";
  const categorie = r.categorie?.trim() || "—";
  const domaine = r.domaine?.trim() || "—";

  return (
    <div className="rounded-md border bg-card text-sm">
      <div className="flex items-center gap-3 px-3 py-2">
        <Badge
          className="text-[10px] shrink-0"
          style={{
            backgroundColor: getStatutColor(r.type, r.statut),
            color: "white",
          }}
        >
          {r.statut}
        </Badge>
        <span className="flex-1 min-w-0 truncate font-medium">
          {r.intitule}
        </span>
        {r.responsable && (
          <span className="text-xs text-muted-foreground shrink-0">
            {r.responsable}
          </span>
        )}
        {r.chantier && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            {r.chantier.code}
          </Badge>
        )}
        <div className="flex gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-expanded={open}
            aria-label={open ? "Masquer les détails" : "Afficher les détails"}
            title={open ? "Masquer les détails" : "Afficher les détails"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </Button>
          {canActOn && (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onEditRaid(r)}
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onDeleteRaid(r.id)}
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2.5 text-xs font-light leading-relaxed text-muted-foreground">
          <div>
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground/80">
              Description :
            </p>
            <p className="mt-0.5 whitespace-pre-wrap">{description}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <RaidDetailField label="Catégorie" value={categorie} />
            <RaidDetailField label="Domaine" value={domaine} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <RaidDetailField label="Création" value={formatRaidDate(r.createdAt)} />
            <RaidDetailField
              label="Identification"
              value={formatRaidDate(r.date_identification)}
            />
            <RaidDetailField
              label="Révision"
              value={formatRaidDate(r.date_revision)}
            />
            <RaidDetailField
              label="Échéance initiale"
              value={formatRaidDate(r.date_echeance)}
            />
            <RaidDetailField
              label="Échéance actualisée"
              value={formatRaidDate(r.date_echeance_actualisee)}
            />
            {r.date_fin_reelle ? (
              <RaidDetailField
                label="Fin réelle"
                value={formatRaidDate(r.date_fin_reelle)}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function filterByView(comites: ComiteRow[], view: ViewFilter): ComiteRow[] {
  if (view === "all") return comites;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  switch (view) {
    case "week":
      return comites.filter((c) =>
        isWithinInterval(new Date(c.date), { start: weekStart, end: weekEnd })
      );
    case "upcoming":
      return comites.filter((c) => isAfter(new Date(c.date), weekEnd));
    case "past":
      return comites.filter((c) => isBefore(new Date(c.date), weekStart));
    default:
      return comites;
  }
}

function ComiteRaidSection({
  comite,
  onEditRaid,
  onDeleteRaid,
  onAddRaid,
  canActOn,
}: {
  comite: ComiteRow;
  onEditRaid: (r: RaidItem) => void;
  onDeleteRaid: (id: string) => void;
  onAddRaid?: (comiteId: string) => void;
  canActOn: boolean;
}) {
  const raids = comite.raids;
  const raidsByType = useMemo(() => {
    const map: Record<string, RaidItem[]> = {};
    for (const r of raids) {
      (map[r.type] ??= []).push(r);
    }
    return map;
  }, [raids]);

  return (
    <div className="border-t bg-muted/30 px-6 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            RAID
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {raids.length} élément{raids.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {onAddRaid && canActOn && (
            <Button size="xs" onClick={() => onAddRaid(comite.id)}>
              <Plus className="size-3" />
              Ajouter RAID
            </Button>
          )}
          <RaidExcelExportOnceButton
            ids={raids.map((r) => r.id)}
            slug={`${comite.instance}-${comite.numero}`}
          />
        </div>
      </div>

      {raids.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Aucun élément RAID rattaché à ce comité.
        </p>
      ) : (
        <div className="space-y-2">
          {["Action", "Risque", "Décision", "Information"].map((type) => {
            const items = raidsByType[type];
            if (!items?.length) return null;
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: RAID_TYPE_COLORS[type] }}
                  />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {RAID_TYPE_LABELS[type]}s ({items.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {items.map((r) => (
                    <ComiteRaidRow
                      key={r.id}
                      raid={r}
                      canActOn={canActOn}
                      onEditRaid={onEditRaid}
                      onDeleteRaid={onDeleteRaid}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InstanceTable({
  comites,
  onEdit,
  onDelete,
  onEditRaid,
  onDeleteRaid,
  onAddRaid,
  canActOn,
}: {
  comites: ComiteRow[];
  onEdit: (c: ComiteRow) => void;
  onDelete: (id: string) => void;
  onEditRaid: (r: RaidItem) => void;
  onDeleteRaid: (id: string) => void;
  onAddRaid?: (comiteId: string) => void;
  canActOn: (c: ComiteRow) => boolean;
}) {
  const [sortField, setSortField] = useState<SortField | null>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortField) return comites;
    return [...comites].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "numero": cmp = a.numero - b.numero; break;
        case "date": cmp = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case "statut": cmp = a.statut.localeCompare(b.statut); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [comites, sortField, sortDir]);

  if (comites.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Aucun comité pour cette instance
      </p>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]" />
            <TableHead className="w-[60px]">
              <SortHeader label="#" field="numero" current={sortField} dir={sortDir} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortHeader label="Date" field="date" current={sortField} dir={sortDir} onSort={handleSort} />
            </TableHead>
            <TableHead>Chantier</TableHead>
            <TableHead>Heure</TableHead>
            <TableHead>
              <SortHeader label="Statut" field="statut" current={sortField} dir={sortDir} onSort={handleSort} />
            </TableHead>
            <TableHead>Ordre du jour</TableHead>
            <TableHead className="w-[60px]">Invit.</TableHead>
            <TableHead className="w-[60px]">RAID</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <TableRow
                key={c.id}
                className={isExpanded ? "border-b-0" : ""}
              >
                <TableCell className="pr-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <ChevronRight
                      className={`size-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                </TableCell>
                <TableCell className="text-center font-medium">{c.numero}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {format(new Date(c.date), "dd MMM yyyy", { locale: fr })}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {c.chantier?.code ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{c.heure_casablanca || "—"}</TableCell>
                <TableCell>
                  <Badge
                    className="text-[10px]"
                    style={{ backgroundColor: STATUT_COMITE_COLORS[c.statut] ?? "#6b7280", color: "white" }}
                  >
                    {STATUT_COMITE_LABELS[c.statut] ?? c.statut}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm max-w-[250px] truncate">{c.ordre_du_jour || "—"}</TableCell>
                <TableCell className="text-center">
                  {c.invitation_envoyee ? (
                    <Check className="size-4 text-green-600 mx-auto" />
                  ) : (
                    <X className="size-4 text-muted-foreground mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {c.raids.length > 0 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {c.raids.length}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canActOn(c) && (
                      <>
                    <Button variant="ghost" size="icon-xs" onClick={() => onEdit(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => onDelete(c.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Expanded RAID section — rendered outside table for proper layout */}
      {sorted.map((c) => {
        if (expandedId !== c.id) return null;
        return (
          <ComiteRaidSection
            key={`raid-${c.id}`}
            comite={c}
            onEditRaid={onEditRaid}
            onDeleteRaid={onDeleteRaid}
            onAddRaid={onAddRaid}
            canActOn={canActOn(c)}
          />
        );
      })}
    </div>
  );
}

export function ComitesList({ comites, instances = [] }: Props) {
  const canCreateRaid = useCanCreateRaid();
  const { chantierScope } = useUser();
  const canActOn = (c: ComiteRow) =>
    canActOnComiteSeance(c, { chantierScope, instances });
  const [viewFilter, setViewFilter] = useState<ViewFilter>("week");
  const [niveauFilter, setNiveauFilter] = useState<string>("__all__");
  const [editComite, setEditComite] = useState<ComiteRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editRaid, setEditRaid] = useState<RaidItem | null>(null);
  const [deleteRaidId, setDeleteRaidId] = useState<string | null>(null);
  const [addRaidComiteId, setAddRaidComiteId] = useState<string | null>(null);

  // View counts for badges
  const viewCounts = useMemo(() => {
    const counts: Record<ViewFilter, number> = { week: 0, upcoming: 0, past: 0, all: comites.length };
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    for (const c of comites) {
      const d = new Date(c.date);
      if (isWithinInterval(d, { start: weekStart, end: weekEnd })) counts.week++;
      else if (isAfter(d, weekEnd)) counts.upcoming++;
      else if (isBefore(d, weekStart)) counts.past++;
    }
    return counts;
  }, [comites]);

  const byNiveau = useMemo(() => {
    if (niveauFilter === "__all__") return comites;
    return comites.filter((c) => {
      const param = instances.find((p) => p.name === c.instance);
      const op = isComiteNiveauOperationnel(param?.niveau);
      return niveauFilter === COMITE_NIVEAU_OPERATIONNEL ? op : !op;
    });
  }, [comites, instances, niveauFilter]);

  // Filter by view
  const filtered = useMemo(() => filterByView(byNiveau, viewFilter), [byNiveau, viewFilter]);

  // Group by instance
  const grouped = useMemo(() => {
    const map = new Map<string, ComiteRow[]>();
    for (const c of filtered) {
      const list = map.get(c.instance) ?? [];
      list.push(c);
      map.set(c.instance, list);
    }
    return map;
  }, [filtered]);

  const instanceOrder = useMemo(
    () =>
      orderedInstanceNames(
        instances,
        comites.map((c) => c.instance)
      ),
    [instances, comites]
  );

  // Instances that have data, in order
  const instancesWithData = instanceOrder.filter((i) => grouped.has(i));
  const firstInstance = instancesWithData[0] ?? instanceOrder[0] ?? "calendrier";

  // Calendar events from filtered comités
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return filtered.map((c) => ({
      id: c.id,
      date: new Date(c.date),
      label: `${displayLabelForInstance(c.instance, instances)} #${c.numero}`,
      color: colorForInstance(c.instance, instances),
      sublabel: [c.chantier?.code, c.heure_casablanca].filter(Boolean).join(" · ") || undefined,
      details: {
        "Instance": displayLabelForInstance(c.instance, instances),
        "Numéro": `#${c.numero}`,
        "Chantier": c.chantier ? `${c.chantier.code} — ${c.chantier.nom}` : "",
        "Heure": c.heure_casablanca || "",
        "Statut": STATUT_COMITE_LABELS[c.statut] ?? c.statut,
        "Ordre du jour": c.ordre_du_jour || "",
        "Invitation envoyée": c.invitation_envoyee ? "Oui" : "Non",
      },
    }));
  }, [filtered, instances]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        {(
          [
            ["__all__", "Tous"],
            [COMITE_NIVEAU_GOUVERNANCE, COMITE_NIVEAU_LABELS[COMITE_NIVEAU_GOUVERNANCE]],
            [COMITE_NIVEAU_OPERATIONNEL, COMITE_NIVEAU_LABELS[COMITE_NIVEAU_OPERATIONNEL]],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setNiveauFilter(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              niveauFilter === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Top-level view tabs */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        {VIEW_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setViewFilter(key)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewFilter === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                viewFilter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {viewCounts[key]}
            </span>
          </button>
        ))}
      </div>
      </div>

      {/* Instance sub-tabs */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CalendarDays className="size-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            Aucun comité{" "}
            {viewFilter === "week"
              ? "cette semaine"
              : viewFilter === "upcoming"
              ? "à venir"
              : viewFilter === "past"
              ? "passé"
              : ""}
          </p>
        </div>
      ) : (
        <Tabs defaultValue={firstInstance} key={viewFilter} className="space-y-4">
          <TabsList className="h-auto p-1 gap-1 flex-wrap">
            {instanceOrder.map((inst) => {
              const count = grouped.get(inst)?.length ?? 0;
              if (count === 0) return null;
              const color = colorForInstance(inst, instances);
              return (
                <TabsTrigger
                  key={inst}
                  value={inst}
                  className="gap-2 px-3 py-1.5"
                >
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs">
                    {displayLabelForInstance(inst, instances)}
                  </span>
                  <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                    {count}
                  </span>
                </TabsTrigger>
              );
            })}
            <TabsTrigger value="calendrier" className="gap-2 px-3 py-1.5">
              <Calendar className="size-4 text-primary" />
              <span className="text-xs">Calendrier</span>
            </TabsTrigger>
          </TabsList>

          {instanceOrder.map((inst) => {
            if (!grouped.has(inst)) return null;
            return (
              <TabsContent key={inst} value={inst}>
                <div
                  className="rounded-lg border-l-4 bg-card overflow-hidden"
                  style={{
                    borderLeftColor: colorForInstance(inst, instances),
                  }}
                >
                  <InstanceTable
                    comites={grouped.get(inst) ?? []}
                    onEdit={setEditComite}
                    onDelete={(id) => { setDeleteError(null); setDeleteId(id); }}
                    onEditRaid={setEditRaid}
                    onDeleteRaid={(id) => { setDeleteError(null); setDeleteRaidId(id); }}
                    onAddRaid={canCreateRaid ? setAddRaidComiteId : undefined}
                    canActOn={canActOn}
                  />
                </div>
              </TabsContent>
            );
          })}

          <TabsContent value="calendrier">
            <CalendarView events={calendarEvents} />
          </TabsContent>
        </Tabs>
      )}

      {editComite && (
        <ComiteFormDialog
          open={!!editComite}
          onOpenChange={(open) => !open && setEditComite(null)}
          comite={editComite}
          instances={instances}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={async () => {
          try {
            if (deleteId) await deleteComite(deleteId);
          } catch (err) {
            setDeleteError(
              err instanceof Error ? err.message : "Erreur de suppression"
            );
            throw err;
          }
        }}
        title="Supprimer le comité"
      />

      {/* RAID form for adding from a comité */}
      {addRaidComiteId && (
        <RaidFormDialog
          open={!!addRaidComiteId}
          onOpenChange={(open) => !open && setAddRaidComiteId(null)}
          defaultComiteId={addRaidComiteId}
          defaultChantierId={
            comites.find((c) => c.id === addRaidComiteId)?.chantierId ??
            undefined
          }
          lockChantier={
            !!comites.find((c) => c.id === addRaidComiteId)?.chantierId
          }
        />
      )}

      {/* RAID form for editing */}
      {editRaid && (
        <RaidFormDialog
          open={!!editRaid}
          onOpenChange={(open) => !open && setEditRaid(null)}
          raid={editRaid}
        />
      )}

      {/* RAID delete confirm */}
      <DeleteConfirmDialog
        open={!!deleteRaidId}
        onOpenChange={(open) => !open && setDeleteRaidId(null)}
        requireMotif
        onConfirm={async (motif) => {
          try {
            if (deleteRaidId) await deleteRaid(deleteRaidId, { motif });
          } catch (err) {
            setDeleteError(
              err instanceof Error ? err.message : "Erreur de suppression"
            );
            throw err;
          }
        }}
        title="Supprimer l'élément RAID"
      />

      {deleteError && (
        <p className="text-xs text-destructive mt-2">{deleteError}</p>
      )}
    </>
  );
}
