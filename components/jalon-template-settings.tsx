"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PHASES, PHASE_COLORS } from "@/lib/jalon-labels";
import {
  createJalonTemplate,
  updateJalonTemplate,
  deleteJalonTemplate,
} from "@/app/(app)/actions";
import { Pencil, Trash2, Plus, Loader2, Check, X } from "lucide-react";

interface JalonTemplate {
  id: string;
  phase: string;
  nom: string;
  ordre: number;
  offsetPct: number;
}

interface Props {
  templates: JalonTemplate[];
}

export function JalonTemplateSettings({ templates }: Props) {
  return (
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
              <span className="ml-1 text-xs text-muted-foreground">({count})</span>
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
  );
}

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
              <th className="px-3 py-2 text-left font-medium w-12">#</th>
              <th className="px-3 py-2 text-left font-medium">Nom du jalon</th>
              <th className="px-3 py-2 text-left font-medium w-28">Position (%)</th>
              <th className="px-3 py-2 text-right font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <TemplateRow key={t.id} template={t} />
            ))}
            {adding && (
              <AddRow
                phase={phase}
                nextOrdre={templates.length > 0 ? Math.max(...templates.map((t) => t.ordre)) + 1 : 1}
                onDone={() => setAdding(false)}
              />
            )}
            {templates.length === 0 && !adding && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
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

function TemplateRow({ template }: { template: JalonTemplate }) {
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(template.nom);
  const [offsetPct, setOffsetPct] = useState(template.offsetPct);
  const [ordre, setOrdre] = useState(template.ordre);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        <td className="px-3 py-1.5 text-right">
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" className="size-7" onClick={handleSave} disabled={loading || !nom.trim()}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={handleCancel}>
              <X className="size-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 text-muted-foreground">{template.ordre}</td>
      <td className="px-3 py-2">{template.nom}</td>
      <td className="px-3 py-2 text-muted-foreground">{template.offsetPct}%</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AddRow({
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
      await createJalonTemplate({ phase, nom: nom.trim(), ordre, offsetPct });
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className="border-b bg-muted/30">
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
      <td className="px-3 py-1.5 text-right">
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={handleCreate} disabled={loading || !nom.trim()}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={onDone}>
            <X className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
