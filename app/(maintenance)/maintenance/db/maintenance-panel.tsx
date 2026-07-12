"use client";

import { useRef, useState, useTransition } from "react";
import {
  Download,
  FileJson,
  FileCode2,
  Files,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldAlert,
  Database,
  ListOrdered,
  Server,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  RestoreMode,
  VerifyResult,
  TransfoDump,
  TableDump,
} from "@/lib/db-maintenance";
import {
  exportDbDumpAction,
  exportDbSqlAction,
  exportDbCsvZipAction,
  verifyDbImportAction,
  restoreStepDropSchemaAction,
  restoreStepMigrateAction,
  restoreStepTruncateAction,
  restoreStepImportTableAction,
  restoreStepSqlBatchAction,
} from "./actions";

type ProgressLogLevel = "info" | "ok" | "error" | "step";

type ProgressLog = {
  id: number;
  level: ProgressLogLevel;
  text: string;
  at: string;
};

type TableStat = { name: string; approxRows: number };

type PostActionGuide = {
  title: string;
  summary: string;
  steps: string[];
  severity: "ok" | "warn" | "info";
};

function guideAfterExport(kind: "dump" | "sql" | "csv", fileName: string): PostActionGuide {
  if (kind === "dump") {
    return {
      title: "Export dump JSON terminé",
      summary: `Fichier téléchargé : ${fileName}`,
      severity: "ok",
      steps: [
        "Conservez ce fichier (.thdump.json) dans un emplacement sûr (sauvegarde hors serveur).",
        "Aucun redémarrage du serveur Next.js n’est nécessaire après un export.",
        "Aucune commande Prisma n’est requise après un export.",
        "Pour restaurer plus tard : utilisez Import → mode TRUNCATE (même schéma) ou DROP (reconstruction complète), puis chargez ce dump.",
      ],
    };
  }
  if (kind === "sql") {
    return {
      title: "Export SQL terminé",
      summary: `Fichier téléchargé : ${fileName}`,
      severity: "ok",
      steps: [
        "Ce fichier contient des INSERT data-only (pas de CREATE TABLE).",
        "Idéal pour un rechargement en mode TRUNCATE sur une base déjà migrée.",
        "Aucun redémarrage serveur ni commande Prisma après l’export.",
        "En mode DROP à la restauration, TransfoHub recréera d’abord le schéma via prisma migrate deploy, puis exécutera ce SQL.",
      ],
    };
  }
  return {
    title: "Export CSV (ZIP) terminé",
    summary: `Archive téléchargée : ${fileName}`,
    severity: "ok",
    steps: [
      "L’archive contient un CSV par table + un _manifest.json (structure).",
      "Séparateur de champs : pipe « | » (pas la virgule) — les virgules dans le texte sont conservées.",
      "Usage principal : audit, Excel, migration manuelle — pas de rechargement automatique depuis ce ZIP dans la console.",
      "Pour une restauration complète, préférez le dump .thdump.json ou le SQL.",
      "Aucun redémarrage serveur ni action Prisma après l’export.",
    ],
  };
}

