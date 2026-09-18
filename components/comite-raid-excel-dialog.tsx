"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/user-provider";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  downloadRaidComiteCanevas,
  previewRaidComiteExcel,
  commitRaidComiteExcel,
} from "@/app/(app)/comites/raid-excel-actions";
import type { RaidComitePreviewLine } from "@/lib/raid-comite-excel";

function downloadBase64Xlsx(fileName: string, base64: string) {
  const clean = base64.replace(/^data:.*?;base64,/, "").replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = String(reader.result ?? "");
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

type Step = 1 | 2 | 3;

export function ComiteRaidExcelDialog({
  open,
  onOpenChange,
  comiteId,
  comiteLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comiteId: string;
  comiteLabel: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [fileB64, setFileB64] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    allOk: boolean;
    fileError?: string;
    accepted: number;
    rejected: number;
    lines: RaidComitePreviewLine[];
  } | null>(null);
  const [created, setCreated] = useState<
    Array<{ code: string; type: string; intitule: string }>
  >([]);

  function reset() {
    setStep(1);
    setFileName("");
    setFileB64("");
    setBusy(false);
    setError(null);
    setPreview(null);
    setCreated([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadCanevas() {
    setBusy(true);
    setError(null);
    try {
      const { fileName: name, base64 } = await downloadRaidComiteCanevas(comiteId);
      downloadBase64Xlsx(name, base64);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      setFileB64(b64);
      const result = await previewRaidComiteExcel(comiteId, b64);
      setPreview(result);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!fileB64 || !preview?.allOk) return;
    setBusy(true);
    setError(null);
    try {
      const result = await commitRaidComiteExcel(comiteId, fileB64);
      setCreated(result.created);
      setStep(3);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[min(100vw-1.5rem,40rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Import RAID — {comiteLabel}</DialogTitle>
          <DialogDescription>
            Création uniquement. Toutes les lignes doivent être valides.
          </DialogDescription>
          <ol className="mt-3 flex gap-2 text-[11px] font-medium">
            {(
              [
                [1, "Fichier"],
                [2, "Contrôle"],
                [3, "Confirmation"],
              ] as const
            ).map(([n, label]) => (
              <li
                key={n}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                  step === n
                    ? "bg-[#0A3C74] text-white"
                    : step > n
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <span className="tabular-nums">{n}</span>
                {label}
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Téléchargez le canevas, remplissez une ligne par RAID, puis
                sélectionnez le fichier. Date d&apos;identification = date de la
                séance. Créateur = vous.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={downloadCanevas}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Télécharger le canevas
                </Button>
              </div>
              <div className="rounded-lg border border-dashed p-6 text-center">
                <FileSpreadsheet className="mx-auto mb-2 size-8 text-[#0A3C74]" />
                <p className="text-sm font-medium">Fichier Excel (.xlsx)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Même format que le canevas
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Parcourir…
                </Button>
              </div>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {fileName ? (
                  <span className="truncate font-medium">{fileName}</span>
                ) : null}
                <Badge variant="secondary">{preview.accepted} acceptée(s)</Badge>
                <Badge
                  variant={preview.rejected ? "destructive" : "secondary"}
                >
                  {preview.rejected} rejetée(s)
                </Badge>
              </div>
              {preview.fileError ? (
                <p className="text-sm text-destructive">{preview.fileError}</p>
              ) : null}
              {!preview.allOk && !preview.fileError ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Corrigez le fichier : le chargement n&apos;est possible que
                  si toutes les lignes sont valides.
                </p>
              ) : null}
              <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
                {preview.lines.map((l) => (
                  <li key={l.excelRow} className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      {l.ok ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          Ligne {l.excelRow}
                          {l.type ? ` · ${l.type}` : ""}
                          {l.intitule ? ` — ${l.intitule}` : ""}
                        </p>
                        {l.ok ? (
                          <p className="text-xs text-muted-foreground">
                            Sera créé · {l.statut || "—"}
                          </p>
                        ) : (
                          <ul className="mt-0.5 list-disc pl-4 text-xs text-destructive">
                            {l.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-5" />
                <p className="font-medium">
                  {created.length} RAID créé(s) et rattaché(s) à {comiteLabel}.
                </p>
              </div>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
                {created.map((c) => (
                  <li key={c.code} className="px-3 py-2">
                    <span className="font-mono text-xs font-semibold">
                      {c.code}
                    </span>
                    <span className="text-muted-foreground"> · {c.type} — </span>
                    {c.intitule}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-3">
          {step === 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Annuler
            </Button>
          )}
          {step === 2 && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setStep(1);
                  setPreview(null);
                  setError(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Retour
              </Button>
              <Button
                type="button"
                disabled={busy || !preview?.allOk}
                onClick={commit}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Valider le chargement
              </Button>
            </>
          )}
          {step === 3 && (
            <Button
              type="button"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ComiteRaidExcelButtons({
  comiteId,
  comiteLabel,
  disabled,
}: {
  comiteId: string;
  comiteLabel: string;
  disabled?: boolean;
}) {
  const { chantierScope, role } = useUser();
  const allChantiers = chantierScope === "all" || role === "Admin";
  const [open, setOpen] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  if (!allChantiers) return null;

  async function downloadCanevas() {
    setDlBusy(true);
    try {
      const { fileName, base64 } = await downloadRaidComiteCanevas(comiteId);
      downloadBase64Xlsx(fileName, base64);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setDlBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="gap-1.5"
        disabled={disabled || dlBusy}
        onClick={downloadCanevas}
      >
        {dlBusy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Canevas Excel
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Upload className="size-3.5" />
        Importer Excel
      </Button>
      <ComiteRaidExcelDialog
        open={open}
        onOpenChange={setOpen}
        comiteId={comiteId}
        comiteLabel={comiteLabel}
      />
    </>
  );
}
