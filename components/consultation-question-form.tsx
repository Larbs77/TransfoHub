"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createConsultationQuestion,
  updateConsultationQuestion,
  getChantiersForSelect,
  getConsultationAssignmentOptions,
  getQaWorkflowUiState,
} from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  HelpCircle,
  Pencil,
  FilePlus2,
  FolderKanban,
  MessageSquareText,
  Tags,
  Users,
  UserRound,
  Building2,
  Network,
  CheckCircle2,
  AlertCircle,
  Send,
  ArrowLeft,
} from "lucide-react";
import {
  QA_CATEGORIES,
  QA_PRIORITES,
  QA_STATUTS,
  QA_CATEGORIE_COLORS,
  QA_PRIORITE_COLORS,
  QA_STATUT_COLORS,
} from "@/lib/consultation-labels";
import {
  type AffectationKind,
  type ChantierRoleTag,
  encodeAffecteeA,
  encodeOrgAffecteeA,
  parseAffecteeA,
  formatAffecteeADisplay,
} from "@/lib/consultation-affectation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const BOA_NAVY = "#0A3C74";
const BOA_TEAL = "#00BDBB";

type AssignTarget = AffectationKind | "none";

type OptionItem = {
  id: string;
  label: string;
  hint?: string;
  chantierId?: string | null;
  tag?: ChantierRoleTag | null;
  sortRank?: number;
  group?: string;
};

const SELECT_TRIGGER_CLASS =
  "h-auto min-h-10 w-full min-w-0 max-w-full justify-between gap-2 overflow-hidden bg-background py-2 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate";
const SELECT_CONTENT_CLASS =
  "w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[min(96vw,42rem)]";

/** Compact chantier label: code fixed + nom truncated (select trigger & items). */
function ChantierOptionLabel({
  code,
  nom,
}: {
  code: string;
  nom: string;
}) {
  return (
    <span className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
      <span className="shrink-0 rounded-md border border-[#0A3C74]/15 bg-[#0A3C74]/[0.06] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#0A3C74]">
        {code}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground">
        {nom}
      </span>
    </span>
  );
}

interface QuestionData {
  id: string;
  chantierId: string;
  dossier_ref: string;
  question: string;
  categorie: string;
  priorite: string;
  statut: string;
  remontee_par: string;
  affectee_a: string;
  echeance: Date | null;
  echeance_actualisee?: Date | null;
  date_fin_reelle?: Date | null;
  resolution: string;
}

interface Props {
  /** Dialog mode: controlled open. Page mode: ignore (always shown). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  question?: QuestionData | null;
  defaultChantierId?: string;
  /**
   * dialog = popup compacte (création)
   * page = écran plein pour modification (plus d'espace)
   */
  variant?: "dialog" | "page";
  /** Retour après enregistrement (page) */
  backHref?: string;
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2 border-b border-border/60 pb-2">
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${BOA_NAVY}12`, color: BOA_NAVY }}
        >
          <Icon className="size-3.5" style={{ color: BOA_TEAL }} />
        </span>
        <div className="min-w-0">
          <h3
            className="text-sm font-semibold tracking-tight"
            style={{ color: BOA_NAVY }}
          >
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function RoleTagBadge({ tag }: { tag: ChantierRoleTag }) {
  const styles: Record<ChantierRoleTag, string> = {
    DC: "border-[#0A3C74]/30 bg-[#0A3C74]/10 text-[#0A3C74]",
    Sup: "border-sky-500/35 bg-sky-500/12 text-sky-800 dark:text-sky-200",
    PMO: "border-[#00BDBB]/40 bg-[#00BDBB]/12 text-[#0A3C74]",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${styles[tag]}`}
    >
      {tag}
    </span>
  );
}

