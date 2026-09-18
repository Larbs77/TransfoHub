"use client";

import { useState, useEffect } from "react";
import {
  createRaid,
  updateRaid,
  getChantiersForSelect,
  getChantiersForRaidCreate,
  getComitesForRaidCreate,
  getComiteParametresCatalog,
  getRisquesForActionLink,
  getRessourcesForSelect,
  getRaidFieldOptions,
} from "@/app/(app)/actions";
import { useUser } from "@/components/user-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  AlertTriangle,
  ClipboardList,
  Info,
  Loader2,
  Pencil,
  PlusCircle,
  Scale,
  ShieldAlert,
} from "lucide-react";
import {
  RAID_TYPES,
  STRATEGIE_LIST,
  PROBABILITE_LABELS,
  IMPACT_LABELS,
  NIVEAU_MAITRISE_VALUES,
  getStatutsForType,
  getStatutsFromConfig,
  evaluateRaidRisque,
  raidRisqueSaisieError,
  CRITICITE_COLORS,
  getLabelsForKind,
  actionRequiresEcheance,
  isRaidClosed,
  risqueAActionsLieesOuvertes,
  type StatusConfigItem,
  type RaidFieldOptionItem,
} from "@/lib/raid-labels";
import type { ComiteParametreOption } from "@/lib/comite-labels";
import { ComiteDrilldownSelect } from "@/components/comite-drilldown-select";
import { RisqueLienSelect } from "@/components/risque-lien-select";

interface RaidData {
  id: string;
  code?: string | null;
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  chantierId: string | null;
  domaine: string;
  probabilite: number | null;
  impact: number | null;
  niveau_maitrise?: string | null;
  strategie: string;
  mitigation: string;
  responsable: string;
  responsableRessourceId: string | null;
  statut: string;
  date_identification: Date | null;
  date_revision: Date | null;
  date_echeance: Date | null;
  date_echeance_actualisee?: Date | null;
  date_fin_reelle?: Date | null;
  commentaires: string;
  comiteId: string | null;
  risqueLieId?: string | null;
  risqueLie?: { id: string; code: string; intitule: string } | null;
  actionsLiees?: Array<{ id: string; statut: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raid?: RaidData | null;
  defaultType?: string;
  defaultChantierId?: string;
  defaultComiteId?: string;
  /** When the RAID comes from an operational committee, chantier is fixed. */
  lockChantier?: boolean;
  statusConfigs?: StatusConfigItem[];
  fieldOptions?: RaidFieldOptionItem[];
}

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

const RAID_FIELD_NONE = "__none__";

export function RaidFormDialog({
  open,
  onOpenChange,
  raid,
  defaultType,
  defaultChantierId,
  defaultComiteId,
  lockChantier = false,
  statusConfigs,
  fieldOptions: fieldOptionsProp,
}: Props) {
  const isEdit = !!raid;
  const { raidCreateScope } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chantiers, setChantiers] = useState<{ id: string; code: string; nom: string }[]>([]);
  const [comites, setComites] = useState<
    {
      id: string;
      instance: string;
      numero: number;
      date: Date;
      chantierId?: string | null;
      chantier?: { id: string; code: string; nom: string } | null;
    }[]
  >([]);
  const [comiteParams, setComiteParams] = useState<ComiteParametreOption[]>([]);
  const [fieldOptions, setFieldOptions] = useState<RaidFieldOptionItem[]>(
    fieldOptionsProp ?? []
  );