function guideAfterImport(
  mode: RestoreMode,
  kind: string,
  resultMessage: string
): PostActionGuide {
  if (mode === "truncate") {
    return {
      title: "Import TRUNCATE terminé — suite à faire",
      summary: resultMessage,
      severity: "warn",
      steps: [
        "Les tables ont été vidées puis rechargées ; le schéma (colonnes / contraintes) n’a pas changé.",
        "Redémarrez le serveur d’application (arrêtez npm run dev / process Node, puis relancez) pour vider le cache Prisma / connexions pool et éviter des lectures stale.",
        "Prisma : en mode TRUNCATE, ne lancez PAS migrate reset. Un npm run db:generate n’est utile que si vous aviez modifié le schema.prisma localement (cas rare ici).",
        "Déconnectez-vous du compte system, puis reconnectez-vous avec un utilisateur applicatif (ex. admin) pour vérifier login, rôles et données métier.",
        "Cliquez « Actualiser » ci-dessus pour contrôler les effectifs par table, ou rechargez la page maintenance.",
        "Si l’app affiche des erreurs « table does not exist » ou champs inconnus : vérifiez que le dump correspond à la version du schéma (migrations à jour sur ce déploiement).",
      ],
    };
  }
  return {
    title: "Import DROP terminé — suite obligatoire",
    summary: resultMessage,
    severity: "warn",
    steps: [
      "Le schéma public a été détruit, recréé via prisma migrate deploy, les seeds de migration (ex. AppRole) ont été vidés, puis les données du dump ont été rechargées.",
      "Redémarrez immédiatement le serveur Next.js (dev ou prod) : les anciennes connexions Prisma pointent souvent vers un schéma invalidé.",
      "Sur la machine d’app : npm run db:generate si le client Prisma n’a pas été régénéré après un changement de schéma, puis redémarrage.",
      "Ne relancez pas prisma migrate reset (cela re-seed / re-wipe). migrate deploy a déjà été exécuté pendant l’import DROP.",
      "Déconnectez le compte system, reconnectez-vous en admin applicatif et testez au minimum : login, tableau de bord, une page chantiers / RAID / ressources.",
      "Si migrate deploy a échoué dans les détails techniques, la base peut être partielle : restaurez un dump sain en mode DROP une fois le problème de migrations corrigé.",
      kind === "sql"
        ? "Fichier SQL : si le script contenait du DDL custom en plus des migrations, vérifiez la cohérence avec prisma/schema.prisma."
        : "Dump JSON : les données sont rechargées table par table ; les FK ont été temporairement assouplies pendant l’insert.",
    ],
  };
}

