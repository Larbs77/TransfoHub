"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { createAdherence, updateAdherence } from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowRight,
  Link2,
  Package,
  ClipboardList,
  Hash,
  Layers,
  Flag,
  Globe2,
  CircleDot,
  AlignLeft,
  Calendar,
  CalendarClock,
  UserRound,
  FileBadge,
  MessageSquare,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { ChantierSelect, ChantierMultiSelect } from "@/components/chantier-select";
import {
  ADHERENCE_TYPES,
  ADHERENCE_STATUTS,
  ADHERENCE_CRITICITES,
  ADHERENCE_DOMAINES,
} from "@/lib/adherence-labels";
import { cn } from "@/lib/utils";

interface ChantierOption {
  id: string;
  code: string;
  nom: string;
}

interface AdherenceData {
  id: string;
  code: string;
  chantierSourceId: string;
  chantierDependantLabel: string;
  dependants?: Array<{ chantier: { id: string; code: string; nom: string } }>;
  type: string;
  domaine: string;
  description: string;
  livrables?: string;
  criticite: string;
  statut: string;
  date_identification: Date | null;
  date_resolution_prevue: Date | null;
  responsable: string;
  contrat_interface: string;
  commentaires: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adherence?: AdherenceData | null;
  chantiers: ChantierOption[];
  chantiersDependant?: ChantierOption[];
  nextCode: string;
  defaultSourceId?: string;
  /** Transverse (tous chantiers) — Bureau Programme / Admin only. */
  allowTransverse?: boolean;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

const FIELD_NONE = "__none__";

const controlClass =
  "h-10 w-full rounded-lg border-[#0A3C74]/15 bg-background shadow-none focus-visible:border-[#00BDBB]/50 focus-visible:ring-[#00BDBB]/35";

const pickerClass =
  "h-10 rounded-lg border-[#0A3C74]/15 bg-background pl-10 shadow-none focus-visible:border-[#00BDBB]/50 focus-visible:ring-[#00BDBB]/35";

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-[#0A3C74]/8 text-[#0A3C74] dark:text-[#00BDBB]">
        <Icon className="size-4" />
      </span>
      <h3 className="text-sm font-semibold tracking-tight text-[#0A3C74] dark:text-foreground">
        {children}
      </h3>
      <span className="h-px flex-1 bg-[#0A3C74]/10" />
    </div>
  );
}

function FieldLabel({
  icon: Icon,
  children,
  required,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon ? <Icon className="size-3.5 text-[#00BDBB]" /> : null}
      <label className="text-[13px] font-medium text-[#0A3C74] dark:text-foreground">
        {children}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
    </div>
  );
}