function PersonOptionLabel({
  label,
  tag,
  hint,
}: {
  label: string;
  tag?: ChantierRoleTag | null;
  hint?: string;
}) {
  return (
    <span className="flex min-w-0 max-w-full flex-col items-start gap-0.5 overflow-hidden">
      <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
        {tag ? <RoleTagBadge tag={tag} /> : null}
        <span className="min-w-0 truncate font-medium">{label}</span>
      </span>
      {hint ? (
        <span className="w-full truncate text-[11px] text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

const TARGET_OPTIONS: {
  value: AssignTarget;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  hint: string;
}[] = [
  {
    value: "none",
    label: "Non affectée",
    icon: HelpCircle,
    hint: "Aucun destinataire",
  },
  {
    value: "team_func",
    label: "Équipe chantier",
    icon: Network,
    hint: "Membres du chantier (DC, Sup, PMO…)",
  },
  {
    value: "person",
    label: "Ressource",
    icon: UserRound,
    hint: "Ressource nominative (catalogue)",
  },
  {
    value: "team_inst",
    label: "Équipe organisationnelle",
    icon: Building2,
    hint: "Unité org. + porteur (chantier ou BP)",
  },
];

export function ConsultationQuestionForm({
  open = true,
  onOpenChange,
  question,
  defaultChantierId,
  variant = "dialog",
  backHref = "/consultation-backlog",
}: Props) {
  const router = useRouter();
  const isPage = variant === "page";
  const isEdit = !!question;

  function closeForm() {
    if (isPage) {
      router.push(backHref);
      router.refresh();
    } else {
      onOpenChange?.(false);
    }
  }

  const [chantierId, setChantierId] = useState(
    question?.chantierId ?? defaultChantierId ?? ""
  );
  const [dossierRef, setDossierRef] = useState(question?.dossier_ref ?? "");
  const [questionText, setQuestionText] = useState(question?.question ?? "");
  const [categorie, setCategorie] = useState(question?.categorie ?? "Générale");
  const [priorite, setPriorite] = useState(question?.priorite ?? "Moyenne");
  const [statut, setStatut] = useState(question?.statut ?? "Ouverte");
  const [remonteePar, setRemonteePar] = useState(question?.remontee_par ?? "");
  const [assignTarget, setAssignTarget] = useState<AssignTarget>("none");
  /** person / team_func (person id) / team_inst (org team id) */
  const [assignId, setAssignId] = useState("");
  /** Porteur when assignTarget === team_inst (org) */
  const [orgPorteurId, setOrgPorteurId] = useState("");
  const [legacyAffectee, setLegacyAffectee] = useState("");
  const [echeance, setEcheance] = useState(
    question?.echeance ? format(new Date(question.echeance), "yyyy-MM-dd") : ""
  );
  const [echeanceActualisee, setEcheanceActualisee] = useState(
    question?.echeance_actualisee
      ? format(new Date(question.echeance_actualisee), "yyyy-MM-dd")
      : question?.echeance
        ? format(new Date(question.echeance), "yyyy-MM-dd")
        : ""
  );
  const [resolution, setResolution] = useState(question?.resolution ?? "");
  const [saving, setSaving] = useState(false);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [motif, setMotif] = useState("");
  const [qaModes, setQaModes] = useState({
    create: "DIRECT",
    update: "DIRECT",
    delete: "DIRECT",
  });
  const [chantiers, setChantiers] = useState<
    { id: string; code: string; nom: string }[]
  >([]);
  const [personnes, setPersonnes] = useState<OptionItem[]>([]);
  const [equipesOrg, setEquipesOrg] = useState<OptionItem[]>([]);
  const [personnesEquipeChantier, setPersonnesEquipeChantier] = useState<
    OptionItem[]
  >([]);
  const [porteursOrg, setPorteursOrg] = useState<OptionItem[]>([]);

  function applyAffecteeFromStored(raw: string) {
    const parsed = parseAffecteeA(raw);
    if (parsed.kind === "none") {
      setAssignTarget("none");
      setAssignId("");
      setOrgPorteurId("");
      setLegacyAffectee("");
      return;
    }
    if (parsed.kind === "legacy") {
      setAssignTarget("none");
      setAssignId("");
      setOrgPorteurId("");
      setLegacyAffectee(parsed.label);
      return;
    }
    if (parsed.kind === "org") {
      setAssignTarget("team_inst");
      setAssignId(parsed.teamId);
      setOrgPorteurId(parsed.personId);
      setLegacyAffectee("");
      return;
    }
    // person / team_inst (legacy team-only) / team_func (legacy)
    setAssignTarget(parsed.kind === "team_func" ? "person" : parsed.kind);
    setAssignId(parsed.id);
    setOrgPorteurId("");
    setLegacyAffectee("");
  }

  useEffect(() => {
    if (open) {
      getChantiersForSelect().then(setChantiers);
      getQaWorkflowUiState()
        .then(setQaModes)
        .catch(() =>
          setQaModes({ create: "INTERDIT", update: "INTERDIT", delete: "INTERDIT" })
        );
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setChantierId(question?.chantierId ?? defaultChantierId ?? "");
    setDossierRef(question?.dossier_ref ?? "");
    setQuestionText(question?.question ?? "");
    setCategorie(question?.categorie ?? "Générale");
    setPriorite(question?.priorite ?? "Moyenne");
    setStatut(question?.statut ?? "Ouverte");
    setRemonteePar(question?.remontee_par ?? "");
    applyAffecteeFromStored(question?.affectee_a ?? "");
    setEcheance(
      question?.echeance
        ? format(new Date(question.echeance), "yyyy-MM-dd")
        : ""
    );
    setEcheanceActualisee(
      question?.echeance_actualisee
        ? format(new Date(question.echeance_actualisee), "yyyy-MM-dd")
        : question?.echeance
          ? format(new Date(question.echeance), "yyyy-MM-dd")
          : ""
    );
    setResolution(question?.resolution ?? "");
    setError("");
    setInfo("");
    setMotif("");
  }, [open, question, defaultChantierId]);

  // Load assignment lists (chantier members + BP depend on chantier)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingOpts(true);
    getConsultationAssignmentOptions({
      chantierId: chantierId || undefined,
    })
      .then((opts) => {
        if (cancelled) return;
        setPersonnes(opts.personnes);
        setEquipesOrg(
          opts.equipesOrganisationnelles ?? opts.equipesInstitutionnelles ?? []
        );
        setPersonnesEquipeChantier(
          opts.personnesEquipeChantier ?? opts.personnesEquipeFunc ?? []
        );
        setPorteursOrg(opts.porteursOrg ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setPersonnes([]);
        setEquipesOrg([]);
        setPersonnesEquipeChantier([]);
        setPorteursOrg([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOpts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, chantierId]);

  // Clear invalid picks when lists change
  useEffect(() => {
    if (loadingOpts) return;
    if (assignTarget === "team_func" && assignId) {
      if (
        personnesEquipeChantier.length > 0 &&
        !personnesEquipeChantier.some((p) => p.id === assignId)
      ) {
        setAssignId("");
      }
    }
    if (assignTarget === "team_inst") {
      if (
        assignId &&
        equipesOrg.length > 0 &&
        !equipesOrg.some((e) => e.id === assignId)
      ) {
        setAssignId("");
      }
      if (
        orgPorteurId &&
        porteursOrg.length > 0 &&
        !porteursOrg.some((p) => p.id === orgPorteurId)
      ) {
        setOrgPorteurId("");
      }
    }
  }, [
    loadingOpts,
    assignTarget,
    assignId,
    orgPorteurId,
    equipesOrg,
    personnesEquipeChantier,
    porteursOrg,
  ]);

  const selectedPersonOption = useMemo(() => {
    if (assignTarget === "person") {
      return personnes.find((o) => o.id === assignId);
    }
    if (assignTarget === "team_func") {
      return personnesEquipeChantier.find((o) => o.id === assignId);
    }
    return undefined;
  }, [assignTarget, assignId, personnes, personnesEquipeChantier]);

  const selectedOrgTeam = useMemo(
    () =>
      assignTarget === "team_inst"
        ? equipesOrg.find((o) => o.id === assignId)
        : undefined,
    [assignTarget, assignId, equipesOrg]
  );

  const selectedOrgPorteur = useMemo(
    () =>
      assignTarget === "team_inst"
        ? porteursOrg.find((o) => o.id === orgPorteurId)
        : undefined,
    [assignTarget, orgPorteurId, porteursOrg]
  );

  const porteursChantier = useMemo(
    () => porteursOrg.filter((p) => p.group === "Équipe chantier"),
    [porteursOrg]
  );
  const porteursBp = useMemo(
    () => porteursOrg.filter((p) => p.group === "Bureau Programme"),
    [porteursOrg]
  );

  function buildAffecteeA(): string {
    if (assignTarget === "none") {
      return legacyAffectee.trim();
    }
    if (assignTarget === "person") {
      if (!selectedPersonOption) return "";
      return encodeAffecteeA(
        "person",
        selectedPersonOption.id,
        selectedPersonOption.label
      );
    }
    // Équipe chantier: person from chantier team
    if (assignTarget === "team_func") {
      if (!selectedPersonOption) return "";
      return encodeAffecteeA(
        "person",
        selectedPersonOption.id,
        selectedPersonOption.label
      );
    }
    // Équipe organisationnelle: team + porteur
    if (assignTarget === "team_inst") {
      if (!selectedOrgTeam || !selectedOrgPorteur) return "";
      return encodeOrgAffecteeA(
        selectedOrgTeam.id,
        selectedOrgTeam.label,
        selectedOrgPorteur.id,
        selectedOrgPorteur.label
      );
    }
    return "";
  }

  function handleTargetChange(next: AssignTarget) {
    setAssignTarget(next);
    setAssignId("");
    setOrgPorteurId("");
    if (next !== "none") setLegacyAffectee("");
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!chantierId || !questionText.trim()) {
      setError("Le chantier et la question sont obligatoires.");
      return;
    }
    if (
      (statut === "Résolue" || statut === "Abandonnée") &&
      !resolution.trim()
    ) {
      setError(
        "La réponse est obligatoire lorsque le statut est « Résolue » ou « Abandonnée »."
      );
      return;
    }
    if (assignTarget === "team_func") {
      if (!chantierId) {
        setError(
          "Sélectionnez un chantier pour charger les membres de l'équipe chantier."
        );
        return;
      }
      if (!assignId) {
        setError(
          "Sélectionnez un membre de l'équipe chantier (DC, Sup, PMO en tête de liste)."
        );
        return;
      }
    } else if (assignTarget === "team_inst") {
      if (!assignId) {
        setError("Sélectionnez une équipe organisationnelle.");
        return;
      }
      if (!orgPorteurId) {
        setError(
          "Sélectionnez le porteur de la question (membre chantier ou Bureau Programme)."
        );
        return;
      }
    } else if (assignTarget !== "none" && !assignId) {
      setError(
        "Choisissez une ressource ou une équipe, ou basculez sur « Non affectée »."
      );
      return;
    }

    const opMode = isEdit ? qaModes.update : qaModes.create;
    if (opMode === "INTERDIT") {
      setError(
        isEdit
          ? "Vous n'êtes pas habilité à modifier une question Q&A."
          : "Vous n'êtes pas habilité à créer une question Q&A."
      );
      return;
    }
    if (opMode === "VALIDATION" && !motif.trim()) {
      setError(
        "Le motif est obligatoire : cette opération doit passer par le workflow de validation."
      );
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");
    try {
      const payload = {
        chantierId,
        dossier_ref: dossierRef,
        question: questionText,
        categorie,
        priorite,
        statut,
        remontee_par: remonteePar,
        affectee_a: buildAffecteeA(),
        echeance: echeance || null,
        echeance_actualisee: isEdit
          ? echeanceActualisee || null
          : echeance || null,
        resolution,
      };

      const result = isEdit
        ? await updateConsultationQuestion(question.id, payload, {
            motif: motif.trim() || undefined,
          })
        : await createConsultationQuestion(payload, {
            motif: motif.trim() || undefined,
          });

      if (result.mode === "validation") {
        setInfo(
          "Demande soumise au workflow de validation. Elle sera appliquée après approbation."
        );
        setTimeout(() => closeForm(), isPage ? 900 : 1200);
      } else {
        closeForm();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Enregistrement impossible. Réessayez."
      );
    } finally {
      setSaving(false);
    }
  }

  const activeMode = isEdit ? qaModes.update : qaModes.create;
  const needsMotif = activeMode === "VALIDATION";
  const isForbidden = activeMode === "INTERDIT";
  const isClosing =
    statut === "Résolue" || statut === "Abandonnée";
  /** Sticky bottom panel: réponse and/or motif next to the CTA */
  const showActionDock = !isForbidden && (isClosing || needsMotif);
  const actionDockRef = useRef<HTMLDivElement>(null);

  // When closing a question, scroll the action dock into view (UX)
  useEffect(() => {
    if (!open || !isClosing) return;
    const t = window.setTimeout(() => {
      actionDockRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, isClosing, statut]);

  const selectedChantier = chantiers.find((c) => c.id === chantierId);
  const canSubmit =
    !isForbidden &&
    !!chantierId &&
    !!questionText.trim() &&
    !(
      (statut === "Résolue" || statut === "Abandonnée") &&
      !resolution.trim()
    ) &&
    (!needsMotif || !!motif.trim()) &&
    (assignTarget === "none" ||
      (assignTarget === "team_inst"
        ? !!assignId && !!orgPorteurId
        : !!assignId));

  const preview = formatAffecteeADisplay(buildAffecteeA());

  const headerBlock = (
    <div
      className={`border-b px-6 pb-5 pt-6 ${
        isEdit
          ? "bg-gradient-to-br from-sky-500/12 via-background to-background"
          : "bg-gradient-to-br from-[#0A3C74]/10 via-background to-background"
      } ${isPage ? "rounded-t-xl" : ""}`}
    >
      {isPage && (
        <div className="mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
              Retour
            </Link>
          </Button>
        </div>
      )}
      <div className={`mb-3 flex flex-wrap items-center gap-2 ${isPage ? "" : "pr-8"}`}>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium shadow-sm">
          {isEdit ? (
            <Pencil className="size-3.5" style={{ color: BOA_TEAL }} />
          ) : (
            <FilePlus2 className="size-3.5" style={{ color: BOA_TEAL }} />
          )}
          <span style={{ color: BOA_NAVY }}>
            {isEdit ? "Modification" : "Création"}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00BDBB]/35 bg-[#00BDBB]/10 px-2.5 py-1 text-[10px] font-semibold text-[#0A3C74]">
          <HelpCircle className="size-3" style={{ color: BOA_TEAL }} />
          Backlog Q&amp;A
        </span>
        {needsMotif && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/12 px-2.5 py-1 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
            <Send className="size-3" />
            Via workflow
          </span>
        )}
        {selectedChantier && (
          <span
            className="inline-flex max-w-[min(100%,22rem)] items-center gap-1.5 truncate rounded-full border bg-muted/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
            title={`${selectedChantier.code} — ${selectedChantier.nom}`}
          >
            <span className="shrink-0 font-bold text-[#0A3C74]">
              {selectedChantier.code}
            </span>
            <span className="min-w-0 truncate">{selectedChantier.nom}</span>
          </span>
        )}
      </div>
      {isPage ? (
        <div className="space-y-1 text-left">
          <h1
            className="flex items-start gap-2 text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: BOA_NAVY }}
          >
            <HelpCircle
              className="mt-1 size-6 shrink-0"
              style={{ color: BOA_TEAL }}
            />
            <span className="min-w-0 break-words">
              {isEdit ? "Modifier la question" : "Nouvelle question"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Grand espace de travail — classement, affectation, clôture et motif workflow regroupés en bas."
              : "Enregistrez une question de consultation rattachée à un chantier."}
          </p>
        </div>
      ) : (
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle
            className="flex items-start gap-2 text-xl font-bold tracking-tight sm:text-2xl"
            style={{ color: BOA_NAVY }}
          >
            <HelpCircle
              className="mt-0.5 size-5 shrink-0"
              style={{ color: BOA_TEAL }}
            />
            <span className="min-w-0 break-words">
              {isEdit ? "Modifier la question" : "Nouvelle question"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit
              ? "Mettez à jour le classement et le suivi de la question."
              : "Enregistrez une question de consultation rattachée à un chantier."}
          </DialogDescription>
        </DialogHeader>
      )}
    </div>
  );

  const formBody = (
    <form
      onSubmit={handleSubmit}
      className={
        isPage
          ? "flex flex-1 flex-col"
          : "flex min-h-0 flex-1 flex-col"
      }
    >
      <div
        className={
          isPage
            ? "grid flex-1 gap-5 px-6 py-6 lg:grid-cols-[1fr_minmax(280px,340px)]"
            : "min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
        }
      >
        <div className={isPage ? "min-w-0 space-y-5" : "contents"}>
            {error && (
              <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/8 px-3.5 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}
            {info && (
              <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <p className="leading-relaxed">{info}</p>
              </div>
            )}
            {isForbidden && (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-950 dark:text-amber-50">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  Votre rôle n&apos;autorise pas{" "}
                  {isEdit ? "la modification" : "la création"} de questions
                  Q&amp;A.
                </p>
              </div>
            )}
            {needsMotif && !isForbidden && (
              <div className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
                <Send className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                <p>
                  Mode <strong>Validation</strong> : le motif workflow se saisit
                  en bas du formulaire, juste avant l&apos;envoi
                  {isClosing ? " — avec la réponse de clôture" : ""}.
                </p>
              </div>
            )}

            <Section icon={FolderKanban} title="Rattachement">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel required>Chantier</FieldLabel>
                  <Select
                    value={chantierId}
                    onValueChange={(v) => {
                      setChantierId(v);
                      if (assignTarget === "team_func") {
                        setAssignId("");
                      }
                    }}
                    disabled={!!defaultChantierId}
                  >
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Sélectionner un chantier…" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className={SELECT_CONTENT_CLASS}
                    >
                      {chantiers.map((c) => (
                        <SelectItem
                          key={c.id}
                          value={c.id}
                          className="max-w-full py-2"
                          title={`${c.code} — ${c.nom}`}
                        >
                          <ChantierOptionLabel code={c.code} nom={c.nom} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Réf. dossier</FieldLabel>
                  <Input
                    value={dossierRef}
                    onChange={(e) => setDossierRef(e.target.value)}
                    placeholder="DCE-001, AO-2024-xxx…"
                    className="h-10"
                  />
                </div>
              </div>
            </Section>

            <Section icon={MessageSquareText} title="Question">
              <div className="space-y-1.5">
                <FieldLabel required>Libellé</FieldLabel>
                <textarea
                  className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Décrivez clairement la question de consultation…"
                  disabled={isEdit && qaModes.update !== "DIRECT"}
                  title={
                    isEdit && qaModes.update !== "DIRECT"
                      ? "Le texte de la question n'est modifiable qu'en mode Direct (sans workflow)"
                      : undefined
                  }
                />
                {isEdit && qaModes.update !== "DIRECT" && (
                  <p className="text-[11px] text-muted-foreground">
                    Texte figé : seul un rôle en modification{" "}
                    <strong>Directe</strong> peut le changer. Les autres champs
                    restent modifiables
                    {qaModes.update === "VALIDATION"
                      ? " (via workflow)"
                      : ""}
                    .
                  </p>
                )}
              </div>
            </Section>

            <Section icon={Tags} title="Classement">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <FieldLabel>Catégorie</FieldLabel>
                  <Select value={categorie} onValueChange={setCategorie}>
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className={SELECT_CONTENT_CLASS}
                    >
                      {QA_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="inline-flex items-center gap-2">
                            <ColorDot
                              color={QA_CATEGORIE_COLORS[c] ?? "#94a3b8"}
                            />
                            {c}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Priorité</FieldLabel>
                  <Select value={priorite} onValueChange={setPriorite}>
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className={SELECT_CONTENT_CLASS}
                    >
                      {QA_PRIORITES.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="inline-flex items-center gap-2">
                            <ColorDot
                              color={QA_PRIORITE_COLORS[p] ?? "#94a3b8"}
                            />
                            {p}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Statut</FieldLabel>
                  <Select value={statut} onValueChange={setStatut}>
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className={SELECT_CONTENT_CLASS}
                    >
                      {QA_STATUTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="inline-flex items-center gap-2">
                            <ColorDot color={QA_STATUT_COLORS[s] ?? "#94a3b8"} />
                            {s}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            <Section
              icon={UserRound}
              title="Affectation"
              description="Affectez la question à une personne OU à une équipe (un seul choix)."
            >
              <div
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                role="radiogroup"
                aria-label="Type d'affectation"
              >
                {TARGET_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = assignTarget === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleTargetChange(opt.value)}
                      className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-[#0A3C74] bg-[#0A3C74]/[0.06] shadow-sm ring-1 ring-[#0A3C74]/25"
                          : "border-border bg-background hover:border-[#00BDBB]/50 hover:bg-muted/40"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <Icon
                          className="size-3.5"
                          style={{ color: active ? BOA_TEAL : undefined }}
                        />
                        <span style={{ color: active ? BOA_NAVY : undefined }}>
                          {opt.label}
                        </span>
                      </span>
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              {assignTarget === "team_func" && (
                <div className="space-y-1.5 rounded-lg border border-dashed border-[#0A3C74]/20 bg-[#0A3C74]/[0.03] p-3">
                  <FieldLabel required>
                    Membre de l&apos;équipe chantier
                  </FieldLabel>
                  {!chantierId ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Sélectionnez d&apos;abord un chantier pour charger les
                      membres de l&apos;équipe chantier.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ordre : <RoleTagBadge tag="DC" /> Directeur ·{" "}
                      <RoleTagBadge tag="Sup" /> Suppléant ·{" "}
                      <RoleTagBadge tag="PMO" /> PMO · puis le reste de
                      l&apos;équipe chantier.
                    </p>
                  )}
                  <Select
                    value={assignId || undefined}
                    onValueChange={setAssignId}
                    disabled={
                      loadingOpts ||
                      !chantierId ||
                      personnesEquipeChantier.length === 0
                    }
                  >
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                      <SelectValue
                        placeholder={
                          !chantierId
                            ? "Choisissez d'abord un chantier…"
                            : loadingOpts
                              ? "Chargement des membres…"
                              : personnesEquipeChantier.length === 0
                                ? "Aucun membre sur ce chantier"
                                : "Sélectionner un membre…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className={SELECT_CONTENT_CLASS}
                    >
                      {personnesEquipeChantier.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="py-2">
                          <PersonOptionLabel
                            label={o.label}
                            tag={o.tag}
                            hint={o.hint}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {assignTarget === "person" && (
                <div className="space-y-1.5 rounded-lg border border-dashed border-[#0A3C74]/20 bg-[#0A3C74]/[0.03] p-3">
                  <FieldLabel required>Ressource</FieldLabel>
                  <Select
                    value={assignId || undefined}
                    onValueChange={setAssignId}
                    disabled={loadingOpts || personnes.length === 0}
                  >
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                      <SelectValue
                        placeholder={
                          loadingOpts
                            ? "Chargement…"
                            : personnes.length === 0
                              ? "Aucune ressource disponible"
                              : "Sélectionner une ressource…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className={SELECT_CONTENT_CLASS}
                    >
                      {personnes.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="py-2">
                          <PersonOptionLabel
                            label={o.label}
                            tag={o.tag}
                            hint={o.hint}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {assignTarget === "team_inst" && (
                <div className="space-y-4 rounded-lg border border-dashed border-[#0A3C74]/20 bg-[#0A3C74]/[0.03] p-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#0A3C74]">
                      Affectation organisationnelle
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Deux informations obligatoires : l&apos;équipe
                      organisationnelle destinataire, et le porteur qui suit
                      réellement la question (membre de l&apos;équipe chantier
                      ou du Bureau Programme).
                    </p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-1.5 rounded-lg border bg-background/80 p-3">
                      <FieldLabel required>
                        1. Équipe organisationnelle
                      </FieldLabel>
                      <Select
                        value={assignId || undefined}
                        onValueChange={(id) => {
                          setAssignId(id);
                        }}
                        disabled={loadingOpts || equipesOrg.length === 0}
                      >
                        <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                          <SelectValue
                            placeholder={
                              loadingOpts
                                ? "Chargement…"
                                : equipesOrg.length === 0
                                  ? "Aucune équipe"
                                  : "Sélectionner l'équipe org.…"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className={SELECT_CONTENT_CLASS}
                        >
                          {equipesOrg.map((o) => (
                            <SelectItem key={o.id} value={o.id} className="py-2">
                              <span className="flex min-w-0 flex-col items-start">
                                <span className="font-medium">{o.label}</span>
                                {o.hint ? (
                                  <span className="text-[11px] text-muted-foreground">
                                    {o.hint}
                                  </span>
                                ) : null}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 rounded-lg border bg-background/80 p-3">
                      <FieldLabel required>2. Porteur de la question</FieldLabel>
                      {!chantierId && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          Sélectionnez un chantier pour proposer les membres
                          chantier + Bureau Programme.
                        </p>
                      )}
                      <Select
                        value={orgPorteurId || undefined}
                        onValueChange={setOrgPorteurId}
                        disabled={
                          loadingOpts ||
                          !chantierId ||
                          porteursOrg.length === 0
                        }
                      >
                        <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                          <SelectValue
                            placeholder={
                              !chantierId
                                ? "Choisissez d'abord un chantier…"
                                : loadingOpts
                                  ? "Chargement…"
                                  : porteursOrg.length === 0
                                    ? "Aucun porteur disponible"
                                    : "Sélectionner le porteur…"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          className={SELECT_CONTENT_CLASS}
                        >
                          {porteursChantier.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#0A3C74]">
                                Équipe chantier
                              </div>
                              {porteursChantier.map((o) => (
                                <SelectItem
                                  key={o.id}
                                  value={o.id}
                                  className="py-2"
                                >
                                  <PersonOptionLabel
                                    label={o.label}
                                    tag={o.tag}
                                    hint={o.hint}
                                  />
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {porteursBp.length > 0 && (
                            <>
                              <div className="mt-1 border-t px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#0A3C74]">
                                Bureau Programme
                              </div>
                              {porteursBp.map((o) => (
                                <SelectItem
                                  key={o.id}
                                  value={o.id}
                                  className="py-2"
                                >
                                  <PersonOptionLabel
                                    label={o.label}
                                    tag={o.tag}
                                    hint={o.hint}
                                  />
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(selectedOrgTeam || selectedOrgPorteur) && (
                    <div className="rounded-lg border border-[#00BDBB]/25 bg-[#00BDBB]/5 px-3 py-2 text-xs">
                      <span className="font-semibold text-[#0A3C74]">
                        Synthèse :{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {selectedOrgTeam?.label ?? "—"}{" "}
                        <span className="text-[#0A3C74]">→</span>{" "}
                        {selectedOrgPorteur?.label ?? "porteur non choisi"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {legacyAffectee && assignTarget === "none" && (
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-950 dark:text-amber-50">
                  Affectation historique en texte libre :{" "}
                  <strong>{legacyAffectee}</strong>. Choisissez une personne ou
                  une équipe ci-dessus pour la remplacer, ou laissez tel quel.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-[#0A3C74]">Aperçu :</span>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 font-medium text-foreground">
                  {(selectedPersonOption?.tag ?? selectedOrgPorteur?.tag) ? (
                    <RoleTagBadge
                      tag={
                        (selectedPersonOption?.tag ??
                          selectedOrgPorteur?.tag) as ChantierRoleTag
                      }
                    />
                  ) : null}
                  <span className="truncate">{preview}</span>
                </span>
                {loadingOpts && (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    Listes…
                  </span>
                )}
              </div>
            </Section>

            <Section icon={Users} title="Suivi">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Remontée par</FieldLabel>
                  <Input
                    value={remonteePar}
                    onChange={(e) => setRemonteePar(e.target.value)}
                    placeholder="Nom…"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>
                    {isEdit ? "Échéance initiale" : "Échéance"}
                  </FieldLabel>
                  <Input
                    type="date"
                    value={echeance}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEcheance(v);
                      if (!isEdit) setEcheanceActualisee(v);
                    }}
                    className="h-10"
                    disabled={isEdit}
                    title={
                      isEdit
                        ? "L'échéance initiale n'est plus modifiable"
                        : undefined
                    }
                  />
                  {isEdit && (
                    <p className="text-[11px] text-muted-foreground">
                      Figée à la création — non modifiable.
                    </p>
                  )}
                </div>
                {isEdit && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel>Échéance actualisée</FieldLabel>
                    <Input
                      type="date"
                      value={echeanceActualisee}
                      onChange={(e) => setEcheanceActualisee(e.target.value)}
                      className="h-10"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Seule date d&apos;échéance modifiable · base du KPI « En
                      retard ».
                    </p>
                  </div>
                )}
              </div>
              {isEdit && question?.date_fin_reelle && (
                <p className="text-xs text-muted-foreground">
                  Date de fin réelle :{" "}
                  <strong>
                    {format(new Date(question.date_fin_reelle), "dd/MM/yyyy", {
                      locale: fr,
                    })}
                  </strong>{" "}
                  (renseignée au passage Résolue / Abandonnée)
                </p>
              )}
            </Section>
          </div>

          {/* Colonne latérale (page) : synthèse + finalisation toujours visibles */}
          {isPage && (
            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3
                  className="mb-3 text-sm font-semibold"
                  style={{ color: BOA_NAVY }}
                >
                  Synthèse
                </h3>
                <dl className="space-y-2.5 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Chantier</dt>
                    <dd className="mt-0.5 font-medium text-foreground">
                      {selectedChantier
                        ? `${selectedChantier.code} — ${selectedChantier.nom}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 font-medium">
                      <ColorDot
                        color={QA_CATEGORIE_COLORS[categorie] ?? "#94a3b8"}
                      />
                      {categorie}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 font-medium">
                      <ColorDot
                        color={QA_PRIORITE_COLORS[priorite] ?? "#94a3b8"}
                      />
                      {priorite}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 font-medium">
                      <ColorDot color={QA_STATUT_COLORS[statut] ?? "#94a3b8"} />
                      {statut}
                    </span>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Affectation</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-foreground">
                      {(selectedPersonOption?.tag ?? selectedOrgPorteur?.tag) ? (
                        <RoleTagBadge
                          tag={
                            (selectedPersonOption?.tag ??
                              selectedOrgPorteur?.tag) as ChantierRoleTag
                          }
                        />
                      ) : null}
                      <span className="min-w-0 break-words">{preview}</span>
                    </dd>
                  </div>
                  {isEdit && (
                    <div>
                      <dt className="text-muted-foreground">
                        Échéance actualisée
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums">
                        {echeanceActualisee
                          ? format(
                              new Date(echeanceActualisee + "T12:00:00"),
                              "dd/MM/yyyy",
                              { locale: fr }
                            )
                          : "—"}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {showActionDock && (
                <div
                  ref={actionDockRef}
                  className="space-y-3 rounded-xl border border-[#0A3C74]/15 bg-gradient-to-b from-[#0A3C74]/[0.04] to-muted/30 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0A3C74]/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#0A3C74] dark:bg-background/80">
                      <Send className="size-3" style={{ color: BOA_TEAL }} />
                      Finaliser
                      {isClosing ? ` · ${statut}` : ""}
                      {needsMotif ? " · Workflow" : ""}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Éléments obligatoires pour valider — toujours visibles à
                    droite.
                  </p>
                  {isClosing && (
                    <div className="space-y-1.5 rounded-xl border border-emerald-500/25 bg-background/90 p-3 shadow-sm">
                      <FieldLabel required>Réponse</FieldLabel>
                      <textarea
                        className="flex min-h-[120px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder={
                          statut === "Abandonnée"
                            ? "Motif / contexte de l'abandon…"
                            : "Réponse apportée à la question…"
                        }
                      />
                    </div>
                  )}
                  {needsMotif && (
                    <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 shadow-sm">
                      <FieldLabel required>Motif workflow</FieldLabel>
                      <textarea
                        className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                        value={motif}
                        onChange={(e) => setMotif(e.target.value)}
                        placeholder={
                          isClosing
                            ? "Pourquoi clôturer / abandonner cette question ?…"
                            : "Justifiez la demande de modification…"
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Dock bas (dialog uniquement) — compact */}
        {!isPage && showActionDock && (
          <div
            ref={actionDockRef}
            className="shrink-0 border-t border-[#0A3C74]/15 bg-gradient-to-b from-[#0A3C74]/[0.04] to-muted/40 px-6 py-4 shadow-[0_-8px_24px_-12px_rgba(10,60,116,0.25)]"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0A3C74]/20 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#0A3C74] dark:bg-background/80">
                <Send className="size-3" style={{ color: BOA_TEAL }} />
                Finaliser
                {isClosing ? ` · ${statut}` : ""}
                {needsMotif ? " · Workflow" : ""}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Saisissez ici les éléments obligatoires, puis validez.
              </span>
            </div>

            <div
              className={`grid gap-3 ${
                isClosing && needsMotif ? "lg:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {isClosing && (
                <div className="space-y-1.5 rounded-xl border border-emerald-500/25 bg-background/90 p-3 shadow-sm">
                  <FieldLabel required>Réponse</FieldLabel>
                  <p className="text-[11px] text-muted-foreground">
                    {statut === "Abandonnée"
                      ? "Contexte / motif de l'abandon (obligatoire)."
                      : "Réponse apportée à la question (obligatoire)."}
                  </p>
                  <textarea
                    className="flex min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/45"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder={
                      statut === "Abandonnée"
                        ? "Motif / contexte de l'abandon…"
                        : "Réponse apportée à la question…"
                    }
                    autoFocus={isClosing}
                  />
                </div>
              )}

              {needsMotif && (
                <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 shadow-sm">
                  <FieldLabel required>Motif workflow</FieldLabel>
                  <p className="text-[11px] text-muted-foreground">
                    Justifie la demande pour le validateur (obligatoire en mode
                    Validation).
                  </p>
                  <textarea
                    className="flex min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder={
                      isClosing
                        ? "Pourquoi clôturer / abandonner cette question ?…"
                        : "Justifiez la demande de création / modification…"
                    }
                    autoFocus={!isClosing && needsMotif}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={`flex flex-wrap items-center gap-2 border-t bg-muted/30 px-6 py-4 ${
            isPage ? "sm:justify-between" : "sm:justify-between"
          }`}
        >
          <p className="hidden max-w-md text-xs text-muted-foreground sm:block">
            {showActionDock
              ? isPage
                ? "Complétez le panneau Finaliser (colonne de droite) puis validez."
                : "Complétez le panneau ci-dessus puis validez."
              : "Les champs marqués * sont obligatoires."}
          </p>
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {isPage ? (
              <Button type="button" variant="outline" asChild disabled={saving}>
                <Link href={backHref}>Annuler</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => closeForm()}
                disabled={saving}
              >
                Annuler
              </Button>
            )}
            <Button
              type="submit"
              disabled={saving || !canSubmit}
              className="bg-[#0A3C74] text-white hover:bg-[#0A3C74]/90"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {needsMotif
                ? isClosing
                  ? `Soumettre · ${statut}`
                  : "Soumettre au workflow"
                : isEdit
                  ? "Enregistrer"
                  : "Créer la question"}
            </Button>
          </div>
        </div>
      </form>
  );

  if (isPage) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {headerBlock}
          {formBody}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        {headerBlock}
        {formBody}
      </DialogContent>
    </Dialog>
  );
}
