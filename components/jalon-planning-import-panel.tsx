"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Milestone,
  Upload,
  XCircle,
  AlertTriangle,
  Info,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type PlanningAction,
  type ExcelPlanningPreview,
} from "@/lib/jalon-planning-excel";
import {
  listChantiersForPlanningImport,
  exportJalonPlanningExcel,
  previewJalonPlanningExcel,
  confirmJalonPlanningExcel,
  purgeJalonPlanning,
  type ChantierPlanningOption,
} from "@/app/(app)/admin/donnees/planning-actions";

const ACTION_STYLE: Record<
  PlanningAction,
  { label: string; className: string }
> = {
  CREATE: {
    label: "CREATE",
    className: "bg-emerald-600 text-white hover:bg-emerald-600",
  },
  UPDATE: {
    label: "UPDATE",
    className: "bg-sky-600 text-white hover:bg-sky-600",
  },
  SKIP: {
    label: "SKIP",
    className: "bg-muted text-muted-foreground hover:bg-muted",
  },
  ERROR: {
    label: "ERROR",
    className: "bg-destructive text-destructive-foreground hover:bg-destructive",
  },
};

type FilterKey = "all" | PlanningAction;
type PlanningPurgeStep = "backup" | "code" | "keyword";

export function JalonPlanningImportPanel() {
  const [chantiers, setChantiers] = useState<ChantierPlanningOption[]>([]);
  const [chantierId, setChantierId] = useState("");
  const [preview, setPreview] = useState<ExcelPlanningPreview | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [message, setMessage] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeStep, setPurgeStep] = useState<PlanningPurgeStep>("backup");
  const [purgeBackupFingerprint, setPurgeBackupFingerprint] = useState("");
  const [purgeCodeInput, setPurgeCodeInput] = useState("");
  const [purgeKeywordInput, setPurgeKeywordInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => chantiers.find((c) => c.id === chantierId) ?? null,
    [chantiers, chantierId]
  );

  const loadChantiers = useCallback(() => {
    startTransition(async () => {
      try {
        const list = await listChantiersForPlanningImport();
        setChantiers(list);
        setLoaded(true);
      } catch (e) {
        setMessage({
          type: "error",
          text:
            e instanceof Error
              ? e.message
              : "Impossible de charger la liste des chantiers",
        });
      }
    });
  }, []);

  useEffect(() => {
    loadChantiers();
  }, [loadChantiers]);

  function clearPreview() {
    setPreview(null);
    setCsvText(null);
    setFilter("all");
    if (fileRef.current) fileRef.current.value = "";
  }

  function resetPurgeWizard() {
    setPurgeStep("backup");
    setPurgeBackupFingerprint("");
    setPurgeCodeInput("");
    setPurgeKeywordInput("");
  }

  function onChantierChange(id: string) {
    setChantierId(id);
    clearPreview();
    setPurgeOpen(false);
    resetPurgeWizard();
    setMessage(null);
  }

  function openPurgeDialog() {
    if (!selected || selected.jalonCount === 0) return;
    clearPreview();
    resetPurgeWizard();
    setMessage(null);
    setPurgeOpen(true);
  }

  function downloadBase64Workbook(fileName: string, base64: string) {
    const link = document.createElement("a");
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    link.download = fileName;
    link.click();
  }

  function runExport(mode: "current" | "template" | "empty") {
    if (!chantierId) {
      setMessage({ type: "error", text: "Sélectionnez d'abord un chantier." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const { fileName, base64 } = await exportJalonPlanningExcel(
          chantierId,
          mode
        );
        downloadBase64Workbook(fileName, base64);
        setMessage({
          type: "ok",
          text: `Fichier téléchargé : ${fileName}`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de l'export",
        });
      }
    });
  }

  function runPurgeBackup() {
    if (!selected) return;
    startTransition(async () => {
      try {
        const { fileName, base64, fingerprint } =
          await exportJalonPlanningExcel(selected.id, "current");
        const backupName = fileName.replace(
          /\.xlsx$/i,
          `_sauvegarde_avant_purge_${Date.now()}.xlsx`
        );
        downloadBase64Workbook(backupName, base64);
        setPurgeBackupFingerprint(fingerprint);
        setMessage({
          type: "ok",
          text: `Sauvegarde téléchargée : ${backupName}. Vous pouvez poursuivre la purge.`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de la sauvegarde du planning",
        });
      }
    });
  }

  function confirmPurge() {
    if (!selected || !purgeBackupFingerprint) return;
    startTransition(async () => {
      try {
        const result = await purgeJalonPlanning(
          selected.id,
          purgeBackupFingerprint,
          purgeCodeInput,
          purgeKeywordInput
        );
        clearPreview();
        setPurgeOpen(false);
        resetPurgeWizard();
        const list = await listChantiersForPlanningImport();
        setChantiers(list);
        setMessage({
          type: "ok",
          text: `Planning ${result.chantierCode} purgé : ${result.jalons} jalon(s), ${result.workstreams} workstream(s) et ${result.activites} activité(s) supprimés. Vous pouvez maintenant charger un nouveau fichier Excel.`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de la purge du planning",
        });
      }
    });
  }

  function onFileSelected(file: File | null) {
    if (!file) return;
    if (!chantierId) {
      setMessage({ type: "error", text: "Sélectionnez d'abord un chantier." });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setMessage(null);
    setPreview(null);
    startTransition(async () => {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.readAsDataURL(file);
        });
        setCsvText(base64);
        const report = await previewJalonPlanningExcel(chantierId, base64);
        setPreview(report);
        if (report.formatErrors.length > 0) {
          setMessage({
            type: "error",
            text: `Format invalide : ${report.formatErrors.join(" · ")}`,
          });
          return;
        }
        if (report.total === 0) {
          setMessage({
            type: "info",
            text: "Aucune ligne de données dans le fichier.",
          });
          return;
        }
        setMessage({
          type: report.errorCount > 0 ? "info" : "ok",
          text: `Simulation terminée — aucune donnée enregistrée. ${report.createCount} création(s), ${report.updateCount} mise(s) à jour, ${report.skipCount} inchangé(s), ${report.errorCount} erreur(s).`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text:
            e instanceof Error ? e.message : "Échec de l'analyse à blanc",
        });
      }
    });
  }

  function rejectPreview() {
    clearPreview();
    setMessage({
      type: "info",
      text: "Simulation rejetée. Aucune modification en base.",
    });
  }

  function confirmImport() {
    if (!preview || !csvText || !chantierId) return;
    if (preview.errorCount > 0 || preview.formatErrors.length > 0) return;

    startTransition(async () => {
      try {
        const result = await confirmJalonPlanningExcel(
          chantierId,
          csvText,
          preview.fingerprint
        );
        clearPreview();
        // Refresh chantier counts
        const list = await listChantiersForPlanningImport();
        setChantiers(list);
        setMessage({
          type: "ok",
          text: `Injection terminée pour ${result.chantierCode} : ${result.created} créé(s), ${result.updated} mis à jour, ${result.skipped} inchangé(s).`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de l'injection",
        });
      }
    });
  }

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (filter === "all") return preview.rows;
    return preview.rows.filter((r) => r.action === filter);
  }, [preview, filter]);

  const canConfirm =
    !!preview &&
    preview.formatErrors.length === 0 &&
    preview.errorCount === 0 &&
    (preview.createCount > 0 || preview.updateCount > 0) &&
    !!csvText;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Milestone className="size-5 text-[#00BDBB]" />
            </div>
            <div>
              <CardTitle className="text-lg text-primary">
                Chantiers — planning jalons
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Importez un classeur Excel métier pour gérer les jalons,
                workstreams et activités d&apos;un chantier sélectionné.{" "}
                <strong className="font-medium text-foreground">
                  Chargement à blanc obligatoire
                </strong>{" "}
                : CREATE / UPDATE / SKIP / ERROR, puis rejet ou confirmation.
                Les éléments absents du fichier sont conservés : aucune
                suppression automatique.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {/* Chantier select */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <label
              htmlFor="planning-chantier"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Chantier cible
            </label>
            <select
              id="planning-chantier"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BDBB]/50"
              value={chantierId}
              disabled={pending || !loaded}
              onChange={(e) => onChantierChange(e.target.value)}
            >
              <option value="">— Sélectionner un chantier —</option>
              {chantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.nom} ({c.jalonCount} jalon
                  {c.jalonCount !== 1 ? "s" : ""})
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-mono">
                {selected.date_debut} → {selected.date_fin}
              </Badge>
              <Badge
                variant="outline"
                className={
                  selected.jalonCount === 0
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                    : ""
                }
              >
                {selected.jalonCount === 0
                  ? "Aucun jalon → template + merge"
                  : `${selected.jalonCount} jalon(s) → merge`}
              </Badge>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr_1fr_1fr]">
          <Button
            type="button"
            variant="outline"
            className="min-w-0 justify-start gap-2"
            disabled={pending || !chantierId}
            onClick={() => runExport("current")}
          >
            <Download className="size-4 shrink-0 text-[#00BDBB]" />
            Exporter le planning
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-9 min-w-0 justify-start gap-2 whitespace-normal py-2 text-left leading-tight"
            disabled={pending || !chantierId}
            onClick={() => runExport("template")}
          >
            <FileDown className="size-4 shrink-0 text-[#00BDBB]" />
            Modèle template prérempli
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-w-0 justify-start gap-2"
            disabled={pending || !chantierId}
            onClick={() => runExport("empty")}
          >
            <FileSpreadsheet className="size-4 shrink-0 text-[#00BDBB]" />
            Classeur Excel vide
          </Button>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 justify-start gap-2"
              disabled={pending || !chantierId}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4 shrink-0 text-[#00BDBB]" />
              Charger un Excel…
            </Button>
          </div>
          </div>
          <div className="flex justify-end border-t border-dashed pt-3">
            <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto sm:min-w-48"
            disabled={pending || !selected || selected.jalonCount === 0}
            onClick={openPurgeDialog}
            title={
              selected?.jalonCount === 0
                ? "Ce chantier ne contient aucun planning à purger"
                : "Sauvegarder puis vider entièrement le planning du chantier"
            }
          >
            <Trash2 className="size-4 shrink-0" />
            Purger le planning
            </Button>
          </div>
        </div>

        {/* Excel help */}
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Classeur Excel métier
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Niveau", "Phase", "Élément", "Ordre", "Date de début",
              "Date de fin / cible", "Date réelle", "Statut", "Description",
            ].map((label) => <span key={label} className="inline-flex items-center rounded-md border border-[#00BDBB]/30 bg-background px-2 py-0.5 text-[11px]">{label}</span>)}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Onglets <strong>Mode d&apos;emploi</strong>, <strong>Planning</strong> et
            référentiels intégrés · Dates <strong>jj/mm/aaaa</strong> · L&apos;ordre des
            lignes construit l&apos;arborescence : Jalon, puis Workstream, puis Activités ·
            Les ID techniques masqués sécurisent le merge et les renommages ·
            Éléments absents conservés · Workflow Direct requis
          </p>
        </div>

        {/* Feedback */}
        {message && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              message.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : message.type === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-[#00BDBB]/30 bg-[#00BDBB]/10 text-foreground"
            }`}
          >
            {message.type === "ok" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : message.type === "error" ? (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-[#00BDBB]" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-[#00BDBB]" />
            Traitement en cours…
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-50">
              <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Résultat de la simulation — aucune donnée enregistrée
              </p>
              <p className="mt-1 text-xs opacity-90">
                Merge hiérarchique sur les jalons, workstreams et activités.
                Les éléments absents du classeur restent en base.
              </p>
            </div>

            {preview.formatErrors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ul className="list-inside list-disc">
                  {preview.formatErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              {([['JALON','Jalons'],['WORKSTREAM','Workstreams'],['ACTIVITE','Activités']] as const).map(([level,label]) => {
                const count = preview.counts[level];
                return <div key={level} className="rounded-lg border bg-card px-3 py-2 text-xs"><p className="font-semibold text-primary">{label}</p><p className="mt-1 text-muted-foreground"><span className="text-emerald-700">{count.create} création(s)</span> · <span className="text-sky-700">{count.update} modification(s)</span> · {count.skip} inchangé(s){count.error ? ` · ${count.error} erreur(s)` : ''}</p></div>;
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", `Tout (${preview.total})`],
                    ["CREATE", `CREATE (${preview.createCount})`],
                    ["UPDATE", `UPDATE (${preview.updateCount})`],
                    ["SKIP", `SKIP (${preview.skipCount})`],
                    ["ERROR", `ERROR (${preview.errorCount})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      filter === key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-[#00BDBB]/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={rejectPreview}
                >
                  Rejeter et recommencer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !canConfirm}
                  className="gap-1.5"
                  onClick={confirmImport}
                  title={
                    !canConfirm
                      ? preview.errorCount > 0
                        ? "Corrigez les erreurs avant de confirmer"
                        : "Aucune modification à injecter"
                      : "Écrire en base"
                  }
                >
                  <CheckCircle2 className="size-3.5" />
                  Confirmer l&apos;injection
                  {canConfirm
                    ? ` (${preview.createCount + preview.updateCount})`
                    : ""}
                </Button>
              </div>
            </div>

            {preview.errorCount > 0 && (
              <p className="text-xs text-destructive">
                La confirmation est désactivée tant qu&apos;il reste des lignes
                en erreur. Corrigez le classeur Excel et rechargez-le.
              </p>
            )}

            <div className="max-h-[420px] overflow-auto rounded-xl border">
              <table className="w-max min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-30">
                  <tr className="border-b bg-muted/95 backdrop-blur-sm">
                    <th className="sticky left-0 z-40 w-14 bg-muted px-2 py-2 text-left text-xs font-medium">
                      Ligne
                    </th>
                    <th className="sticky left-14 z-40 w-24 bg-muted px-2 py-2 text-left text-xs font-medium">
                      Action
                    </th>
                    <th className="min-w-[120px] px-2 py-2 text-left text-xs font-medium">
                      Niveau
                    </th>
                    <th className="min-w-[180px] px-2 py-2 text-left text-xs font-medium">
                      Élément
                    </th>
                    <th className="min-w-[220px] px-2 py-2 text-left text-xs font-medium">
                      Modifications
                    </th>
                    <th className="min-w-[200px] px-2 py-2 text-left text-xs font-medium">
                      Erreurs / alertes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-sm text-muted-foreground"
                      >
                        Aucune ligne pour ce filtre.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, i) => {
                      const style = ACTION_STYLE[row.action];
                      return (
                        <tr
                          key={`${row.line}-${row.level}-${row.label}-${i}`}
                          className={`border-b last:border-0 ${
                            row.action === "ERROR"
                              ? "bg-destructive/5"
                              : row.action === "CREATE"
                                ? "bg-emerald-500/5"
                                : row.action === "UPDATE"
                                  ? "bg-sky-500/5"
                                  : "bg-background"
                          }`}
                        >
                          <td className="sticky left-0 z-10 bg-card px-2 py-2 font-mono text-xs">
                            {row.line === 0 ? "tpl" : row.line}
                          </td>
                          <td className="sticky left-14 z-10 bg-card px-2 py-2">
                            <Badge className={style.className}>
                              {style.label}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-xs">{row.level === "ACTIVITE" ? "Activité" : row.level === "WORKSTREAM" ? "Workstream" : "Jalon"}</td>
                          <td className="px-2 py-2 text-xs font-medium">
                            <span>{row.label}</span>
                            <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">Sous : {row.parent}</span>
                          </td>
                          <td className="px-2 py-2 text-xs text-muted-foreground">
                            {row.changes.length === 0 ? (
                              <span className="opacity-60">—</span>
                            ) : (
                              <ul className="space-y-0.5">
                                {row.changes.map((c) => (
                                  <li key={c.field}>
                                    <span className="font-mono text-[10px] text-foreground">
                                      {c.field}
                                    </span>
                                    : {c.from} →{" "}
                                    <span className="font-medium text-foreground">
                                      {c.to}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs">
                            {row.errors.length > 0 && (
                              <ul className="list-inside list-disc text-destructive">
                                {row.errors.map((e) => (
                                  <li key={e}>{e}</li>
                                ))}
                              </ul>
                            )}
                            {row.warnings.length > 0 && (
                              <ul className="list-inside list-disc text-amber-700 dark:text-amber-300">
                                {row.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            )}
                            {row.errors.length === 0 &&
                              row.warnings.length === 0 && (
                                <span className="text-muted-foreground opacity-60">
                                  —
                                </span>
                              )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog
        open={purgeOpen}
        onOpenChange={(open) => {
          if (pending) return;
          setPurgeOpen(open);
          if (!open) resetPurgeWizard();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Purger le planning {selected?.code ?? ""}
            </DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <span className="block">
                Cette opération supprimera définitivement tous les
                <strong> jalons, workstreams et activités</strong> du chantier.
                Le chantier sera conservé et repassera à 0 % d&apos;avancement.
              </span>
              <span className="block text-xs">
                La sauvegarde Excel correspondant à la version purgée est
                obligatoire avant confirmation.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className={purgeStep === "backup" ? "rounded-md bg-destructive px-2 py-1.5 text-center font-semibold text-destructive-foreground" : "rounded-md bg-muted px-2 py-1.5 text-center text-muted-foreground"}>
              1 · Sauvegarde
            </div>
            <div className={purgeStep === "code" ? "rounded-md bg-destructive px-2 py-1.5 text-center font-semibold text-destructive-foreground" : "rounded-md bg-muted px-2 py-1.5 text-center text-muted-foreground"}>
              2 · Chantier
            </div>
            <div className={purgeStep === "keyword" ? "rounded-md bg-destructive px-2 py-1.5 text-center font-semibold text-destructive-foreground" : "rounded-md bg-muted px-2 py-1.5 text-center text-muted-foreground"}>
              3 · Confirmation
            </div>
          </div>

          {purgeStep === "backup" && (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm font-medium">Sauvegarde obligatoire</p>
              <p className="text-xs text-muted-foreground">
                Téléchargez le planning complet de {selected?.code}. Le fichier
                contient les identifiants techniques nécessaires à une
                restauration ultérieure par import.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !selected}
                onClick={runPurgeBackup}
                className="w-full justify-center gap-2"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : purgeBackupFingerprint ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <Download className="size-4" />
                )}
                {purgeBackupFingerprint
                  ? "Sauvegarde téléchargée"
                  : "Télécharger la sauvegarde Excel"}
              </Button>
            </div>
          )}

          {purgeStep === "code" && (
            <div className="space-y-3">
              <p className="rounded-lg border bg-muted/40 p-3 text-sm">
                Tapez exactement le code
                <strong className="ml-1 font-mono">{selected?.code}</strong>.
              </p>
              <input
                aria-label="Code du chantier à purger"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-destructive/30"
                value={purgeCodeInput}
                onChange={(event) => setPurgeCodeInput(event.target.value)}
                placeholder={selected?.code ?? "Code chantier"}
                autoComplete="off"
                disabled={pending}
              />
            </div>
          )}

          {purgeStep === "keyword" && (
            <div className="space-y-3">
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                Dernière confirmation : tapez
                <strong className="mx-1 font-mono text-destructive">PURGE</strong>
                pour vider définitivement le planning de {selected?.code}.
              </p>
              <input
                aria-label="Confirmation définitive de la purge"
                className="w-full rounded-md border border-destructive/40 bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-destructive/30"
                value={purgeKeywordInput}
                onChange={(event) => setPurgeKeywordInput(event.target.value)}
                placeholder="PURGE"
                autoComplete="off"
                disabled={pending}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setPurgeOpen(false);
                resetPurgeWizard();
              }}
            >
              Annuler
            </Button>
            <div className="flex gap-2">
              {purgeStep !== "backup" && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (purgeStep === "keyword") {
                      setPurgeStep("code");
                      setPurgeKeywordInput("");
                    } else {
                      setPurgeStep("backup");
                      setPurgeCodeInput("");
                    }
                  }}
                >
                  Retour
                </Button>
              )}
              {purgeStep === "backup" && (
                <Button
                  type="button"
                  disabled={pending || !purgeBackupFingerprint}
                  onClick={() => setPurgeStep("code")}
                >
                  Continuer →
                </Button>
              )}
              {purgeStep === "code" && (
                <Button
                  type="button"
                  disabled={pending || purgeCodeInput.trim() !== selected?.code}
                  onClick={() => setPurgeStep("keyword")}
                >
                  Continuer →
                </Button>
              )}
              {purgeStep === "keyword" && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={
                    pending ||
                    !purgeBackupFingerprint ||
                    purgeCodeInput.trim() !== selected?.code ||
                    purgeKeywordInput.trim() !== "PURGE"
                  }
                  onClick={confirmPurge}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Purger définitivement
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