function IconControl({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[#00BDBB]" />
      {children}
    </div>
  );
}

export function AdherenceFormDialog({
  open,
  onOpenChange,
  adherence,
  chantiers,
  chantiersDependant,
  nextCode,
  defaultSourceId,
  allowTransverse = false,
}: Props) {
  const isEdit = !!adherence;
  const dependantOptions = chantiersDependant?.length
    ? chantiersDependant
    : chantiers;
  const defaultDemandeurIds = () => {
    if (adherence?.dependants?.length) {
      return adherence.dependants.map((d) => d.chantier.id);
    }
    if (!adherence && dependantOptions.length === 1) {
      return [dependantOptions[0].id];
    }
    return [];
  };
  const sourceOptions = useMemo(() => {
    const list = [...chantiers];
    const currentId = adherence?.chantierSourceId ?? defaultSourceId;
    if (currentId && !list.some((c) => c.id === currentId)) {
      const extra = dependantOptions.find((c) => c.id === currentId);
      if (extra) list.unshift(extra);
    }
    return list;
  }, [chantiers, dependantOptions, adherence?.chantierSourceId, defaultSourceId]);
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState(adherence?.code ?? nextCode);
  const [chantierSourceId, setChantierSourceId] = useState(
    adherence?.chantierSourceId ?? defaultSourceId ?? ""
  );
  const [chantierDependantIds, setChantierDependantIds] = useState<string[]>(
    defaultDemandeurIds
  );
  const [chantierDependantLabel, setChantierDependantLabel] = useState(
    adherence?.chantierDependantLabel ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(adherence?.type ?? "");
  const [domaine, setDomaine] = useState(adherence?.domaine ?? "");
  const [description, setDescription] = useState(adherence?.description ?? "");
  const [livrables, setLivrables] = useState(adherence?.livrables ?? "");
  const [criticite, setCriticite] = useState(adherence?.criticite ?? "");
  const [statut, setStatut] = useState(adherence?.statut ?? "");
  const [dateIdent, setDateIdent] = useState(
    toDateInput(adherence?.date_identification)
  );
  const [dateResolution, setDateResolution] = useState(
    toDateInput(adherence?.date_resolution_prevue)
  );
  const [responsable, setResponsable] = useState(adherence?.responsable ?? "");
  const [contratInterface, setContratInterface] = useState(
    adherence?.contrat_interface ?? ""
  );
  const [commentaires, setCommentaires] = useState(
    adherence?.commentaires ?? ""
  );
  const [isTransverse, setIsTransverse] = useState(
    allowTransverse &&
      !adherence?.dependants?.length &&
      !!adherence?.chantierDependantLabel
  );

  useEffect(() => {
    if (open) {
      setError(null);
      setCode(adherence?.code ?? nextCode);
      setChantierSourceId(adherence?.chantierSourceId ?? defaultSourceId ?? "");
      setChantierDependantIds(
        adherence?.dependants?.length
          ? adherence.dependants.map((d) => d.chantier.id)
          : !adherence && dependantOptions.length === 1
            ? [dependantOptions[0].id]
            : []
      );
      setChantierDependantLabel(adherence?.chantierDependantLabel ?? "");
      setType(adherence?.type ?? "");
      setDomaine(adherence?.domaine ?? "");
      setDescription(adherence?.description ?? "");
      setLivrables(adherence?.livrables ?? "");
      setCriticite(adherence?.criticite ?? "");
      setStatut(adherence?.statut ?? "");
      setDateIdent(toDateInput(adherence?.date_identification));
      setDateResolution(toDateInput(adherence?.date_resolution_prevue));
      setResponsable(adherence?.responsable ?? "");
      setContratInterface(adherence?.contrat_interface ?? "");
      setCommentaires(adherence?.commentaires ?? "");
      setIsTransverse(
        allowTransverse &&
          !adherence?.dependants?.length &&
          !!adherence?.chantierDependantLabel
      );
    }
  }, [
    open,
    adherence,
    nextCode,
    defaultSourceId,
    allowTransverse,
    dependantOptions.length,
    dependantOptions[0]?.id,
  ]);

  const demandeurPreview = isTransverse
    ? chantierDependantLabel.trim() || "Tous chantiers"
    : dependantOptions
        .filter((c) => chantierDependantIds.includes(c.id))
        .map((c) => c.code)
        .join(", ") || "—";
  const fournisseurPreview =
    sourceOptions.find((c) => c.id === chantierSourceId)?.code ?? "—";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isTransverse && chantierDependantIds.length === 0) {
      setError(
        allowTransverse
          ? "Sélectionnez au moins un chantier demandeur, ou cochez Transverse."
          : "Sélectionnez au moins un chantier demandeur (votre chantier)."
      );
      return;
    }
    if (!chantierSourceId) {
      setError("Le chantier fournisseur est obligatoire.");
      return;
    }
    if (!type.trim()) {
      setError("Le type est obligatoire.");
      return;
    }
    if (!criticite.trim()) {
      setError("La criticité est obligatoire.");
      return;
    }
    if (!statut.trim()) {
      setError("Le statut est obligatoire.");
      return;
    }
    setLoading(true);
    const data = {
      code,
      chantierSourceId,
      chantierDependantIds: isTransverse ? [] : chantierDependantIds,
      chantierDependantLabel: isTransverse
        ? chantierDependantLabel.trim() || "Tous chantiers"
        : "",
      type,
      domaine,
      description,
      livrables,
      criticite,
      statut,
      date_identification: dateIdent || null,
      date_resolution_prevue: dateResolution || null,
      responsable,
      contrat_interface: contratInterface,
      commentaires,
    };
    try {
      if (isEdit) {
        await updateAdherence(adherence.id, data);
      } else {
        await createAdherence(data);
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Enregistrement impossible."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[min(96vw,80rem)] max-w-none flex-col overflow-hidden p-0 sm:max-w-none"
        onInteractOutside={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest?.("[data-chantier-picker]")) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest?.("[data-chantier-picker]")) e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-1 border-b bg-[#0A3C74]/[0.04] px-8 py-5 pr-14">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#0A3C74] text-white">
              <Link2 className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg">
                {isEdit ? "Modifier l'adhérence" : "Nouvelle adhérence"}
              </DialogTitle>
              <DialogDescription>
                Déclarez ce que le chantier demandeur attend du chantier
                fournisseur.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="grid flex-1 gap-7 overflow-y-auto px-8 py-6"
        >
          <section className="space-y-4">
            <SectionTitle icon={Link2}>Relation de dépendance</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
              <div className="grid min-w-0 gap-2 rounded-xl border border-[#0A3C74]/10 bg-[#0A3C74]/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FieldLabel icon={UserRound} required>
                    {allowTransverse
                      ? "Chantier demandeur"
                      : "Mon chantier (demandeur)"}
                  </FieldLabel>
                  {allowTransverse ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={isTransverse}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setIsTransverse(next);
                          if (next) setChantierDependantIds([]);
                        }}
                        className="rounded border-[#0A3C74]/30"
                      />
                      Transverse
                    </label>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Chantier qui attend les livrables.
                </p>
                {isTransverse ? (
                  <IconControl icon={UserRound}>
                    <Input
                      value={chantierDependantLabel}
                      onChange={(e) => setChantierDependantLabel(e.target.value)}
                      placeholder="Ex: Tous chantiers applicatifs"
                      className={cn(controlClass, "pl-10")}
                    />
                  </IconControl>
                ) : (
                  <IconControl icon={UserRound}>
                    <ChantierMultiSelect
                      chantiers={dependantOptions}
                      value={chantierDependantIds}
                      onChange={(ids) => {
                        setChantierDependantIds(ids);
                        if (chantierSourceId && ids.includes(chantierSourceId)) {
                          setChantierSourceId("");
                        }
                      }}
                      excludeId={chantierSourceId || undefined}
                      placeholder={
                        allowTransverse
                          ? "Sélectionner un ou plusieurs chantiers demandeurs…"
                          : "Sélectionner votre chantier…"
                      }
                      className={pickerClass}
                    />
                  </IconControl>
                )}
              </div>

              <div className="hidden flex-col items-center justify-center gap-1 lg:flex">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#00BDBB]">
                  dépend de
                </span>
                <span className="flex size-9 items-center justify-center rounded-full border border-[#00BDBB]/30 bg-[#00BDBB]/10">
                  <ArrowRight className="size-4 text-[#0A3C74] dark:text-[#00BDBB]" />
                </span>
              </div>

              <div className="grid min-w-0 gap-2 rounded-xl border border-[#0A3C74]/10 bg-[#0A3C74]/[0.03] p-4">
                <FieldLabel icon={Building2} required>
                  {allowTransverse
                    ? "Chantier fournisseur"
                    : "Chantier dont je dépends (fournisseur)"}
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Chantier qui produit les livrables attendus.
                </p>
                <IconControl icon={Building2}>
                  <ChantierSelect
                    chantiers={sourceOptions.filter(
                      (c) =>
                        c.id === chantierSourceId ||
                        !chantierDependantIds.includes(c.id)
                    )}
                    value={chantierSourceId}
                    onChange={(id) => {
                      setChantierSourceId(id);
                      setChantierDependantIds((prev) =>
                        prev.filter((d) => d !== id)
                      );
                    }}
                    placeholder="Sélectionner le chantier fournisseur…"
                    className={pickerClass}
                  />
                </IconControl>
              </div>
            </div>
            <p
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm",
                "border-[#00BDBB]/25 bg-[#00BDBB]/[0.06] text-muted-foreground"
              )}
            >
              <Link2 className="size-4 shrink-0 text-[#00BDBB]" />
              <span>
                <span className="font-medium text-foreground">
                  {demandeurPreview}
                </span>{" "}
                dépend des livrables de{" "}
                <span className="font-medium text-foreground">
                  {fournisseurPreview}
                </span>
                .
              </span>
            </p>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={ClipboardList}>Identification</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="grid gap-1.5">
                <FieldLabel icon={Hash}>Code</FieldLabel>
                <IconControl icon={Hash}>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className={cn(controlClass, "pl-10 font-mono")}
                  />
                </IconControl>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel icon={Layers} required>
                  Type
                </FieldLabel>
                <IconControl icon={Layers}>
                  <Select
                    value={type || FIELD_NONE}
                    onValueChange={(v) => setType(v === FIELD_NONE ? "" : v)}
                  >
                    <SelectTrigger className={cn(controlClass, "pl-10")}>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                      {ADHERENCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </IconControl>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel icon={Flag} required>
                  Criticité
                </FieldLabel>
                <IconControl icon={Flag}>
                  <Select
                    value={criticite || FIELD_NONE}
                    onValueChange={(v) =>
                      setCriticite(v === FIELD_NONE ? "" : v)
                    }
                  >
                    <SelectTrigger className={cn(controlClass, "pl-10")}>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                      {ADHERENCE_CRITICITES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </IconControl>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel icon={Globe2}>Domaine</FieldLabel>
                <IconControl icon={Globe2}>
                  <Select
                    value={domaine || FIELD_NONE}
                    onValueChange={(v) => setDomaine(v === FIELD_NONE ? "" : v)}
                  >
                    <SelectTrigger className={cn(controlClass, "pl-10")}>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                      {ADHERENCE_DOMAINES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </IconControl>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel icon={CircleDot} required>
                  Statut
                </FieldLabel>
                <IconControl icon={CircleDot}>
                  <Select
                    value={statut || FIELD_NONE}
                    onValueChange={(v) => setStatut(v === FIELD_NONE ? "" : v)}
                  >
                    <SelectTrigger className={cn(controlClass, "pl-10")}>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                      {ADHERENCE_STATUTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </IconControl>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={Package}>Livrables et description</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
              <div className="overflow-hidden rounded-xl border border-[#0A3C74]/12">
                <div className="flex items-center gap-2 border-b border-[#0A3C74]/10 bg-[#0A3C74]/[0.03] px-3 py-2">
                  <AlignLeft className="size-3.5 text-[#00BDBB]" />
                  <span className="text-[13px] font-medium text-[#0A3C74] dark:text-foreground">
                    Description
                  </span>
                </div>
                <textarea
                  className="min-h-[11rem] w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objet de l'adhérence, contexte, interface…"
                />
              </div>
              <div className="overflow-hidden rounded-xl border border-[#0A3C74]/12">
                <div className="flex items-center gap-2 border-b border-[#0A3C74]/10 bg-[#0A3C74]/[0.03] px-3 py-2">
                  <Package className="size-3.5 text-[#00BDBB]" />
                  <span className="text-[13px] font-medium text-[#0A3C74] dark:text-foreground">
                    Liste des livrables
                  </span>
                </div>
                <textarea
                  className="min-h-[11rem] w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  value={livrables}
                  onChange={(e) => setLivrables(e.target.value)}
                  placeholder={
                    "Un livrable par ligne…\n- Spécifications d'interface CI-041-023\n- Environnements de recette disponibles\n- Jeu de données de migration"
                  }
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionTitle icon={ClipboardList}>Pilotage</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-1.5">
                <FieldLabel icon={Calendar}>Date identification</FieldLabel>
                <IconControl icon={Calendar}>
                  <Input
                    type="date"
                    value={dateIdent}
                    onChange={(e) => setDateIdent(e.target.value)}
                    className={cn(controlClass, "pl-10")}
                  />
                </IconControl>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel icon={CalendarClock}>
                  Date résolution prévue
                </FieldLabel>
                <IconControl icon={CalendarClock}>
                  <Input
                    type="date"
                    value={dateResolution}
                    onChange={(e) => setDateResolution(e.target.value)}
                    className={cn(controlClass, "pl-10")}
                  />
                </IconControl>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel icon={UserRound}>Responsable</FieldLabel>
                <IconControl icon={UserRound}>
                  <Input
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    placeholder="Lead Archi, Lead RSSI…"
                    className={cn(controlClass, "pl-10")}
                  />
                </IconControl>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel icon={FileBadge}>Contrat d&apos;interface</FieldLabel>
                <IconControl icon={FileBadge}>
                  <Input
                    value={contratInterface}
                    onChange={(e) => setContratInterface(e.target.value)}
                    placeholder="CI-xxx-xxx"
                    className={cn(controlClass, "pl-10")}
                  />
                </IconControl>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[#0A3C74]/12">
              <div className="flex items-center gap-2 border-b border-[#0A3C74]/10 bg-[#0A3C74]/[0.03] px-3 py-2">
                <MessageSquare className="size-3.5 text-[#00BDBB]" />
                <span className="text-[13px] font-medium text-[#0A3C74] dark:text-foreground">
                  Commentaires
                </span>
              </div>
              <textarea
                className="min-h-[5.5rem] w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                value={commentaires}
                onChange={(e) => setCommentaires(e.target.value)}
                placeholder="Notes additionnelles…"
              />
            </div>
          </section>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="sticky bottom-0 -mx-8 border-t bg-background px-8 py-4 sm:justify-between">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Les champs marqués d&apos;un astérisque sont obligatoires.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