function downloadText(fileName: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64(fileName: string, b64: string, mime: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function MaintenancePanel({
  initialStats,
}: {
  initialStats: { schema: string; tables: TableStat[] };
}) {
  const [stats, setStats] = useState(initialStats);
  const [mode, setMode] = useState<RestoreMode>("truncate");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "error" | "info";
    text: string;
  } | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [postGuide, setPostGuide] = useState<PostActionGuide | null>(null);
  const [importRunning, setImportRunning] = useState(false);
  const [importFinished, setImportFinished] = useState(false);
  const [importFailed, setImportFailed] = useState(false);
  const [progressLogs, setProgressLogs] = useState<ProgressLog[]>([]);
  const [progressPct, setProgressPct] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalRows = stats.tables.reduce((s, t) => s + t.approxRows, 0);

  function pushLog(level: ProgressLogLevel, text: string) {
    logIdRef.current += 1;
    const entry: ProgressLog = {
      id: logIdRef.current,
      level,
      text,
      at: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    setProgressLogs((prev) => [...prev, entry]);
    // scroll after paint
    requestAnimationFrame(() => {
      logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  function refreshStats() {
    // Soft refresh via full page
    window.location.reload();
  }

  function runExport(
    kind: "dump" | "sql" | "csv"
  ) {
    setMessage(null);
    setPostGuide(null);
    startTransition(async () => {
      try {
        if (kind === "dump") {
          const r = await exportDbDumpAction();
          downloadText(r.fileName, r.content, r.mime);
          setMessage({ type: "ok", text: `Dump téléchargé : ${r.fileName}` });
          setPostGuide(guideAfterExport("dump", r.fileName));
        } else if (kind === "sql") {
          const r = await exportDbSqlAction();
          downloadText(r.fileName, r.content, r.mime);
          setMessage({ type: "ok", text: `SQL téléchargé : ${r.fileName}` });
          setPostGuide(guideAfterExport("sql", r.fileName));
        } else {
          const r = await exportDbCsvZipAction();
          downloadBase64(r.fileName, r.contentBase64, r.mime);
          setMessage({
            type: "ok",
            text: `Archive CSV téléchargée : ${r.fileName}`,
          });
          setPostGuide(guideAfterExport("csv", r.fileName));
        }
      } catch (e) {
        setMessage({
          type: "error",
          text: e instanceof Error ? e.message : "Échec de l'export",
        });
      }
    });
  }

  function onFile(file: File | null) {
    if (!file) return;
    setMessage(null);
    setPostGuide(null);
    setVerify(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setFileContent(text);
      startTransition(async () => {
        try {
          const result = await verifyDbImportAction(file.name, text, mode);
          setVerify(result);
          setMessage({
            type: result.ok ? "info" : "error",
            text: result.ok
              ? `Fichier validé : ${result.summary}`
              : `Validation échouée : ${result.errors[0] ?? "erreurs"}`,
          });
        } catch (e) {
          setMessage({
            type: "error",
            text: e instanceof Error ? e.message : "Échec de la vérification",
          });
        }
      });
    };
    reader.readAsText(file, "UTF-8");
  }

  function reverifyWithMode(next: RestoreMode) {
    setMode(next);
    if (!fileContent || !fileName) return;
    setVerify(null);
    startTransition(async () => {
      const result = await verifyDbImportAction(fileName, fileContent, next);
      setVerify(result);
    });
  }

  async function runImport() {
    if (!verify?.ok || !fileContent || importRunning) return;
    const importKind = verify.kind;
    const importMode = mode;

    setImportRunning(true);
    setImportFinished(false);
    setImportFailed(false);
    setProgressLogs([]);
    setProgressPct(0);
    setProgressLabel("Démarrage…");
    setMessage(null);
    setPostGuide(null);

    const fail = (err: string) => {
      pushLog("error", `✗ ${err}`);
      setImportFailed(true);
      setImportRunning(false);
      setProgressLabel("Échec");
      setMessage({ type: "error", text: err });
      setPostGuide(null);
    };

    try {
      pushLog(
        "info",
        `Démarrage import « ${fileName} » — mode ${importMode.toUpperCase()} (${importKind}).`
      );

      // ── Prepare phase ─────────────────────────────
      if (importMode === "drop") {
        setProgressLabel("Suppression du schéma…");
        setProgressPct(5);
        pushLog("step", "▶ Suppression du schéma public (DROP SCHEMA CASCADE)…");
        const drop = await restoreStepDropSchemaAction();
        if (!drop.ok) return fail(drop.error || "Échec DROP SCHEMA");
        pushLog("ok", "✓ Schéma supprimé et recréé (vide).");

        setProgressLabel("Création des tables (migrations)…");
        setProgressPct(15);
        pushLog(
          "step",
          "▶ Application des migrations Prisma — création des tables…"
        );
        const mig = await restoreStepMigrateAction();
        if (!mig.ok) return fail(mig.error || "Échec migrations");
        pushLog("ok", "✓ Tables créées (prisma migrate deploy).");
        if (mig.output) {
          pushLog("info", mig.output.replace(/\s+/g, " ").slice(0, 300));
        }

        setProgressLabel("Vidage des seeds de migration…");
        setProgressPct(25);
        pushLog(
          "step",
          "▶ Vidage des tables applicatives (seeds migrations, ex. AppRole)…"
        );
        const trunc = await restoreStepTruncateAction();
        if (!trunc.ok) return fail(trunc.error || "Échec TRUNCATE");
        pushLog(
          "ok",
          `✓ ${trunc.tableCount ?? "?"} table(s) vidée(s) — prêt pour le chargement.`
        );
      } else {
        setProgressLabel("Vidage des tables (TRUNCATE)…");
        setProgressPct(15);
        pushLog(
          "step",
          "▶ TRUNCATE de toutes les tables applicatives (structure conservée)…"
        );
        const trunc = await restoreStepTruncateAction();
        if (!trunc.ok) return fail(trunc.error || "Échec TRUNCATE");
        pushLog(
          "ok",
          `✓ ${trunc.tableCount ?? "?"} table(s) vidée(s).`
        );
      }

      // ── Load phase ────────────────────────────────
      if (importKind === "dump") {
        let dump: TransfoDump;
        try {
          dump = JSON.parse(fileContent) as TransfoDump;
        } catch {
          return fail("Dump JSON illisible.");
        }
        const tables = dump.tables || [];
        const total = tables.length || 1;
        let totalInserted = 0;

        pushLog(
          "info",
          `Chargement de ${tables.length} table(s) depuis le dump…`
        );

        for (let i = 0; i < tables.length; i++) {
          const table: TableDump = tables[i];
          const rows = table.rowCount ?? table.rows?.length ?? 0;
          const base = 30;
          const span = 65;
          setProgressPct(Math.round(base + ((i + 0.5) / total) * span));
          setProgressLabel(`Chargement « ${table.name} »…`);

          if (!rows) {
            pushLog(
              "info",
              `· Table « ${table.name} » — vide (0 ligne), ignorée.`
            );
            continue;
          }

          pushLog(
            "step",
            `▶ Chargement des données — table « ${table.name} » (${rows} ligne${rows > 1 ? "s" : ""})…`
          );
          const res = await restoreStepImportTableAction(table);
          if (!res.ok) {
            return fail(
              res.error || `Échec chargement table « ${table.name} »`
            );
          }
          totalInserted += res.inserted ?? 0;
          pushLog(
            "ok",
            `✓ Table « ${table.name} » — ${res.inserted ?? 0} ligne(s) insérée(s).`
          );
          setProgressPct(Math.round(base + ((i + 1) / total) * span));
        }

        setProgressPct(100);
        setProgressLabel("Terminé");
        pushLog(
          "ok",
          `✔ Import dump terminé — ${totalInserted} ligne(s) au total.`
        );
        const summary = `Import dump terminé (${importMode}) — ${totalInserted} ligne(s).`;
        setMessage({ type: "ok", text: summary });
        setPostGuide(guideAfterImport(importMode, importKind, summary));
      } else if (importKind === "sql") {
        setProgressLabel("Exécution du script SQL…");
        setProgressPct(35);
        pushLog("step", "▶ Exécution du script SQL par lots…");

        let offset = 0;
        let total = 0;
        let done = false;
        let batch = 0;
        while (!done) {
          batch++;
          const res = await restoreStepSqlBatchAction(fileContent, offset, 40);
          if (!res.ok) return fail(res.error || "Échec SQL");
          total = res.total ?? 0;
          const executed = res.executed ?? 0;
          offset += executed;
          done = !!res.done || executed === 0;
          const pct =
            total > 0
              ? Math.min(99, Math.round(35 + (offset / total) * 60))
              : 50;
          setProgressPct(pct);
          setProgressLabel(`SQL ${offset}/${total || "?"}…`);
          pushLog(
            "step",
            `▶ Lot SQL #${batch} — instructions ${Math.max(1, offset - executed + 1)}–${offset} / ${total}.`
          );
          if (executed > 0) {
            pushLog("ok", `✓ ${executed} instruction(s) exécutée(s).`);
          }
        }

        setProgressPct(100);
        setProgressLabel("Terminé");
        pushLog("ok", `✔ Import SQL terminé — ${total} instruction(s).`);
        const summary = `Import SQL terminé (${importMode}) — ${total} instruction(s).`;
        setMessage({ type: "ok", text: summary });
        setPostGuide(guideAfterImport(importMode, importKind, summary));
      } else {
        return fail("Type de fichier non supporté pour l'import.");
      }

      setVerify(null);
      setFileContent("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      setImportFinished(true);
      setImportRunning(false);
      setConfirmText("");
    } catch (e) {
      fail(e instanceof Error ? e.message : "Échec de l'import");
    }
  }

  const confirmWord = mode === "drop" ? "DROP" : "TRUNCATE";

  return (
    <div className="space-y-6">
      {/* Big warning */}
      <div className="rounded-2xl border-2 border-red-600/50 bg-red-600/10 p-5 shadow-sm">
        <div className="flex gap-4">
          <ShieldAlert className="size-12 shrink-0 text-red-600" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-red-700 dark:text-red-400">
              DB Maintenance — page critique
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90">
              Vous êtes connecté avec le compte technique{" "}
              <strong>system</strong> (fichier{" "}
              <code className="rounded bg-muted px-1 text-xs">
                config/maintenance-user.json
              </code>
              , hors base de données). Cette console permet d&apos;exporterer
              l&apos;intégralité de PostgreSQL et de{" "}
              <strong>reconstruire la base</strong> (purge + rechargement). Une
              erreur d&apos;import peut rendre TransfoHub inutilisable jusqu&apos;à
              restauration.
            </p>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              <li>
                Exportez toujours un dump récent avant toute opération
                destructive.
              </li>
              <li>
                Mode <strong>TRUNCATE</strong> : vide les tables, conserve la
                structure — le fichier ne doit pas contenir de DDL.
              </li>
              <li>
                Mode <strong>DROP</strong> : détruit le schéma, réapplique les
                migrations Prisma, puis charge les données.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Database className="size-4 text-[#00BDBB]" />
                État actuel
              </CardTitle>
              <CardDescription>
                Schéma <code className="text-xs">{stats.schema}</code> —{" "}
                {stats.tables.length} table(s), {totalRows} ligne(s)
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={refreshStats}
            >
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-48 overflow-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted/80">
                <tr>
                  <th className="px-3 py-2 font-semibold">Table</th>
                  <th className="px-3 py-2 font-semibold text-right">Lignes</th>
                </tr>
              </thead>
              <tbody>
                {stats.tables.map((t) => (
                  <tr key={t.name} className="border-t">
                    <td className="px-3 py-1.5 font-mono">{t.name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {t.approxRows}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Reference: what to do after each action */}
      <Card className="border-[#00BDBB]/30 bg-[#00BDBB]/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-primary">
            <ListOrdered className="size-4 text-[#00BDBB]" />
            Que faire après chaque action ?
          </CardTitle>
          <CardDescription>
            Récapitulatif Prisma / serveur pour chaque scénario. Un guide
            détaillé s&apos;affiche aussi dynamiquement après chaque export ou
            import réussi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="font-semibold text-primary">
              Export (dump / SQL / CSV)
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>
                Stockez le fichier hors du serveur (sauvegarde). Aucune action
                Prisma.
              </li>
              <li>
                <strong className="text-foreground">Pas de redémarrage</strong>{" "}
                du serveur Next.js requis.
              </li>
              <li>
                CSV = consultation / Excel (séparateur{" "}
                <code className="text-[11px]">|</code>) ; pour restaurer,
                préférez dump JSON ou SQL.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="font-semibold text-primary">
              Import mode TRUNCATE + dump ou SQL data-only
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>Tables vidées puis rechargées — schéma inchangé.</li>
              <li>
                <strong className="text-foreground">
                  Redémarrez le serveur d&apos;application
                </strong>{" "}
                (npm run dev / process Node) pour rafraîchir le pool Prisma.
              </li>
              <li>
                Ne pas lancer <code className="text-[11px]">migrate reset</code>{" "}
                ni <code className="text-[11px]">db:seed</code> (écraserait le
                rechargement).
              </li>
              <li>
                Reconnectez-vous avec un compte applicatif (admin) pour valider
                les données.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-red-600/25 bg-card p-3">
            <p className="font-semibold text-red-700 dark:text-red-400">
              Import mode DROP + dump ou SQL
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>
                Schéma détruit →{" "}
                <code className="text-[11px]">prisma migrate deploy</code> →
                TRUNCATE des seeds → données rechargées.
              </li>
              <li>
                <strong className="text-foreground">
                  Redémarrage serveur obligatoire
                </strong>{" "}
                juste après (connexions Prisma invalidées).
              </li>
              <li>
                Si besoin :{" "}
                <code className="text-[11px]">npm run db:generate</code> puis
                redémarrage (client Prisma local).
              </li>
              <li>
                Ne pas relancer migrate reset. Tester login admin + pages
                métier.
              </li>
            </ul>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Server className="mt-0.5 size-3.5 shrink-0 text-[#00BDBB]" />
            <span>
              En production : redémarrer le process Node / conteneur / service
              Windows qui héberge TransfoHub. En dev : arrêter et relancer{" "}
              <code className="rounded bg-background px-1">npm run dev</code>.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-primary">Export</CardTitle>
          <CardDescription>
            Téléchargez une copie complète des données applicatives (toutes les
            tables hors{" "}
            <code className="text-[11px]">_prisma_migrations</code>). Après
            l&apos;export : conserver le fichier ; pas de Prisma ni de
            redémarrage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={pending}
            onClick={() => runExport("dump")}
          >
            <FileJson className="size-4 text-[#00BDBB]" />
            Dump JSON (.thdump.json)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={pending}
            onClick={() => runExport("sql")}
          >
            <FileCode2 className="size-4 text-[#00BDBB]" />
            Fichier SQL (INSERT)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={pending}
            onClick={() => runExport("csv")}
          >
            <Files className="size-4 text-[#00BDBB]" />
            CSV toutes tables (.zip · |)
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card className="border-red-600/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="size-5" />
            Import / reconstruction
          </CardTitle>
          <CardDescription>
            Chargez un dump TransfoHub ou un SQL. Le fichier est d&apos;abord
            analysé ; l&apos;import ne s&apos;exécute qu&apos;après confirmation
            explicite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mode de reconstruction
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => reverifyWithMode("truncate")}
                className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                  mode === "truncate"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-[#00BDBB]/50"
                }`}
              >
                <span className="font-semibold">TRUNCATE only</span>
                <span
                  className={`mt-0.5 block text-xs ${
                    mode === "truncate"
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }`}
                >
                  Vide les tables, conserve le schéma. SQL sans DDL uniquement.
                </span>
              </button>
              <button
                type="button"
                onClick={() => reverifyWithMode("drop")}
                className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                  mode === "drop"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-border bg-card hover:border-red-500/50"
                }`}
              >
                <span className="font-semibold">DROP tables / schéma</span>
                <span
                  className={`mt-0.5 block text-xs ${
                    mode === "drop" ? "text-white/85" : "text-muted-foreground"
                  }`}
                >
                  DROP SCHEMA CASCADE + migrations Prisma + rechargement.
                </span>
              </button>
            </div>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.thdump.json,.sql,application/json,text/sql,text/plain"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4 text-[#00BDBB]" />
              Charger un dump ou un SQL…
            </Button>
            {fileName && (
              <span className="ml-3 text-xs text-muted-foreground">
                Fichier : <strong>{fileName}</strong>
              </span>
            )}
          </div>

          {verify && (
            <div
              className={`space-y-2 rounded-xl border p-4 ${
                verify.ok
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-destructive/30 bg-destructive/5"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {verify.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <span className="text-sm font-semibold">{verify.summary}</span>
                <Badge variant="outline">{verify.kind}</Badge>
                <Badge
                  variant={mode === "drop" ? "destructive" : "secondary"}
                >
                  {mode}
                </Badge>
              </div>
              {verify.warnings.map((w, i) => (
                <p key={`w-${i}`} className="text-xs text-amber-700 dark:text-amber-300">
                  ⚠ {w}
                </p>
              ))}
              {verify.errors.map((e, i) => (
                <p key={`e-${i}`} className="text-xs text-destructive">
                  ✕ {e}
                </p>
              ))}
              {verify.ok && (
                <>
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Info className="size-3.5" />
                      Après cet import ({mode})
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-900/90 dark:text-amber-100/90">
                      {mode === "truncate" ? (
                        <>
                          <li>
                            Redémarrer le serveur Next.js (pool Prisma).
                          </li>
                          <li>
                            Ne pas lancer migrate reset / db:seed.
                          </li>
                          <li>
                            Se reconnecter en utilisateur applicatif pour
                            vérifier.
                          </li>
                        </>
                      ) : (
                        <>
                          <li>
                            Redémarrage serveur <strong>obligatoire</strong>{" "}
                            après DROP.
                          </li>
                          <li>
                            migrate deploy est déjà lancé pendant l&apos;import
                            ; db:generate si client Prisma local obsolète.
                          </li>
                          <li>
                            Tester login admin + pages métier.
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    className="mt-2 gap-2"
                    disabled={pending}
                    onClick={() => {
                      setConfirmText("");
                      setImportFinished(false);
                      setImportFailed(false);
                      setImportRunning(false);
                      setProgressLogs([]);
                      setProgressPct(0);
                      setProgressLabel("");
                      setConfirmOpen(true);
                    }}
                  >
                    <AlertTriangle className="size-4" />
                    Approuver et exécuter l&apos;import
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {message && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
            message.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : message.type === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-[#00BDBB]/30 bg-[#00BDBB]/10"
          }`}
        >
          {message.type === "ok" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : message.type === "error" ? (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Download className="mt-0.5 size-4 shrink-0 text-[#00BDBB]" />
          )}
          <span className="break-words">{message.text}</span>
        </div>
      )}

      {postGuide && (
        <div
          className={`rounded-2xl border-2 p-5 shadow-sm ${
            postGuide.severity === "warn"
              ? "border-amber-500/50 bg-amber-500/10"
              : postGuide.severity === "ok"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-[#00BDBB]/40 bg-[#00BDBB]/10"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ListOrdered
                className={`mt-0.5 size-6 shrink-0 ${
                  postGuide.severity === "warn"
                    ? "text-amber-600"
                    : "text-[#00BDBB]"
                }`}
              />
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground">
                  {postGuide.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground break-words">
                  {postGuide.summary}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPostGuide(null)}
            >
              Masquer
            </Button>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-foreground/90">
            {postGuide.steps.map((step, i) => (
              <li key={i} className="leading-relaxed pl-1">
                {step}
              </li>
            ))}
          </ol>
          {postGuide.severity === "warn" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={refreshStats}
              >
                Actualiser les stats tables
              </Button>
            </div>
          )}
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-[#00BDBB]" />
          Opération en cours — ne fermez pas cette page…
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          // Prevent closing while import is running
          if (importRunning) return;
          setConfirmOpen(open);
          if (!open) {
            setConfirmText("");
            if (!importFinished) {
              setProgressLogs([]);
              setProgressPct(0);
              setProgressLabel("");
              setImportFailed(false);
            }
          }
        }}
      >
        <DialogContent
          className="sm:max-w-xl"
          showCloseButton={!importRunning}
        >
          <DialogHeader>
            <DialogTitle
              className={
                importRunning
                  ? "text-primary"
                  : importFinished
                    ? "text-emerald-700 dark:text-emerald-400"
                    : importFailed
                      ? "text-destructive"
                      : "text-destructive"
              }
            >
              {importRunning
                ? "Import en cours…"
                : importFinished
                  ? "Import terminé"
                  : importFailed
                    ? "Import interrompu"
                    : "Confirmation définitive"}
            </DialogTitle>
            <DialogDescription className="text-left space-y-2">
              {!importRunning && !importFinished && !importFailed && (
                <>
                  <span className="block">
                    Vous allez{" "}
                    <strong>
                      {mode === "drop"
                        ? "DÉTRUIRE le schéma et reconstruire la base"
                        : "VIDER toutes les tables"}
                    </strong>{" "}
                    puis charger <strong>{fileName}</strong>. Tapez{" "}
                    <code className="rounded bg-muted px-1 font-bold">
                      {confirmWord}
                    </code>{" "}
                    pour confirmer.
                  </span>
                  <span className="block text-amber-700 dark:text-amber-300">
                    L&apos;opération peut prendre plusieurs minutes. Un journal
                    d&apos;avancement s&apos;affichera ici (schéma, migrations,
                    table par table).
                  </span>
                </>
              )}
              {(importRunning || importFinished || importFailed) && (
                <span className="block text-foreground">
                  {progressLabel || "…"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {!importRunning && !importFinished && !importFailed && (
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmWord}
              autoComplete="off"
              disabled={importRunning}
            />
          )}

          {(importRunning ||
            importFinished ||
            importFailed ||
            progressLogs.length > 0) && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${
                    importFailed
                      ? "bg-destructive"
                      : importFinished
                        ? "bg-emerald-500"
                        : "bg-[#00BDBB]"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {progressPct}% — {progressLabel}
              </p>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-100 shadow-inner">
                {progressLogs.length === 0 && (
                  <p className="text-zinc-500">En attente du démarrage…</p>
                )}
                {progressLogs.map((log) => (
                  <div
                    key={log.id}
                    className={
                      log.level === "error"
                        ? "text-red-400"
                        : log.level === "ok"
                          ? "text-emerald-400"
                          : log.level === "step"
                            ? "text-sky-300"
                            : "text-zinc-300"
                    }
                  >
                    <span className="mr-2 text-zinc-500">{log.at}</span>
                    {log.text}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
              {importRunning && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-[#00BDBB]" />
                  Ne fermez pas cette fenêtre tant que l&apos;import n&apos;est
                  pas terminé.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {!importRunning && !importFinished && !importFailed && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setConfirmOpen(false);
                    setConfirmText("");
                    setProgressLogs([]);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={confirmText !== confirmWord}
                  onClick={() => {
                    void runImport();
                  }}
                >
                  Exécuter
                </Button>
              </>
            )}
            {importRunning && (
              <Button type="button" variant="secondary" disabled>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Travail en cours…
              </Button>
            )}
            {importFailed && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  setProgressLogs([]);
                  setImportFailed(false);
                  setProgressPct(0);
                }}
              >
                Fermer
              </Button>
            )}
            {importFinished && (
              <Button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  setImportFinished(false);
                  setProgressLogs([]);
                  setProgressPct(0);
                }}
              >
                Fermer et voir la suite
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
