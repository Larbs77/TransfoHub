"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listRelanceRunsAdmin,
  previewRelancesAdmin,
  sendRelanceTestAdmin,
  sendRelancesNowAdmin,
} from "./actions";
import type {
  RelancePreview,
  RelanceRunView,
} from "@/lib/mail-relances";

type ChantierOption = { id: string; code: string; nom: string };

const TRIGGER_LABEL: Record<string, string> = {
  planifie: "Planifié",
  manuel: "Manuel",
  test: "Test",
};

const STATUS_LABEL: Record<string, string> = {
  envoye: "Envoyé",
  partiel: "Partiel",
  echec: "Échec",
  ignore: "Ignoré",
  encours: "En cours",
};

function statusClass(status: string): string {
  if (status === "envoye") return "text-emerald-700 bg-emerald-50";
  if (status === "partiel") return "text-amber-700 bg-amber-50";
  if (status === "echec") return "text-destructive bg-destructive/10";
  if (status === "encours") return "text-sky-700 bg-sky-50";
  return "text-muted-foreground bg-muted";
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Casablanca",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function MailRelancePanel({
  configId,
  savedEnabled,
  draftEnabled,
  chantiers,
  initialRuns,
  initialScheduleLabel,
}: {
  configId?: string;
  savedEnabled: boolean;
  draftEnabled: boolean;
  chantiers: ChantierOption[];
  initialRuns: RelanceRunView[];
  initialScheduleLabel: string;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [scheduleLabel, setScheduleLabel] = useState(initialScheduleLabel);
  const [preview, setPreview] = useState<RelancePreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [chantierId, setChantierId] = useState(chantiers[0]?.id ?? "");
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState<
    null | "preview" | "send" | "test" | "refresh"
  >(null);

  async function refreshRuns() {
    const data = await listRelanceRunsAdmin();
    setRuns(data.runs);
    setScheduleLabel(data.window.label);
  }

  async function handlePreview() {
    setPreviewMsg(null);
    setSendMsg(null);
    setConfirming(false);
    setBusy("preview");
    try {
      const data = await previewRelancesAdmin();
      setPreview(data);
      setScheduleLabel(data.label);
      setPreviewMsg(
        data.chantiers.length === 0
          ? "Aucun chantier n'a d'action échue ou à échoir cette semaine."
          : `${data.chantiers.length} chantier(s) seraient destinataires d'une relance.`
      );
    } catch (error: unknown) {
      setPreviewMsg(
        error instanceof Error ? error.message : "Aperçu impossible."
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (!confirming) {
      setSendMsg(null);
      setBusy("preview");
      try {
        const data = await previewRelancesAdmin();
        setPreview(data);
        setScheduleLabel(data.label);
        if (data.chantiers.length === 0) {
          setPreviewMsg(
            "Aucun chantier n'a d'action échue ou à échoir cette semaine."
          );
          setConfirming(false);
          return;
        }
        setPreviewMsg(null);
        setConfirming(true);
      } catch (error: unknown) {
        setSendMsg({
          type: "err",
          text: error instanceof Error ? error.message : "Aperçu impossible.",
        });
      } finally {
        setBusy(null);
      }
      return;
    }

    setBusy("send");
    setSendMsg(null);
    try {
      const result = await sendRelancesNowAdmin();
      if (result.ok) {
        setSendMsg({ type: "ok", text: result.message });
        setConfirming(false);
        if (result.run) {
          setRuns((current) => [
            result.run as RelanceRunView,
            ...current.filter((run) => run.id !== result.run?.id),
          ]);
        } else {
          await refreshRuns();
        }
      } else {
        setSendMsg({ type: "err", text: result.error });
      }
    } catch (error: unknown) {
      setSendMsg({
        type: "err",
        text:
          error instanceof Error
            ? error.message
            : "L'envoi n'a pas abouti. Actualisez le suivi : les chantiers déjà partis y figurent.",
      });
      await refreshRuns().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    setTestMsg(null);
    setBusy("test");
    try {
      const result = await sendRelanceTestAdmin({
        chantierId,
        to: testTo,
      });
      if (result.ok) {
        setTestMsg({ type: "ok", text: result.message });
      } else {
        setTestMsg({ type: "err", text: result.error });
      }
      if (result.run) {
        setRuns((current) => [
          result.run as RelanceRunView,
          ...current.filter((run) => run.id !== result.run?.id),
        ]);
      } else {
        await refreshRuns();
      }
    } catch (error: unknown) {
      setTestMsg({
        type: "err",
        text: error instanceof Error ? error.message : "Erreur de test",
      });
    } finally {
      setBusy(null);
    }
  }

  const count = preview?.chantiers.length ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-primary" />
            Suivi des relances
          </CardTitle>
          <CardDescription>
            {scheduleLabel} Les mails planifiés partent seulement si la case
            est enregistrée. L&apos;envoi manuel et le test restent disponibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className={savedEnabled ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}>
              {savedEnabled
                ? "Relances automatiques actives"
                : "Relances automatiques désactivées"}
            </Badge>
            {draftEnabled !== savedEnabled && (
              <span className="text-amber-700">
                Modification non enregistrée.
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Le serveur doit exécuter{" "}
            <code className="text-[11px]">npm run mail:relances</code> toutes
            les 15 minutes, le lundi et le jeudi, entre 2 h et 8 h
            (Africa/Casablanca).
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={handlePreview}
            >
              {busy === "preview" ? "Calcul..." : "Aperçu du prochain envoi"}
            </Button>
            <Button
              type="button"
              disabled={busy !== null || !configId}
              onClick={handleSend}
              title={
                !configId
                  ? "Enregistrez d'abord la configuration"
                  : "Envoyer aux directeurs et PMO"
              }
            >
              <Send className="mr-1.5 size-4" />
              {busy === "send"
                ? "Envoi..."
                : confirming
                  ? `Confirmer l'envoi de ${count} chantier(s)`
                  : "Envoyer les relances maintenant"}
            </Button>
            {confirming && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => setConfirming(false)}
              >
                Annuler
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => {
                setBusy("refresh");
                refreshRuns()
                  .catch(() => undefined)
                  .finally(() => setBusy(null));
              }}
            >
              <RefreshCw className="mr-1.5 size-4" />
              Actualiser
            </Button>
          </div>

          {!configId && (
            <p className="text-xs text-amber-600">
              Enregistrez la configuration SMTP avant un envoi.
            </p>
          )}

          {confirming && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Les directeurs de chantier et les PMO des chantiers éligibles
              recevront le mail maintenant, même si les relances automatiques
              sont décochées et même si le créneau du jour est déjà parti. Le
              décompte est recalculé à l&apos;envoi.
            </p>
          )}

          {previewMsg && (
            <p className="text-sm text-muted-foreground">{previewMsg}</p>
          )}
          {sendMsg && (
            <p
              className={`flex items-start gap-2 text-sm ${
                sendMsg.type === "ok" ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {sendMsg.type === "ok" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0" />
              )}
              {sendMsg.text}
            </p>
          )}

          {preview && preview.chantiers.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Chantier</th>
                    <th className="px-2 py-2 font-medium">Destinataires</th>
                    <th className="px-2 py-2 font-medium">Sans adresse</th>
                    <th className="px-2 py-2 font-medium">Actives</th>
                    <th className="px-2 py-2 font-medium">Échues</th>
                    <th className="px-2 py-2 font-medium">Semaine</th>
                    <th className="px-2 py-2 font-medium">Sem. +1</th>
                    <th className="px-2 py-2 font-medium">Clôture</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.chantiers.map((row) => (
                    <tr key={row.chantierId} className="border-t align-top">
                      <td className="px-2 py-2 font-medium text-primary">
                        {row.code}
                        <span className="mt-0.5 block font-normal text-muted-foreground">
                          {row.nom}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {row.recipients.length > 0
                          ? row.recipients.join(", ")
                          : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {row.missing.length > 0 ? row.missing.join(", ") : "—"}
                      </td>
                      <td className="px-2 py-2">{row.active}</td>
                      <td className="px-2 py-2">{row.overdue}</td>
                      <td className="px-2 py-2">{row.thisWeek}</td>
                      <td className="px-2 py-2">{row.nextWeek}</td>
                      <td className="px-2 py-2">{row.closeRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Historique</p>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune relance envoyée.
              </p>
            ) : (
              runs.map((run) => (
                <details key={run.id} className="rounded-lg border">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">{formatWhen(run.startedAt)}</span>
                    <Badge className="bg-[#0A3C74]/10 text-[#0A3C74]">
                      {TRIGGER_LABEL[run.trigger] ?? run.trigger}
                    </Badge>
                    <Badge className={statusClass(run.status)}>
                      {STATUS_LABEL[run.status] ?? run.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {run.chantierCount} chantier(s) · {run.sentCount}{" "}
                      envoyé(s) · {run.failedCount} échec(s)
                    </span>
                  </summary>
                  <div className="space-y-2 border-t px-3 py-2">
                    {run.message && (
                      <p className="text-xs text-muted-foreground">{run.message}</p>
                    )}
                    {run.items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[36rem] text-left text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-2 font-medium">Chantier</th>
                              <th className="py-1 pr-2 font-medium">Statut</th>
                              <th className="py-1 pr-2 font-medium">Destinataires</th>
                              <th className="py-1 pr-2 font-medium">Échues</th>
                              <th className="py-1 font-medium">Détail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {run.items.map((item) => (
                              <tr key={item.id} className="border-t align-top">
                                <td className="py-1.5 pr-2">
                                  {item.chantierCode || "—"}
                                  {item.chantierNom ? ` — ${item.chantierNom}` : ""}
                                </td>
                                <td className="py-1.5 pr-2">
                                  {STATUS_LABEL[item.status] ?? item.status}
                                </td>
                                <td className="py-1.5 pr-2">
                                  {item.recipients || "—"}
                                  {item.missingNames ? (
                                    <span className="mt-0.5 block text-muted-foreground">
                                      Sans adresse : {item.missingNames}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-1.5 pr-2">
                                  {item.overdueCount} / sem. {item.weekCount}
                                </td>
                                <td className="py-1.5">{item.error || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </details>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#00BDBB]/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4 text-[#00BDBB]" />
            Tester l&apos;envoi du mail de relance
          </CardTitle>
          <CardDescription>
            Choisir un chantier et une adresse. Le mail part uniquement à cette
            adresse, avec le préfixe [Test]. Les directeurs et les PMO ne sont
            pas destinataires, et le créneau planifié n&apos;est pas consommé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="relance-chantier">
                Chantier
              </label>
              <select
                id="relance-chantier"
                value={chantierId}
                onChange={(e) => {
                  setChantierId(e.target.value);
                  setTestMsg(null);
                }}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                {chantiers.length === 0 && (
                  <option value="">Aucun chantier</option>
                )}
                {chantiers.map((chantier) => (
                  <option key={chantier.id} value={chantier.id}>
                    {chantier.code} — {chantier.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="relance-email">
                Adresse e-mail de destination
              </label>
              <Input
                id="relance-email"
                type="email"
                value={testTo}
                onChange={(e) => {
                  setTestTo(e.target.value);
                  setTestMsg(null);
                }}
                placeholder="votre.email@banque.ma"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={
              busy !== null || !configId || !chantierId || !testTo.trim()
            }
            onClick={handleTest}
            className="border-[#00BDBB]/40 text-primary hover:bg-[#00BDBB]/10"
          >
            <Send className="mr-1.5 size-4" />
            {busy === "test" ? "Envoi..." : "Envoyer le mail de relance"}
          </Button>
          {!configId && (
            <p className="text-xs text-amber-600">
              Enregistrez la configuration avant de lancer un test.
            </p>
          )}
          {testMsg && (
            <p
              className={`flex items-start gap-2 text-sm ${
                testMsg.type === "ok" ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {testMsg.type === "ok" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0" />
              )}
              {testMsg.text}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
