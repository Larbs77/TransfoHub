"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  Download,
  FileSpreadsheet,
  Upload,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Database,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DATA_TABLE_KEYS,
  DATA_TABLE_META,
  type DataTableKey,
  type PreviewReport,
} from "@/lib/csv-data-admin";
import {
  exportTableCsv,
  downloadTemplateCsv,
  previewCsvImport,
  confirmCsvImport,
  purgeTable,
  type ImportWriteMode,
} from "./actions";

function downloadBlob(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Props = {
  initialCounts: Record<DataTableKey, number>;
};

export function DataAdminPanel({ initialCounts }: Props) {
  const [active, setActive] = useState<DataTableKey>("ressources");
  const [counts, setCounts] =
    useState<Record<DataTableKey, number>>(initialCounts);
  const [preview, setPreview] = useState<PreviewReport | null>(null);
  const [message, setMessage] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  } | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  /** Standalone purge wizard: backup → type table name → type PURGE */
  type PurgeStep = "backup" | "name" | "keyword";
  const [purgeStep, setPurgeStep] = useState<PurgeStep>("backup");
  const [purgeBackupOk, setPurgeBackupOk] = useState(false);
  const [purgeNameInput, setPurgeNameInput] = useState("");
  const [purgeKeywordInput, setPurgeKeywordInput] = useState("");
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportWriteMode>("append");
  /** Backup CSV downloaded for replace-import (required before purge+import). */
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const meta = DATA_TABLE_META[active];
  const replaceNeedsBackup = importMode === "replace" && counts[active] > 0;
  const canApproveReplace = !replaceNeedsBackup || backupDownloaded;
  /** Exact table label the user must type (step 1 of purge). */
  const purgeExpectedName = meta.label;

  const clearFeedback = useCallback(() => setMessage(null), []);

  function resetPurgeWizard() {
    setPurgeStep("backup");
    setPurgeBackupOk(false);
    setPurgeNameInput("");
    setPurgeKeywordInput("");
  }

  function openPurgeDialog() {
    resetPurgeWizard();
    setPurgeOpen(true);
  }

  function handleTab(key: DataTableKey) {
    setActive(key);
    setPreview(null);
    setImportMode("append");
    setBackupDownloaded(false);
    setConfirmWord("");
    resetPurgeWizard();
    clearFeedback();
    if (fileRef.current) fileRef.current.value = "";
  }

  function runExport(opts?: { asBackup?: "replace" | "purge" }) {
    clearFeedback();
    startTransition(async () => {
      try {
        const { fileName, csv } = await exportTableCsv(active);
        // Distinct name when forced as pre-purge backup
        const name = opts?.asBackup
          ? fileName.replace(
              /\.csv$/i,
              `_sauvegarde_avant_purge_${Date.now()}.csv`
            )
          : fileName;
        downloadBlob(name, csv);
        if (opts?.asBackup === "purge") {
          setPurgeBackupOk(true);
          setMessage({
            type: "ok",
            text: `Sauvegarde téléchargée : ${name} (${counts[active]} ligne(s)). Passez à l’étape suivante.`,
          });
        } else if (opts?.asBackup === "replace" || importMode === "replace") {
          setBackupDownloaded(true);
          setMessage({
            type: "ok",
            text: `Sauvegarde téléchargée : ${name} (${counts[active]} ligne(s)). Vous pouvez confirmer le purge + import.`,
          });
        } else {
          setMessage({
            type: "ok",
            text: `Export téléchargé : ${name} (${counts[active]} ligne(s)).`,
          });
        }
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de l'export",
        });
      }
    });
  }

  function runTemplate() {
    clearFeedback();
    startTransition(async () => {
      try {
        const { fileName, csv } = await downloadTemplateCsv(active);
        downloadBlob(fileName, csv);
        setMessage({
          type: "info",
          text: `Modèle (structure) téléchargé : ${fileName}`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec du modèle",
        });
      }
    });
  }

  function onFileSelected(file: File | null) {
    if (!file) return;
    clearFeedback();
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      startTransition(async () => {
        try {
          const report = await previewCsvImport(active, text);
          setPreview(report);
          if (report.total === 0 && report.errorCount === 0) {
            setMessage({
              type: "info",
              text: "Aucune ligne de données dans le fichier.",
            });
          } else {
            setMessage({
              type: report.errorCount > 0 ? "info" : "ok",
              text: `Lecture terminée : ${report.okCount} valide(s), ${report.errorCount} erreur(s) sur ${report.total} ligne(s).`,
            });
          }
        } catch (e) {
          setMessage({
            type: "error",
            text: e instanceof Error ? e.message : "Échec de la lecture CSV",
          });
        }
      });
    };
    reader.onerror = () => {
      setMessage({ type: "error", text: "Impossible de lire le fichier." });
    };
    reader.readAsText(file, "UTF-8");
  }

  function openImportConfirm() {
    if (!preview || preview.okCount === 0) return;
    if (replaceNeedsBackup && !backupDownloaded) {
      setMessage({
        type: "error",
        text: "Mode « Purge et recréer » : téléchargez d'abord la sauvegarde CSV des données actuelles.",
      });
      return;
    }
    setConfirmWord("");
    setImportConfirmOpen(true);
  }

  function runImport() {
    if (!preview || preview.okCount === 0) return;
    if (replaceNeedsBackup && !backupDownloaded) return;
    if (importMode === "replace" && confirmWord !== "PURGE") return;

    const payloads = preview.rows
      .filter((r) => r.status === "ok" && r.payload)
      .map((r) => r.payload as Record<string, unknown>);

    startTransition(async () => {
      try {
        const result = await confirmCsvImport(active, payloads, importMode);
        setCounts((c) => ({
          ...c,
          [active]: result.mode === "replace" ? result.imported : c[active] + result.imported,
        }));
        setPreview(null);
        setImportConfirmOpen(false);
        setConfirmWord("");
        setBackupDownloaded(false);
        setImportMode("append");
        if (fileRef.current) fileRef.current.value = "";
        const purgeMsg =
          result.mode === "replace"
            ? ` Table purgée (${result.purged} ancien(s) enregistrement(s) supprimé(s)), puis `
            : " ";
        setMessage({
          type: "ok",
          text: `${result.mode === "replace" ? "Remplacement terminé." : "Import terminé."}${purgeMsg}${result.imported} ligne(s) créée(s) dans « ${meta.label} ». Les id / createdAt / updatedAt ont été générés par le système.`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de l'import",
        });
        setImportConfirmOpen(false);
      }
    });
  }

  function runPurge() {
    if (!purgeBackupOk) return;
    if (purgeNameInput.trim() !== purgeExpectedName) return;
    if (purgeKeywordInput.trim() !== "PURGE") return;

    startTransition(async () => {
      try {
        const result = await purgeTable(active);
        setCounts((c) => ({ ...c, [active]: 0 }));
        setPurgeOpen(false);
        resetPurgeWizard();
        setPreview(null);
        setMessage({
          type: "ok",
          text: `Table « ${meta.label} » purgée : ${result.deleted} enregistrement(s) supprimé(s).`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de la purge",
        });
        setPurgeOpen(false);
        resetPurgeWizard();
      }
    });
  }

  const previewColumns = useMemo(() => {
    return meta.columns.map((c) => c.header);
  }, [meta]);

  return (
    <div className="space-y-6">
      {/* Table selector */}
      <div className="flex flex-wrap gap-2">
        {DATA_TABLE_KEYS.map((key) => {
          const m = DATA_TABLE_META[key];
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleTab(key)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-[#00BDBB]/50 hover:bg-muted/40"
              }`}
            >
              <Database
                className={`size-4 ${selected ? "text-[#00BDBB]" : "text-muted-foreground"}`}
              />
              <span>{m.label}</span>
              <Badge
                variant={selected ? "secondary" : "outline"}
                className={
                  selected
                    ? "bg-white/15 text-primary-foreground border-0"
                    : ""
                }
              >
                {counts[key]}
              </Badge>
            </button>
          );
        })}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg text-primary">{meta.label}</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                {meta.description} Les champs techniques{" "}
                <code className="rounded bg-muted px-1 text-[11px]">id</code>,{" "}
                <code className="rounded bg-muted px-1 text-[11px]">
                  createdAt
                </code>{" "}
                et{" "}
                <code className="rounded bg-muted px-1 text-[11px]">
                  updatedAt
                </code>{" "}
                sont gérés par le système et absents du CSV.
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {counts[active]} en base
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {/* Actions */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2"
              disabled={pending}
              onClick={() => runExport()}
            >
              <Download className="size-4 text-[#00BDBB]" />
              Export complet (CSV · |)
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2"
              disabled={pending}
              onClick={runTemplate}
            >
              <FileDown className="size-4 text-[#00BDBB]" />
              Modèle structure (CSV · |)
            </Button>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                disabled={pending}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4 text-[#00BDBB]" />
                Charger un CSV…
              </Button>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="justify-start gap-2"
              disabled={pending || counts[active] === 0}
              onClick={openPurgeDialog}
            >
              <Trash2 className="size-4" />
              Purger la table
            </Button>
          </div>

          {/* Column help */}
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Colonnes CSV
            </p>
            <div className="flex flex-wrap gap-1.5">
              {meta.columns.map((col) => (
                <span
                  key={col.key}
                  title={col.description}
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                    col.required
                      ? "border-[#00BDBB]/40 bg-[#00BDBB]/10 text-foreground"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {col.header}
                  {col.required ? " *" : ""}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              * = obligatoire · Séparateur de champs :{" "}
              <code className="rounded bg-muted px-1">|</code> (pipe) · les
              virgules sont autorisées dans le texte · Encodage UTF-8 · Dates :
              YYYY-MM-DD
              {active === "raid" &&
                " · chantier_code = code du chantier · responsable_email = e-mail d’une ressource existante"}
              {active === "ressources" &&
                " · profil = nom exact d’un profil ressource existant"}
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
                <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-[#00BDBB]" />
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

          {/* Preview report */}
          {preview && preview.rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-primary">
                    Rapport de lecture
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Vérifiez les lignes avant validation. Seules les lignes
                    valides seront persistées.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    {preview.okCount} OK
                  </Badge>
                  <Badge variant="destructive">{preview.errorCount} erreur(s)</Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setPreview(null);
                      setImportMode("append");
                      setBackupDownloaded(false);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>

              {/* Import mode: append vs purge+recreate */}
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mode d&apos;écriture en base
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode("append");
                      setConfirmWord("");
                    }}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                      importMode === "append"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-[#00BDBB]/50"
                    }`}
                  >
                    <span className="font-semibold">Ajouter (append)</span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        importMode === "append"
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      Conserve les données existantes et insère les nouvelles
                      lignes.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode("replace");
                      setConfirmWord("");
                      // Force a fresh backup for this replace attempt if data exists
                      if (counts[active] > 0) setBackupDownloaded(false);
                    }}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                      importMode === "replace"
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-border bg-card hover:border-red-500/50"
                    }`}
                  >
                    <span className="font-semibold">Purger et recréer</span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        importMode === "replace"
                          ? "text-white/85"
                          : "text-muted-foreground"
                      }`}
                    >
                      Supprime toutes les lignes de « {meta.label} », puis
                      charge uniquement le CSV validé.
                    </span>
                  </button>
                </div>

                {importMode === "replace" && (
                  <div className="rounded-lg border border-red-600/40 bg-red-600/10 px-3 py-2.5 text-xs text-red-900 dark:text-red-100 space-y-2">
                    <p className="flex items-start gap-2 font-semibold">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      Attention — opération destructive
                    </p>
                    <ul className="list-inside list-disc space-y-1 pl-1">
                      <li>
                        {counts[active]} enregistrement(s) actuel(s) de «{" "}
                        {meta.label} » seront supprimés avant l&apos;import.
                      </li>
                      {active === "ressources" && (
                        <li>
                          Les saisies de temps liées seront aussi supprimées ;
                          liens utilisateurs / équipes / RAID détachés.
                        </li>
                      )}
                      <li>
                        Les nouvelles lignes auront de nouveaux id générés par
                        le système.
                      </li>
                    </ul>
                    {replaceNeedsBackup && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-red-600/40 bg-background"
                          disabled={pending}
                          onClick={() => runExport({ asBackup: "replace" })}
                        >
                          <Download className="size-3.5" />
                          {backupDownloaded
                            ? "Sauvegarde déjà téléchargée (re-télécharger)"
                            : "1. Télécharger la sauvegarde CSV obligatoire"}
                        </Button>
                        {backupDownloaded ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                            Sauvegarde OK
                          </Badge>
                        ) : (
                          <span className="text-[11px] font-medium text-red-800 dark:text-red-200">
                            Obligatoire tant que la table n&apos;est pas vide
                          </span>
                        )}
                      </div>
                    )}
                    {!replaceNeedsBackup && (
                      <p className="text-[11px] opacity-90">
                        Table actuellement vide — aucune sauvegarde requise.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      pending ||
                      preview.okCount === 0 ||
                      !canApproveReplace
                    }
                    className="gap-1.5"
                    variant={importMode === "replace" ? "destructive" : "default"}
                    onClick={openImportConfirm}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {importMode === "replace"
                      ? `Approuver purge + import (${preview.okCount})`
                      : `Approuver et ajouter (${preview.okCount})`}
                  </Button>
                  {importMode === "replace" &&
                    replaceNeedsBackup &&
                    !backupDownloaded && (
                      <span className="text-[11px] text-muted-foreground">
                        Téléchargez la sauvegarde pour activer la confirmation.
                      </span>
                    )}
                </div>
              </div>

              {/* Single scrollport: same max height, all columns via horizontal scroll */}
              <div className="max-h-[420px] overflow-auto rounded-xl border">
                <table className="w-max min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-30">
                    <tr className="border-b bg-muted/95 backdrop-blur-sm">
                      <th className="sticky left-0 z-40 w-14 bg-muted px-2 py-2 text-left text-xs font-medium">
                        Ligne
                      </th>
                      <th className="sticky left-14 z-40 w-24 bg-muted px-2 py-2 text-left text-xs font-medium">
                        Statut
                      </th>
                      <th className="min-w-[180px] whitespace-nowrap px-2 py-2 text-left text-xs font-medium">
                        Erreurs
                      </th>
                      {previewColumns.map((h) => (
                        <th
                          key={h}
                          className="min-w-[140px] whitespace-nowrap px-2 py-2 text-left font-mono text-[11px] font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr
                        key={row.line}
                        className={`border-b last:border-0 ${
                          row.status === "error"
                            ? "bg-destructive/5"
                            : "bg-emerald-500/5"
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-card px-2 py-2 font-mono text-xs">
                          {row.line}
                        </td>
                        <td className="sticky left-14 z-10 bg-card px-2 py-2">
                          {row.status === "ok" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3.5" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                              <XCircle className="size-3.5" /> Erreur
                            </span>
                          )}
                        </td>
                        <td className="min-w-[180px] max-w-[280px] px-2 py-2 text-xs text-destructive">
                          {row.errors.join(" · ")}
                        </td>
                        {previewColumns.map((h) => (
                          <td
                            key={h}
                            className="min-w-[140px] max-w-[280px] truncate px-2 py-2 text-xs"
                            title={row.display[h] ?? ""}
                          >
                            {row.display[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Faites défiler horizontalement pour voir toutes les colonnes ·{" "}
                {previewColumns.length} colonne(s) de données
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purge confirm — multi-step: backup → table name → PURGE */}
      <Dialog
        open={purgeOpen}
        onOpenChange={(open) => {
          setPurgeOpen(open);
          if (!open) resetPurgeWizard();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Purger « {meta.label} »
            </DialogTitle>
            <DialogDescription className="text-left space-y-2">
              <span className="block">
                Suppression de <strong>{counts[active]}</strong>{" "}
                enregistrement(s) — action irréversible.
                {active === "ressources"
                  ? " Les saisies de temps liées seront aussi supprimées ; liens utilisateurs / équipes / RAID détachés."
                  : ""}
              </span>
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            {(
              [
                { id: "backup" as const, label: "1. Sauvegarde" },
                { id: "name" as const, label: "2. Nom table" },
                { id: "keyword" as const, label: "3. PURGE" },
              ] as const
            ).map((s, i) => {
              const done =
                (s.id === "backup" && purgeBackupOk) ||
                (s.id === "name" &&
                  purgeNameInput.trim() === purgeExpectedName) ||
                (s.id === "keyword" && purgeKeywordInput.trim() === "PURGE");
              const activeStep = purgeStep === s.id;
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-muted-foreground/50">→</span>
                  )}
                  <span
                    className={
                      activeStep
                        ? "rounded-full bg-red-600 px-2 py-0.5 text-white"
                        : done
                          ? "rounded-full bg-emerald-600/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300"
                          : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                    }
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {purgeStep === "backup" && (
            <div className="space-y-3 rounded-lg border border-red-600/30 bg-red-600/5 p-3">
              <p className="text-sm font-semibold text-foreground">
                Étape 1 / 3 — Sauvegarde CSV obligatoire
              </p>
              <p className="text-xs text-muted-foreground">
                Avant toute purge, téléchargez un export complet de «{" "}
                {meta.label} » (séparateur{" "}
                <code className="rounded bg-muted px-1">|</code>). Sans ce
                fichier, la suite est bloquée.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={pending}
                onClick={() => runExport({ asBackup: "purge" })}
              >
                <Download className="size-4 text-[#00BDBB]" />
                {purgeBackupOk
                  ? "Sauvegarde téléchargée — re-télécharger"
                  : "Télécharger la sauvegarde CSV"}
              </Button>
              {purgeBackupOk && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  Sauvegarde OK — vous pouvez continuer.
                </p>
              )}
            </div>
          )}

          {purgeStep === "name" && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold text-foreground">
                Étape 2 / 3 — Confirmer le nom de la table
              </p>
              <p className="text-xs text-muted-foreground">
                Saisissez exactement le nom de la table à purger :{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-bold text-foreground">
                  {purgeExpectedName}
                </code>
              </p>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                value={purgeNameInput}
                onChange={(e) => setPurgeNameInput(e.target.value)}
                placeholder={purgeExpectedName}
                autoComplete="off"
                disabled={pending}
                autoFocus
              />
              {purgeNameInput.length > 0 &&
                purgeNameInput.trim() !== purgeExpectedName && (
                  <p className="text-[11px] text-destructive">
                    Le nom ne correspond pas. Respectez la casse et
                    l&apos;orthographe.
                  </p>
                )}
            </div>
          )}

          {purgeStep === "keyword" && (
            <div className="space-y-3 rounded-lg border border-red-600/30 bg-red-600/5 p-3">
              <p className="text-sm font-semibold text-destructive">
                Étape 3 / 3 — Mot-clé de confirmation
              </p>
              <p className="text-xs text-muted-foreground">
                Table ciblée :{" "}
                <strong className="text-foreground">{purgeExpectedName}</strong>{" "}
                ({counts[active]} ligne(s)). Tapez{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-bold">
                  PURGE
                </code>{" "}
                en majuscules pour autoriser la suppression définitive.
              </p>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                value={purgeKeywordInput}
                onChange={(e) => setPurgeKeywordInput(e.target.value)}
                placeholder="PURGE"
                autoComplete="off"
                disabled={pending}
                autoFocus
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
            <div className="flex flex-wrap gap-2">
              {purgeStep !== "backup" && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (purgeStep === "keyword") {
                      setPurgeStep("name");
                      setPurgeKeywordInput("");
                    } else if (purgeStep === "name") {
                      setPurgeStep("backup");
                      setPurgeNameInput("");
                    }
                  }}
                >
                  Retour
                </Button>
              )}
              {purgeStep === "backup" && (
                <Button
                  type="button"
                  disabled={pending || !purgeBackupOk}
                  onClick={() => setPurgeStep("name")}
                >
                  Continuer →
                </Button>
              )}
              {purgeStep === "name" && (
                <Button
                  type="button"
                  disabled={
                    pending || purgeNameInput.trim() !== purgeExpectedName
                  }
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
                    !purgeBackupOk ||
                    purgeNameInput.trim() !== purgeExpectedName ||
                    purgeKeywordInput.trim() !== "PURGE"
                  }
                  onClick={runPurge}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Purger définitivement"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import confirm */}
      <Dialog
        open={importConfirmOpen}
        onOpenChange={(open) => {
          setImportConfirmOpen(open);
          if (!open) setConfirmWord("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className={
                importMode === "replace" ? "text-destructive" : undefined
              }
            >
              {importMode === "replace" ? (
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="size-5" />
                  Confirmer purge + import
                </span>
              ) : (
                "Confirmer l\u2019ajout (append)"
              )}
            </DialogTitle>
            <DialogDescription className="text-left space-y-2">
              {importMode === "append" ? (
                <span className="block">
                  {preview?.okCount ?? 0} ligne(s) valide(s) seront{" "}
                  <strong>ajoutées</strong> à « {meta.label} » (données
                  existantes conservées).
                  {(preview?.errorCount ?? 0) > 0 && (
                    <>
                      {" "}
                      Les {preview?.errorCount} ligne(s) en erreur seront
                      ignorées.
                    </>
                  )}{" "}
                  Les id / dates techniques sont générés automatiquement.
                </span>
              ) : (
                <>
                  <span className="block text-red-700 dark:text-red-300">
                    <strong>Purge et recréer :</strong> les{" "}
                    {counts[active]} enregistrement(s) actuels de « {meta.label}{" "}
                    » seront <strong>supprimés</strong>, puis{" "}
                    {preview?.okCount ?? 0} ligne(s) du CSV seront insérées.
                    {(preview?.errorCount ?? 0) > 0 && (
                      <>
                        {" "}
                        Les {preview?.errorCount} ligne(s) en erreur restent
                        ignorées.
                      </>
                    )}
                  </span>
                  {replaceNeedsBackup && (
                    <span className="block text-xs">
                      Sauvegarde CSV :{" "}
                      {backupDownloaded ? (
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          téléchargée
                        </strong>
                      ) : (
                        <strong className="text-destructive">
                          manquante — annulez et téléchargez-la
                        </strong>
                      )}
                      .
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    Tapez{" "}
                    <code className="rounded bg-muted px-1 font-bold">
                      PURGE
                    </code>{" "}
                    pour confirmer.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {importMode === "replace" && (
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder="PURGE"
              autoComplete="off"
              disabled={pending}
            />
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setImportConfirmOpen(false);
                setConfirmWord("");
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant={importMode === "replace" ? "destructive" : "default"}
              disabled={
                pending ||
                (importMode === "replace" &&
                  (confirmWord !== "PURGE" ||
                    (replaceNeedsBackup && !backupDownloaded)))
              }
              onClick={runImport}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : importMode === "replace" ? (
                "Purger et importer"
              ) : (
                "Ajouter les lignes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