  const [type, setType] = useState(raid?.type ?? defaultType ?? "Action");
  const [intitule, setIntitule] = useState(raid?.intitule ?? "");
  const [description, setDescription] = useState(raid?.description ?? "");
  const [categorie, setCategorie] = useState(raid?.categorie ?? "");
  const [chantierId, setChantierId] = useState(raid?.chantierId ?? defaultChantierId ?? "__none__");
  const [domaine, setDomaine] = useState(raid?.domaine ?? "");
  const [probabilite, setProbabilite] = useState<number | "">(raid?.probabilite ?? "");
  const [impact, setImpact] = useState<number | "">(raid?.impact ?? "");
  const [niveauMaitrise, setNiveauMaitrise] = useState(
    raid?.niveau_maitrise &&
      (NIVEAU_MAITRISE_VALUES as readonly string[]).includes(raid.niveau_maitrise)
      ? raid.niveau_maitrise
      : ""
  );
  const [strategie, setStrategie] = useState(raid?.strategie ?? "");
  const [mitigation, setMitigation] = useState(raid?.mitigation ?? "");
  const [responsable, setResponsable] = useState(raid?.responsable ?? "");
  const [responsableRessourceId, setResponsableRessourceId] = useState(
    raid?.responsableRessourceId ?? "__none__"
  );
  const [ressources, setRessources] = useState<
    { id: string; nom_complet: string; type: string; organisation: string }[]
  >([]);
  const [statut, setStatut] = useState(raid?.statut ?? "");
  const [dateIdent, setDateIdent] = useState(toDateInput(raid?.date_identification ?? null));
  const [dateRev, setDateRev] = useState(toDateInput(raid?.date_revision ?? null));
  /** Création : une seule saisie (= initiale + actualisée). Édition : initiale figée. */
  const [dateEcheance, setDateEcheance] = useState(toDateInput(raid?.date_echeance ?? null));
  const [dateEcheanceActualisee, setDateEcheanceActualisee] = useState(
    toDateInput(
      raid?.date_echeance_actualisee ?? raid?.date_echeance ?? null
    )
  );
  const [commentaires, setCommentaires] = useState(raid?.commentaires ?? "");
  const [comiteId, setComiteId] = useState(raid?.comiteId ?? defaultComiteId ?? "__none__");
  const [risqueLieId, setRisqueLieId] = useState(
    raid?.risqueLieId ?? "__none__"
  );
  const [risquesLien, setRisquesLien] = useState<
    { id: string; code: string | null; intitule: string }[]
  >([]);

  const isRisque = type === "Risque";
  const isAction = type === "Action";
  const warnActionsOuvertes =
    isRisque &&
    isRaidClosed(statut) &&
    risqueAActionsLieesOuvertes(raid?.actionsLiees);
  const risqueEval = isRisque
    ? evaluateRaidRisque({
        probabilite: probabilite ? Number(probabilite) : null,
        impact: impact ? Number(impact) : null,
        niveau_maitrise: niveauMaitrise || null,
      })
    : { niveauRisque: null, criticite: null };
  const selectedComite = comites.find((c) => c.id === comiteId);
  const chantierLocked =
    lockChantier || !!(selectedComite?.chantierId);
  const chantierRequiredOnCreate =
    (!isEdit && raidCreateScope === "chantier") || chantierLocked;

  const categorieOptions = (() => {
    const labels = getLabelsForKind("categorie", fieldOptions);
    if (categorie && !labels.includes(categorie)) return [categorie, ...labels];
    return labels;
  })();
  const domaineOptions = (() => {
    const labels = getLabelsForKind("domaine", fieldOptions);
    if (domaine && !labels.includes(domaine)) return [domaine, ...labels];
    return labels;
  })();

  useEffect(() => {
    if (open) {
      setError(null);
      Promise.all([
        isEdit ? getChantiersForSelect() : getChantiersForRaidCreate(),
        getComitesForRaidCreate(isEdit ? raid?.comiteId : null),
        getComiteParametresCatalog().catch(() => [] as ComiteParametreOption[]),
        getRessourcesForSelect(),
        fieldOptionsProp?.length
          ? Promise.resolve(fieldOptionsProp)
          : getRaidFieldOptions().catch(() => [] as RaidFieldOptionItem[]),
        getRisquesForActionLink().catch(
          () => [] as { id: string; code: string | null; intitule: string }[]
        ),
      ]).then(([c, co, params, res, fo, risques]) => {
        setChantiers(c);
        setComites(co);
        setComiteParams(params);
        setRessources(res);
        setFieldOptions(fo);
        const list = [...risques];
        if (
          raid?.risqueLie?.id &&
          !list.some((r) => r.id === raid.risqueLie!.id)
        ) {
          list.unshift({
            id: raid.risqueLie.id,
            code: raid.risqueLie.code,
            intitule: raid.risqueLie.intitule,
          });
        }
        setRisquesLien(list);
      });
    }
  }, [open, isEdit, fieldOptionsProp, raid?.comiteId]);

