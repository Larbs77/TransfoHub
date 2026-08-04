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
  JALON_PLANNING_CSV_COLUMNS,
  type PlanningAction,
  type PlanningPreviewReport,
} from "@/lib/jalon-planning-import";
import { downloadCsvFile, readCsvFileText } from "@/lib/csv-data-admin";
import {
  listChantiersForPlanningImport,
  exportJalonPlanningCsv,
  previewJalonPlanningImport,
  confirmJalonPlanningImport,
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

export function JalonPlanningImportPanel() {
  const [chantiers, setChantiers] = useState<ChantierPlanningOption[]>([]);
  const [chantierId, setChantierId] = useState("");
  const [preview, setPreview] = useState<PlanningPreviewReport | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [message, setMessage] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
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

  function onChantierChange(id: string) {
    setChantierId(id);
    clearPreview();
    setMessage(null);
  }

  function runExport(mode: "current" | "template" | "empty") {
    if (!chantierId) {
      setMessage({ type: "error", text: "Sélectionnez d'abord un chantier." });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const { fileName, csv } = await exportJalonPlanningCsv(
          chantierId,
          mode
        );
        downloadCsvFile(fileName, csv);
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
        // Auto-detect UTF-8 vs Windows-1252 (Excel) so accents stay intact
        const text = await readCsvFileText(file);
        setCsvText(text);
        const report = await previewJalonPlanningImport(chantierId, text);
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
        const result = await confirmJalonPlanningImport(
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
          text: `Injection terminée pour ${result.chantierCode} : ${result.created} créé(s), ${result.updated} mis à jour, ${result.skipped} inchangé(s)${
            result.willApplyTemplate
              ? " (template appliqué puis fusionné)"
              : ""
          }.`,
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
                Importez un CSV{" "}
                <code className="rounded bg-muted px-1 text-[11px]">|</code>{" "}
                pour planifier les jalons d&apos;un chantier sélectionné.{" "}
                <strong className="font-medium text-foreground">
                  Chargement à blanc obligatoire
                </strong>{" "}
                : CREATE / UPDATE / SKIP / ERROR, puis rejet ou confirmation.
                Cas vide → template puis fusion. Cas existant → fusion seule
                (pas de suppression).
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2"
            disabled={pending || !chantierId}
            onClick={() => runExport("current")}
          >
            <Download className="size-4 text-[#00BDBB]" />
            Exporter le planning
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2"
            disabled={pending || !chantierId}
            onClick={() => runExport("template")}
          >
            <FileDown className="size-4 text-[#00BDBB]" />
            Modèle template prérempli
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2"
            disabled={pending || !chantierId}
            onClick={() => runExport("empty")}
          >
            <FileSpreadsheet className="size-4 text-[#00BDBB]" />
            Structure vide (CSV · |)
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
              disabled={pending || !chantierId}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4 text-[#00BDBB]" />
              Charger un CSV…
            </Button>
          </div>
        </div>

        {/* Columns help */}
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Colonnes CSV
          </p>
          <div className="flex flex-wrap gap-1.5">
            {JALON_PLANNING_CSV_COLUMNS.map((col) => (
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
            * = obligatoire · Séparateur{" "}
            <code className="rounded bg-muted px-1">|</code> · Dates{" "}
            <strong>jj/mm/aaaa</strong> · Encodage : export UTF-8 + BOM, import
            auto UTF-8 / Windows-1252 (Excel) · Clé :{" "}
            <strong>phase + nom</strong> · Jalons absents du fichier conservés ·
            Workflow Direct requis
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
                {preview.willApplyTemplate
                  ? `Chantier sans jalon : le template (${preview.templateJalonCount} jalons) serait appliqué puis fusionné avec le fichier.`
                  : `Merge sur ${preview.existingJalonCount} jalon(s) existant(s). Les jalons absents du fichier restent en base.`}
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
                en erreur. Corrigez le CSV et rechargez le fichier.
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
                      Phase
                    </th>
                    <th className="min-w-[180px] px-2 py-2 text-left text-xs font-medium">
                      Nom
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
                          key={`${row.line}-${row.phase}-${row.nom}-${i}`}
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
                          <td className="px-2 py-2 text-xs">{row.phase}</td>
                          <td className="px-2 py-2 text-xs font-medium">
                            {row.nom}
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
    </Card>
  );
}
