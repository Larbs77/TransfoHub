"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PHASES, PHASE_COLORS } from "@/lib/jalon-labels";
import {
  createJalonTemplate,
  updateJalonTemplate,
  deleteJalonTemplate,
  createWorkstreamTemplate,
  updateWorkstreamTemplate,
  deleteWorkstreamTemplate,
  createActiviteTemplate,
  updateActiviteTemplate,
  deleteActiviteTemplate,
  exportJalonTemplateExcel,
  downloadJalonTemplateExcelModel,
  previewJalonTemplateExcel,
  confirmImportJalonTemplateExcel,
} from "@/app/(app)/actions";
import {
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  FileDown,
  FileUp,
  FileSpreadsheet,
  GitBranch,
  ListTree,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface ActiviteTemplate {
  id: string;
  nom: string;
  ordre: number;
  description: string;
}

interface WorkstreamTemplate {
  id: string;
  nom: string;
  ordre: number;
  description: string;
  activites: ActiviteTemplate[];
}

interface JalonTemplate {
  id: string;
  phase: string;
  nom: string;
  ordre: number;
  offsetPct: number;
  workstreams?: WorkstreamTemplate[];
}

interface Props {
  templates: JalonTemplate[];
}

// ── Excel helpers (client) ────────────────────────────

function downloadBase64Xlsx(fileName: string, base64: string) {
  const clean = base64.replace(/^data:.*?;base64,/, "").replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  // Pass a fresh ArrayBuffer-backed view (avoids SharedArrayBuffer / detached issues)
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], {
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

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice) as number[]);
  }
  return btoa(binary);
}

// ── Root ──────────────────────────────────────────────