  useEffect(() => {
    if (selectedComite?.chantierId) {
      setChantierId(selectedComite.chantierId);
    }
  }, [selectedComite?.chantierId]);

  function handleResponsableRessourceChange(newId: string) {
    setResponsableRessourceId(newId);
    if (newId !== "__none__") {
      const selected = ressources.find((r) => r.id === newId);
      if (selected) {
        setResponsable(selected.nom_complet);
      }
    }
  }

  // Reset statut when type changes (only for new items)
  useEffect(() => {
    if (!isEdit) {
      const statuts = statusConfigs?.length ? getStatutsFromConfig(type, statusConfigs) : getStatutsForType(type);
      setStatut(statuts[0]);
    }
  }, [type, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const resolvedChantierId =
      chantierId && chantierId !== "__none__" ? chantierId : null;
    if (chantierRequiredOnCreate && !resolvedChantierId) {
      setError(
        "Un chantier est obligatoire : votre rôle ne permet la création qu'au niveau des chantiers auxquels vous êtes rattaché."
      );
      return;
    }
    const initialeVide = isEdit && !raid?.date_echeance;
    const risqueError = raidRisqueSaisieError({
      type,
      probabilite: probabilite ? Number(probabilite) : null,
      impact: impact ? Number(impact) : null,
      niveau_maitrise: niveauMaitrise || null,
    });
    if (risqueError) {
      setError(risqueError);
      return;
    }
    if (
      type === "Action" &&
      actionRequiresEcheance(statut) &&
      !(dateEcheance || (isEdit && raid?.date_echeance))
    ) {
      setError(
        "Une date d'échéance est obligatoire dès que l'action n'est plus « A planifier »."
      );
      return;
    }
    setLoading(true);
    const data = {
      type,
      intitule,
      description,
      categorie,
      chantierId: resolvedChantierId,
      domaine,
      probabilite: isRisque && probabilite ? Number(probabilite) : null,
      impact: isRisque && impact ? Number(impact) : null,
      niveau_maitrise: isRisque ? niveauMaitrise || "" : "",
      strategie: isRisque ? strategie : "",
      mitigation: isRisque ? mitigation : "",
      responsable,
      responsableRessourceId:
        responsableRessourceId !== "__none__" ? responsableRessourceId : null,
      statut,
      date_identification: dateIdent || null,
      date_revision: dateRev || null,
      // Création : engagement. Édition : initiale seulement si encore vide (premier remplissage).
      date_echeance:
        type === "Action"
          ? isEdit
            ? initialeVide
              ? dateEcheance || null
              : null
            : dateEcheance || null
          : null,
      date_echeance_actualisee:
        type === "Action"
          ? isEdit
            ? dateEcheanceActualisee ||
              (initialeVide ? dateEcheance || null : null)
            : dateEcheance || null
          : null,
      commentaires,
      comiteId: comiteId && comiteId !== "__none__" ? comiteId : null,
      risqueLieId: isAction && risqueLieId !== "__none__" ? risqueLieId : null,
    };
    try {
      if (isEdit) {
        await updateRaid(raid.id, data);
      } else {
        await createRaid(data);
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement."
      );
    } finally {
      setLoading(false);
    }
  }

  const statuts = statusConfigs?.length ? getStatutsFromConfig(type, statusConfigs) : getStatutsForType(type);

  const TypeIcon =
    type === "Risque"
      ? ShieldAlert
      : type === "Action"
        ? ClipboardList
        : type === "Décision"
          ? Scale
          : Info;

  const fieldClass =
    "flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(94vh,920px)] w-[min(100vw-1.5rem,68rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        onInteractOutside={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest?.("[data-comite-picker],[data-risque-lien-picker]")) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest?.("[data-comite-picker],[data-risque-lien-picker]")) {
            e.preventDefault();
          }
        }}
      >
        {/* Header BOA */}
        <div className="shrink-0 border-b bg-gradient-to-br from-white via-[#f7fbfd] to-[#eef8f8] px-6 pb-5 pt-6 dark:from-background dark:via-background dark:to-muted/30">
          <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0A3C74]/15 bg-white/90 px-2.5 py-1 text-xs font-medium text-[#0A3C74] shadow-sm dark:border-border dark:bg-background dark:text-foreground">
              {isEdit ? (
                <Pencil className="size-3.5 text-[#00BDBB]" />
              ) : (
                <PlusCircle className="size-3.5 text-[#00BDBB]" />
              )}
              {isEdit ? "Modification" : "Création"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00BDBB]/30 bg-[#00BDBB]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#0A3C74] dark:text-foreground">
              <TypeIcon className="size-3 text-[#00BDBB]" />
              {type}
            </span>
            {isEdit && raid?.code && (
              <span className="rounded-full border bg-muted/50 px-2.5 py-1 font-mono text-[10px] font-semibold text-[#0A3C74] dark:text-foreground">
                {raid.code}
              </span>
            )}
          </div>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-start gap-2 text-xl font-bold tracking-tight text-[#0A3C74] dark:text-foreground sm:text-2xl">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#00BDBB]" />
              <span className="min-w-0 break-words">
                {isEdit
                  ? `Modifier l'élément RAID${raid?.code ? ` — ${raid.code}` : ""}`
                  : "Nouvel élément RAID"}
              </span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Mettez à jour le suivi risque, action, information ou décision."
                : "Renseignez le type, le rattachement et le pilotage de l'élément RAID."}
            </p>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {isEdit && raid?.code ? (
              <div className="rounded-xl border border-[#0A3C74]/12 bg-[#0A3C74]/[0.03] px-4 py-3 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00BDBB]">
                  Code
                </span>
                <p className="mt-0.5 font-mono text-base font-bold text-[#0A3C74] dark:text-foreground">
                  {raid.code}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Attribué automatiquement à la création — non modifiable.
                </p>
              </div>
            ) : (
              <div className="flex gap-3 rounded-xl border border-dashed border-[#00BDBB]/35 bg-[#00BDBB]/5 px-4 py-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-[#00BDBB]" />
                <p className="leading-relaxed text-muted-foreground">
                  Un code sera attribué automatiquement à l&apos;enregistrement
                  (A_##### action, R_ risque, I_ information, D_ décision).
                </p>
              </div>
            )}

            {/* Identification */}
            <section className="space-y-3 rounded-xl border border-[#0A3C74]/10 bg-muted/20 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00BDBB]">
                Identification
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RAID_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Statut</label>
                  <Select value={statut} onValueChange={setStatut}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuts.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Intitulé <span className="text-destructive">*</span>
                </label>
                <Input
                  value={intitule}
                  onChange={(e) => setIntitule(e.target.value)}
                  required
                  placeholder="Intitulé synthétique de l'élément RAID"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className={fieldClass}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contexte, détail, enjeux…"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Catégorie</label>
                  <Select
                    value={categorie || RAID_FIELD_NONE}
                    onValueChange={(v) =>
                      setCategorie(v === RAID_FIELD_NONE ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RAID_FIELD_NONE}>
                        Sélectionner
                      </SelectItem>
                      {categorieOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Domaine</label>
                  <Select
                    value={domaine || RAID_FIELD_NONE}
                    onValueChange={(v) =>
                      setDomaine(v === RAID_FIELD_NONE ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={RAID_FIELD_NONE}>
                        Sélectionner
                      </SelectItem>
                      {domaineOptions.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Rattachement */}
            <section className="space-y-3 rounded-xl border border-[#0A3C74]/10 bg-muted/20 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00BDBB]">
                Rattachement
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid min-w-0 gap-1.5">
                  <label className="text-sm font-medium">
                    Chantier
                    {chantierRequiredOnCreate && (
                      <span className="text-destructive"> *</span>
                    )}
                  </label>
                  <Select
                    value={chantierId}
                    onValueChange={setChantierId}
                    disabled={chantierLocked}
                  >
                    <SelectTrigger className="w-full overflow-hidden">
                      <span className="truncate">
                        <SelectValue
                          placeholder={
                            chantierRequiredOnCreate
                              ? "Sélectionner un chantier"
                              : "Aucun"
                          }
                        />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {!chantierRequiredOnCreate && (
                        <SelectItem value="__none__">Aucun</SelectItem>
                      )}
                      {chantiers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} - {c.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {chantierLocked ? (
                    <p className="text-[11px] text-muted-foreground">
                      Chantier hérité du comité opérationnel.
                    </p>
                  ) : chantierRequiredOnCreate ? (
                    <p className="text-[11px] text-muted-foreground">
                      Niveau Chantier : uniquement les chantiers auxquels vous
                      êtes rattaché.
                    </p>
                  ) : null}
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <label className="text-sm font-medium">Comité</label>
                  <ComiteDrilldownSelect
                    comites={comites}
                    params={comiteParams}
                    value={comiteId}
                    onChange={setComiteId}
                    noneValue="__none__"
                    placeholder="Aucun"
                  />
                </div>
              </div>
              {isAction ? (
                <div className="grid min-w-0 gap-1.5">
                  <label className="text-sm font-medium">Risque lié</label>
                  <RisqueLienSelect
                    risques={risquesLien}
                    value={risqueLieId}
                    onChange={setRisqueLieId}
                    noneValue="__none__"
                    placeholder="Aucun"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Optionnel — relie cette action à un risque du registre.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">
                    Ressource responsable
                  </label>
                  <Select
                    value={responsableRessourceId}
                    onValueChange={handleResponsableRessourceChange}
                  >
                    <SelectTrigger className="w-full overflow-hidden">
                      <span className="truncate">
                        <SelectValue placeholder="Aucun(e)" />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun(e)</SelectItem>
                      {ressources.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nom_complet}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">
                    Responsable (texte)
                  </label>
                  <Input
                    value={responsable}
                    onChange={(e) => setResponsable(e.target.value)}
                    placeholder="Nom libre si pas de ressource"
                  />
                </div>
              </div>
            </section>

            {warnActionsOuvertes ? (
              <div
                className="flex gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100"
                role="status"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  Attention : des actions liées ne sont pas encore clôturées.
                  Vous pouvez quand même clôturer ce risque.
                </p>
              </div>
            ) : null}

            {/* Risque */}
            {isRisque && (
              <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="size-3.5" />
                  Analyse du risque
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">
                      Probabilité <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={probabilite ? String(probabilite) : undefined}
                      onValueChange={(v) => setProbabilite(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROBABILITE_LABELS).map(
                          ([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">
                      Impact <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={impact ? String(impact) : undefined}
                      onValueChange={(v) => setImpact(Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(IMPACT_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">
                      Niveau de risque
                    </label>
                    <div
                      className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium"
                      aria-readonly="true"
                    >
                      {risqueEval.niveauRisque ? (
                        <span>{risqueEval.niveauRisque}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Calculé automatiquement (probabilité × impact) — non
                      modifiable
                    </p>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">
                      Niveau de maîtrise{" "}
                      <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={niveauMaitrise || undefined}
                      onValueChange={setNiveauMaitrise}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIVEAU_MAITRISE_VALUES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Criticité</label>
                    <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3">
                      {risqueEval.criticite ? (
                        <>
                          <span
                            className="inline-block size-2.5 rounded-sm"
                            style={{
                              backgroundColor:
                                CRITICITE_COLORS[risqueEval.criticite],
                            }}
                          />
                          <span className="text-sm font-medium">
                            {risqueEval.criticite}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {risqueEval.niveauRisque
                            ? "Saisir la maîtrise"
                            : "—"}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Calculée (niveau de risque × maîtrise) — non modifiable
                    </p>
                  </div>
                </div>
                <div className="grid gap-1.5 sm:max-w-md">
                  <label className="text-sm font-medium">Stratégie</label>
                  <Select
                    value={strategie || undefined}
                    onValueChange={setStrategie}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGIE_LIST.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Mitigation</label>
                  <textarea
                    className={fieldClass}
                    value={mitigation}
                    onChange={(e) => setMitigation(e.target.value)}
                    placeholder="Mesures de mitigation, plan de traitement…"
                  />
                </div>
              </section>
            )}

            {/* Pilotage */}
            <section className="space-y-3 rounded-xl border border-[#0A3C74]/10 bg-muted/20 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00BDBB]">
                Pilotage & dates
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">
                    Date identification
                  </label>
                  <Input
                    type="date"
                    value={dateIdent}
                    onChange={(e) => setDateIdent(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Date révision</label>
                  <Input
                    type="date"
                    value={dateRev}
                    onChange={(e) => setDateRev(e.target.value)}
                  />
                </div>
              </div>
              {type === "Action" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {isEdit ? (
                    <>
                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium">
                          Échéance initiale
                          {actionRequiresEcheance(statut) && !raid?.date_echeance
                            ? " *"
                            : ""}
                        </label>
                        <Input
                          type="date"
                          value={dateEcheance}
                          disabled={!!raid?.date_echeance}
                          className={raid?.date_echeance ? "bg-muted/50" : undefined}
                          title={
                            raid?.date_echeance
                              ? "Figée une fois renseignée — non modifiable"
                              : "Premier remplissage : cette date sera ensuite figée"
                          }
                          onChange={(e) => setDateEcheance(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {raid?.date_echeance
                            ? "Engagement d'origine — non modifiable."
                            : "Vide tant que l'action n'est pas planifiée. Une fois saisie, elle est figée."}
                        </p>
                      </div>
                      <div className="grid gap-1.5">
                        <label className="text-sm font-medium">
                          Échéance actualisée
                        </label>
                        <Input
                          type="date"
                          value={dateEcheanceActualisee}
                          onChange={(e) =>
                            setDateEcheanceActualisee(e.target.value)
                          }
                          title="Seule échéance de pilotage modifiable"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Date de fin de pilotage — modifiable librement (pas de
                          workflow).
                        </p>
                      </div>
                      {raid?.date_fin_reelle && (
                        <div className="grid gap-1.5 sm:col-span-2">
                          <label className="text-sm font-medium">
                            Date de fin réelle
                          </label>
                          <Input
                            type="date"
                            value={toDateInput(raid.date_fin_reelle)}
                            disabled
                            className="bg-muted/50 max-w-xs"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Renseignée automatiquement à la clôture (statut
                            terminal).
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid gap-1.5 sm:col-span-2 sm:max-w-xs">
                      <label className="text-sm font-medium">
                        Date d&apos;échéance
                        {actionRequiresEcheance(statut) ? " *" : ""}
                      </label>
                      <Input
                        type="date"
                        value={dateEcheance}
                        onChange={(e) => setDateEcheance(e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Optionnelle tant que le statut est « A planifier ».
                        Obligatoire ensuite, puis figée. L&apos;actualisée pourra
                        évoluer sans workflow.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Commentaires</label>
                <textarea
                  className={fieldClass}
                  value={commentaires}
                  onChange={(e) => setCommentaires(e.target.value)}
                  placeholder="Notes de suivi, points d'attention…"
                />
              </div>
            </section>

            {error && (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-between">
            <p className="hidden max-w-md text-xs text-muted-foreground sm:block">
              Les champs marqués d&apos;un astérisque sont obligatoires.
            </p>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="min-w-[8.5rem] bg-[#0A3C74] hover:bg-[#0A3C74]/90"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Enregistrer" : "Créer l'élément"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