export function JalonTemplateSettings({ templates }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBase64, setImportBase64] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    ok: boolean;
    issues: { row: number; message: string }[];
    stats: {
      jalonCount: number;
      workstreamCount: number;
      activiteCount: number;
      rowCount: number;
    };
  } | null>(null);

  const totals = useMemo(() => {
    let ws = 0;
    let act = 0;
    for (const t of templates) {
      const streams = t.workstreams ?? [];
      ws += streams.length;
      act += streams.reduce((n, s) => n + (s.activites?.length ?? 0), 0);
    }
    return { jalons: templates.length, ws, act };
  }, [templates]);

  function runExport(kind: "current" | "model") {
    setMessage(null);
    startTransition(async () => {
      try {
        const res =
          kind === "current"
            ? await exportJalonTemplateExcel()
            : await downloadJalonTemplateExcelModel();
        downloadBase64Xlsx(res.fileName, res.base64);
        setMessage({
          type: "ok",
          text:
            kind === "current"
              ? `Export téléchargé : ${res.fileName}`
              : `Modèle téléchargé : ${res.fileName}`,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec export Excel",
        });
      }
    });
  }

  function onPickImport(file: File | null) {
    if (!file) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const b64 = await fileToBase64(file);
        const preview = await previewJalonTemplateExcel(b64);
        setImportBase64(b64);
        setImportPreview(preview);
        setImportOpen(true);
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Lecture Excel impossible",
        });
      }
    });
  }

  function confirmImport() {
    if (!importBase64 || !importPreview?.ok) return;
    startTransition(async () => {
      try {
        const res = await confirmImportJalonTemplateExcel(importBase64);
        setImportOpen(false);
        setImportBase64(null);
        setImportPreview(null);
        setMessage({
          type: res.ok ? "ok" : "error",
          text: res.message,
        });
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec import",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Référentiel type :{" "}
            <span className="font-medium text-foreground">
              Phase → Jalon → Workstream → Activité
            </span>
            . Dépliez un jalon pour deep-dive. L&apos;export Excel permet de
            construire le modèle hors outil puis de le recharger (remplacement
            complet après confirmation).
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{totals.jalons} jalon(s)</Badge>
            <Badge variant="outline">{totals.ws} workstream(s)</Badge>
            <Badge variant="outline">{totals.act} activité(s)</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => runExport("model")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Modèle Excel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => runExport("current")}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            Exporter
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            Importer Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              onPickImport(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : message.type === "error"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          {message.text}
        </div>
      )}

      <Tabs defaultValue={PHASES[0]} className="space-y-4">
        <TabsList>
          {PHASES.map((phase) => {
            const count = templates.filter((t) => t.phase === phase).length;
            return (
              <TabsTrigger key={phase} value={phase} className="gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: PHASE_COLORS[phase] }}
                />
                {phase}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({count})
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PHASES.map((phase) => (
          <TabsContent key={phase} value={phase}>
            <PhaseTemplateList
              phase={phase}
              templates={templates
                .filter((t) => t.phase === phase)
                .sort((a, b) => a.ordre - b.ordre)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportBase64(null);
            setImportPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importer le référentiel Excel</DialogTitle>
            <DialogDescription>
              L&apos;import{" "}
              <strong>remplace entièrement</strong> le template actuel (jalons,
              workstreams et activités). Exportez d&apos;abord une sauvegarde si
              besoin.
            </DialogDescription>
          </DialogHeader>

          {importPreview && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  Lignes lues :{" "}
                  <strong>{importPreview.stats.rowCount}</strong>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  Jalons : <strong>{importPreview.stats.jalonCount}</strong>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  Workstreams :{" "}
                  <strong>{importPreview.stats.workstreamCount}</strong>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  Activités :{" "}
                  <strong>{importPreview.stats.activiteCount}</strong>
                </div>
              </div>

              {importPreview.issues.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <p className="mb-1 font-medium text-destructive">
                    {importPreview.issues.length} problème(s)
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {importPreview.issues.map((iss, idx) => (
                      <li key={idx}>
                        {iss.row > 0 ? `Ligne ${iss.row} : ` : ""}
                        {iss.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.ok && (
                <p className="text-emerald-700 dark:text-emerald-300">
                  Fichier valide — prêt à remplacer le référentiel.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !importPreview?.ok}
              onClick={confirmImport}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              Remplacer le template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Phase list ────────────────────────────────────────

function PhaseTemplateList({
  phase,
  templates,
}: {
  phase: string;
  templates: JalonTemplate[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 px-2 py-2" />
              <th className="w-12 px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Nom du jalon</th>
              <th className="w-28 px-3 py-2 text-left font-medium">
                Position (%)
              </th>
              <th className="w-36 px-3 py-2 text-left font-medium">Détail</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <TemplateRow key={t.id} template={t} />
            ))}
            {adding && (
              <AddJalonRow
                phase={phase}
                nextOrdre={
                  templates.length > 0
                    ? Math.max(...templates.map((t) => t.ordre)) + 1
                    : 1
                }
                onDone={() => setAdding(false)}
              />
            )}
            {templates.length === 0 && !adding && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-4 text-center text-muted-foreground"
                >
                  Aucun jalon défini pour cette phase
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Ajouter un jalon
        </Button>
      )}
    </div>
  );
}

// ── Jalon row + tree ──────────────────────────────────

function TemplateRow({ template }: { template: JalonTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(template.nom);
  const [offsetPct, setOffsetPct] = useState(template.offsetPct);
  const [ordre, setOrdre] = useState(template.ordre);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingWs, setAddingWs] = useState(false);

  const workstreams = template.workstreams ?? [];
  const wsCount = workstreams.length;
  const actCount = workstreams.reduce(
    (n, w) => n + (w.activites?.length ?? 0),
    0
  );

  async function handleSave() {
    setLoading(true);
    try {
      await updateJalonTemplate(template.id, { nom, ordre, offsetPct });
      setEditing(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer le jalon « ${template.nom} » et tous ses workstreams / activités ?`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteJalonTemplate(template.id);
    } finally {
      setDeleting(false);
    }
  }

  function handleCancel() {
    setNom(template.nom);
    setOffsetPct(template.offsetPct);
    setOrdre(template.ordre);
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="border-b">
        <td className="px-2 py-1.5" />
        <td className="px-3 py-1.5">
          <Input
            type="number"
            value={ordre}
            onChange={(e) => setOrdre(Number(e.target.value))}
            className="h-8 w-12"
            min={1}
          />
        </td>
        <td className="px-3 py-1.5">
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="h-8"
          />
        </td>
        <td className="px-3 py-1.5">
          <Input
            type="number"
            value={offsetPct}
            onChange={(e) => setOffsetPct(Number(e.target.value))}
            className="h-8 w-20"
            min={0}
            max={100}
          />
        </td>
        <td className="px-3 py-1.5" />
        <td className="px-3 py-1.5 text-right">
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={handleSave}
              disabled={loading || !nom.trim()}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={handleCancel}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-2 py-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            title={expanded ? "Replier" : "Déplier workstreams / activités"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
          </Button>
        </td>
        <td className="px-3 py-2 text-muted-foreground">{template.ordre}</td>
        <td className="px-3 py-2 font-medium">{template.nom}</td>
        <td className="px-3 py-2 text-muted-foreground">
          {template.offsetPct}%
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="size-3.5" />
            {wsCount} WS
            <span className="text-border">·</span>
            <ListTree className="size-3.5" />
            {actCount} act.
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              title="Ajouter un workstream"
              onClick={() => {
                setExpanded(true);
                setAddingWs(true);
              }}
            >
              <Plus className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={6} className="px-3 py-3">
            <div className="ml-6 space-y-2 border-l-2 border-[#00BDBB]/40 pl-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Workstreams
                </p>
                {!addingWs && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setAddingWs(true)}
                  >
                    <Plus className="size-3.5" />
                    Workstream
                  </Button>
                )}
              </div>

              {workstreams.length === 0 && !addingWs && (
                <p className="text-xs text-muted-foreground">
                  Aucun workstream — utilisez + pour en ajouter.
                </p>
              )}

              <div className="space-y-2">
                {[...workstreams]
                  .sort((a, b) => a.ordre - b.ordre)
                  .map((ws) => (
                    <WorkstreamBlock key={ws.id} workstream={ws} />
                  ))}
                {addingWs && (
                  <AddWorkstreamRow
                    jalonTemplateId={template.id}
                    nextOrdre={
                      workstreams.length > 0
                        ? Math.max(...workstreams.map((w) => w.ordre)) + 1
                        : 1
                    }
                    onDone={() => setAddingWs(false)}
                  />
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Workstream block ──────────────────────────────────

function WorkstreamBlock({ workstream }: { workstream: WorkstreamTemplate }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(workstream.nom);
  const [ordre, setOrdre] = useState(workstream.ordre);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingAct, setAddingAct] = useState(false);

  const activites = workstream.activites ?? [];

  async function handleSave() {
    if (!nom.trim()) return;
    setLoading(true);
    try {
      await updateWorkstreamTemplate(workstream.id, {
        nom: nom.trim(),
        ordre,
      });
      setEditing(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer le workstream « ${workstream.nom} » et ses activités ?`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteWorkstreamTemplate(workstream.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card/80">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </Button>

        {editing ? (
          <>
            <Input
              type="number"
              value={ordre}
              onChange={(e) => setOrdre(Number(e.target.value))}
              className="h-8 w-14"
              min={1}
            />
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="h-8 min-w-[12rem] flex-1"
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={handleSave}
              disabled={loading || !nom.trim()}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => {
                setNom(workstream.nom);
                setOrdre(workstream.ordre);
                setEditing(false);
              }}
            >
              <X className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground w-6">
              {workstream.ordre}
            </span>
            <span className="flex-1 text-sm font-medium">{workstream.nom}</span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              Workstream
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal">
              {activites.length} act.
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              title="Ajouter une activité"
              onClick={() => {
                setOpen(true);
                setAddingAct(true);
              }}
            >
              <Plus className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </>
        )}
      </div>

      {open && (
        <div className="space-y-1 border-t bg-muted/15 px-3 py-2 pl-10">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Activités
          </p>
          {activites.length === 0 && !addingAct && (
            <p className="text-xs text-muted-foreground">Aucune activité.</p>
          )}
          {[...activites]
            .sort((a, b) => a.ordre - b.ordre)
            .map((a) => (
              <ActiviteRow key={a.id} activite={a} />
            ))}
          {addingAct ? (
            <AddActiviteRow
              workstreamTemplateId={workstream.id}
              nextOrdre={
                activites.length > 0
                  ? Math.max(...activites.map((a) => a.ordre)) + 1
                  : 1
              }
              onDone={() => setAddingAct(false)}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setAddingAct(true)}
            >
              <Plus className="size-3.5" />
              Activité
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Activité row ──────────────────────────────────────

function ActiviteRow({ activite }: { activite: ActiviteTemplate }) {
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(activite.nom);
  const [ordre, setOrdre] = useState(activite.ordre);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!nom.trim()) return;
    setLoading(true);
    try {
      await updateActiviteTemplate(activite.id, { nom: nom.trim(), ordre });
      setEditing(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteActiviteTemplate(activite.id);
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-2 py-1.5">
        <Input
          type="number"
          value={ordre}
          onChange={(e) => setOrdre(Number(e.target.value))}
          className="h-7 w-14"
          min={1}
        />
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="h-7 min-w-[10rem] flex-1"
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={handleSave}
          disabled={loading || !nom.trim()}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => {
            setNom(activite.nom);
            setOrdre(activite.ordre);
            setEditing(false);
          }}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
      <span className="w-6 text-xs text-muted-foreground">{activite.ordre}</span>
      <span className="flex-1 text-sm">{activite.nom}</span>
      <Badge variant="outline" className="text-[10px] font-normal">
        Activité
      </Badge>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

// ── Add rows ──────────────────────────────────────────

function AddJalonRow({
  phase,
  nextOrdre,
  onDone,
}: {
  phase: string;
  nextOrdre: number;
  onDone: () => void;
}) {
  const [nom, setNom] = useState("");
  const [offsetPct, setOffsetPct] = useState(0);
  const [ordre, setOrdre] = useState(nextOrdre);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!nom.trim()) return;
    setLoading(true);
    try {
      await createJalonTemplate({
        phase,
        nom: nom.trim(),
        ordre,
        offsetPct,
      });
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-b bg-muted/30">
      <td className="px-2 py-1.5" />
      <td className="px-3 py-1.5">
        <Input
          type="number"
          value={ordre}
          onChange={(e) => setOrdre(Number(e.target.value))}
          className="h-8 w-12"
          min={1}
        />
      </td>
      <td className="px-3 py-1.5">
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="h-8"
          placeholder="Nom du jalon..."
          autoFocus
        />
      </td>
      <td className="px-3 py-1.5">
        <Input
          type="number"
          value={offsetPct}
          onChange={(e) => setOffsetPct(Number(e.target.value))}
          className="h-8 w-20"
          min={0}
          max={100}
        />
      </td>
      <td className="px-3 py-1.5" />
      <td className="px-3 py-1.5 text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={handleCreate}
            disabled={loading || !nom.trim()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={onDone}>
            <X className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AddWorkstreamRow({
  jalonTemplateId,
  nextOrdre,
  onDone,
}: {
  jalonTemplateId: string;
  nextOrdre: number;
  onDone: () => void;
}) {
  const [nom, setNom] = useState("");
  const [ordre, setOrdre] = useState(nextOrdre);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!nom.trim()) return;
    setLoading(true);
    try {
      await createWorkstreamTemplate({
        jalonTemplateId,
        nom: nom.trim(),
        ordre,
      });
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2">
      <Input
        type="number"
        value={ordre}
        onChange={(e) => setOrdre(Number(e.target.value))}
        className="h-8 w-14"
        min={1}
      />
      <Input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        className="h-8 min-w-[12rem] flex-1"
        placeholder="Nom du workstream..."
        autoFocus
      />
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={handleCreate}
        disabled={loading || !nom.trim()}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
      </Button>
      <Button size="icon" variant="ghost" className="size-7" onClick={onDone}>
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function AddActiviteRow({
  workstreamTemplateId,
  nextOrdre,
  onDone,
}: {
  workstreamTemplateId: string;
  nextOrdre: number;
  onDone: () => void;
}) {
  const [nom, setNom] = useState("");
  const [ordre, setOrdre] = useState(nextOrdre);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!nom.trim()) return;
    setLoading(true);
    try {
      await createActiviteTemplate({
        workstreamTemplateId,
        nom: nom.trim(),
        ordre,
      });
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-background px-2 py-1.5">
      <Input
        type="number"
        value={ordre}
        onChange={(e) => setOrdre(Number(e.target.value))}
        className="h-7 w-14"
        min={1}
      />
      <Input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        className="h-7 min-w-[10rem] flex-1"
        placeholder="Nom de l'activité..."
        autoFocus
      />
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        onClick={handleCreate}
        disabled={loading || !nom.trim()}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}
      </Button>
      <Button size="icon" variant="ghost" className="size-7" onClick={onDone}>
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
