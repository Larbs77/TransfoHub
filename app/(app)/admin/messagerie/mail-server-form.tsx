"use client";

import { useState, useTransition } from "react";
import {
  Mail,
  Server,
  Shield,
  Send,
  Save,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  saveMailServerConfig,
  testMailServerConfig,
  type MailServerFormInput,
} from "./actions";
import type { MailConfigPublic, MailSecurity } from "@/lib/mail";

const PORT_PRESETS: { label: string; port: number; security: MailSecurity }[] =
  [
    { label: "587 · STARTTLS (recommandé)", port: 587, security: "starttls" },
    { label: "465 · SSL/TLS", port: 465, security: "ssl" },
    { label: "25 · Sans chiffrement", port: 25, security: "none" },
  ];

type FormState = {
  name: string;
  host: string;
  port: number;
  security: MailSecurity;
  auth_user: string;
  auth_password: string;
  clear_password: boolean;
  from_email: string;
  from_name: string;
  reply_to: string;
  tls_reject_unauthorized: boolean;
  connection_timeout_ms: number;
  greeting_timeout_ms: number;
  socket_timeout_ms: number;
  pool: boolean;
  max_connections: number;
  local_hostname: string;
  notes: string;
  is_active: boolean;
  is_default: boolean;
};

function fromConfig(config: MailConfigPublic | null): FormState {
  return {
    name: config?.name ?? "Serveur principal",
    host: config?.host ?? "",
    port: config?.port ?? 587,
    security: config?.security ?? "starttls",
    auth_user: config?.auth_user ?? "",
    auth_password: "",
    clear_password: false,
    from_email: config?.from_email ?? "",
    from_name: config?.from_name ?? "TransfoHub",
    reply_to: config?.reply_to ?? "",
    tls_reject_unauthorized: config?.tls_reject_unauthorized ?? true,
    connection_timeout_ms: config?.connection_timeout_ms ?? 10000,
    greeting_timeout_ms: config?.greeting_timeout_ms ?? 10000,
    socket_timeout_ms: config?.socket_timeout_ms ?? 30000,
    pool: config?.pool ?? false,
    max_connections: config?.max_connections ?? 5,
    local_hostname: config?.local_hostname ?? "",
    notes: config?.notes ?? "",
    is_active: config?.is_active ?? true,
    is_default: config?.is_default ?? true,
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function MailServerForm({
  initialConfig,
}: {
  initialConfig: MailConfigPublic | null;
}) {
  const [form, setForm] = useState<FormState>(() => fromConfig(initialConfig));
  const [configId, setConfigId] = useState(initialConfig?.id);
  const [hasPassword, setHasPassword] = useState(
    Boolean(initialConfig?.has_password)
  );
  const [saveMsg, setSaveMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testMsg, setTestMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [lastTest, setLastTest] = useState({
    at: initialConfig?.last_test_at ?? null,
    ok: initialConfig?.last_test_ok ?? null,
    message: initialConfig?.last_test_message ?? "",
  });
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveMsg(null);
  };

  const applyPreset = (port: number, security: MailSecurity) => {
    setForm((f) => ({ ...f, port, security }));
    setSaveMsg(null);
  };

  const handleSave = () => {
    setSaveMsg(null);
    startTransition(async () => {
      try {
        const payload: MailServerFormInput = {
          id: configId,
          ...form,
          auth_password: form.clear_password ? undefined : form.auth_password,
        };
        const saved = await saveMailServerConfig(payload);
        setConfigId(saved.id);
        setHasPassword(saved.has_password);
        setForm((f) => ({
          ...f,
          auth_password: "",
          clear_password: false,
        }));
        setLastTest({
          at: saved.last_test_at,
          ok: saved.last_test_ok,
          message: saved.last_test_message,
        });
        setSaveMsg({
          type: "ok",
          text: "Configuration enregistrée. Les envois futurs utiliseront ce serveur.",
        });
      } catch (e: unknown) {
        setSaveMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Erreur d'enregistrement",
        });
      }
    });
  };

  const handleTest = () => {
    setTestMsg(null);
    startTransition(async () => {
      try {
        const result = await testMailServerConfig({
          configId,
          to: testEmail,
        });
        if (result.ok) {
          setTestMsg({ type: "ok", text: result.message });
          setLastTest({
            at: new Date(),
            ok: true,
            message: result.message,
          });
        } else {
          setTestMsg({ type: "err", text: result.error });
          setLastTest({
            at: new Date(),
            ok: false,
            message: result.error,
          });
        }
      } catch (e: unknown) {
        setTestMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Erreur de test",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="size-4 text-primary" />
            Serveur SMTP
          </CardTitle>
          <CardDescription>
            Paramètres standard pour Exchange, Office 365, serveur SMTP interne
            ou tout relais SMTP. Chaque client / banque peut pointer vers son
            propre serveur. Le mot de passe est chiffré en base.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de la configuration">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex. BOA Exchange"
              />
            </Field>
            <Field
              label="Hôte SMTP"
              hint="Ex. smtp.office365.com, mail.banque.ma, exchange.local"
            >
              <Input
                value={form.host}
                onChange={(e) => set("host", e.target.value)}
                placeholder="smtp.example.com"
                autoComplete="off"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            {PORT_PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => applyPreset(p.port, p.security)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Port">
              <Input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => set("port", Number(e.target.value) || 587)}
              />
            </Field>
            <Field label="Sécurité">
              <Select
                value={form.security}
                onValueChange={(v) => set("security", v as MailSecurity)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">STARTTLS (587)</SelectItem>
                  <SelectItem value="ssl">SSL/TLS implicite (465)</SelectItem>
                  <SelectItem value="none">Aucune (25, labo)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Hostname HELO/EHLO"
              hint="Optionnel — identité annoncée au serveur"
            >
              <Input
                value={form.local_hostname}
                onChange={(e) => set("local_hostname", e.target.value)}
                placeholder="transfuhub.local"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Utilisateur SMTP (auth)">
              <Input
                value={form.auth_user}
                onChange={(e) => set("auth_user", e.target.value)}
                autoComplete="off"
                placeholder="user@banque.ma"
              />
            </Field>
            <Field
              label="Mot de passe SMTP"
              hint={
                hasPassword && !form.clear_password
                  ? "Un mot de passe est déjà enregistré. Saisissez-en un nouveau pour le remplacer."
                  : "Laisser vide si le serveur n'exige pas d'authentification."
              }
            >
              <Input
                type="password"
                value={form.auth_password}
                onChange={(e) => {
                  set("auth_password", e.target.value);
                  if (e.target.value) set("clear_password", false);
                }}
                autoComplete="new-password"
                placeholder={hasPassword ? "••••••••" : ""}
                disabled={form.clear_password}
              />
            </Field>
          </div>

          {hasPassword && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={form.clear_password}
                onChange={(e) => {
                  set("clear_password", e.target.checked);
                  if (e.target.checked) set("auth_password", "");
                }}
              />
              Supprimer le mot de passe enregistré
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-primary" />
            Expéditeur
          </CardTitle>
          <CardDescription>
            Identité utilisée pour les e-mails sortants (invitations, alertes,
            etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="From — e-mail *">
            <Input
              type="email"
              value={form.from_email}
              onChange={(e) => set("from_email", e.target.value)}
              placeholder="noreply@banque.ma"
            />
          </Field>
          <Field label="From — nom affiché">
            <Input
              value={form.from_name}
              onChange={(e) => set("from_name", e.target.value)}
              placeholder="TransfoHub"
            />
          </Field>
          <Field label="Reply-To">
            <Input
              type="email"
              value={form.reply_to}
              onChange={(e) => set("reply_to", e.target.value)}
              placeholder="pmo@banque.ma"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4 text-primary" />
            Options avancées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Timeout connexion (ms)">
              <Input
                type="number"
                value={form.connection_timeout_ms}
                onChange={(e) =>
                  set("connection_timeout_ms", Number(e.target.value) || 10000)
                }
              />
            </Field>
            <Field label="Timeout greeting (ms)">
              <Input
                type="number"
                value={form.greeting_timeout_ms}
                onChange={(e) =>
                  set("greeting_timeout_ms", Number(e.target.value) || 10000)
                }
              />
            </Field>
            <Field label="Timeout socket (ms)">
              <Input
                type="number"
                value={form.socket_timeout_ms}
                onChange={(e) =>
                  set("socket_timeout_ms", Number(e.target.value) || 30000)
                }
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border"
                checked={form.tls_reject_unauthorized}
                onChange={(e) =>
                  set("tls_reject_unauthorized", e.target.checked)
                }
              />
              <span>
                <span className="font-medium">Vérifier le certificat TLS</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Décocher uniquement pour les environnements de test avec
                  certificat auto-signé.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border"
                checked={form.pool}
                onChange={(e) => set("pool", e.target.checked)}
              />
              <span>
                <span className="font-medium">Pool de connexions</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Réutilise les connexions SMTP pour les envois groupés.
                </span>
              </span>
            </label>
          </div>

          {form.pool && (
            <Field label="Connexions max (pool)">
              <Input
                type="number"
                min={1}
                max={50}
                className="max-w-[12rem]"
                value={form.max_connections}
                onChange={(e) =>
                  set("max_connections", Number(e.target.value) || 5)
                }
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
              Configuration active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={form.is_default}
                onChange={(e) => set("is_default", e.target.checked)}
              />
              Serveur par défaut pour les envois applicatifs
            </label>
          </div>

          <Field label="Notes (interne)">
            <Input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Ex. Relais Exchange BOA prod, ticket réseau #123"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Les futures fonctionnalités (alertes, invitations comité, etc.)
            utiliseront <code className="text-[11px]">sendMail()</code> avec ce
            serveur par défaut.
          </span>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="sm:min-w-[12rem]"
        >
          <Save className="mr-1.5 size-4" />
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      {saveMsg && (
        <p
          className={`text-sm ${
            saveMsg.type === "ok" ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {saveMsg.text}
        </p>
      )}

      {/* Test mail */}
      <Card className="border-[#00BDBB]/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4 text-[#00BDBB]" />
            Tester l&apos;envoi
          </CardTitle>
          <CardDescription>
            Envoie un e-mail de test via la configuration enregistrée (pensez à
            enregistrer avant de tester si vous venez de modifier les
            paramètres).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="text-sm font-medium">
                Adresse e-mail de destination
              </label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => {
                  setTestEmail(e.target.value);
                  setTestMsg(null);
                }}
                placeholder="votre.email@banque.ma"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !testEmail.trim() || !configId}
              onClick={handleTest}
              className="border-[#00BDBB]/40 text-primary hover:bg-[#00BDBB]/10"
              title={
                !configId
                  ? "Enregistrez d'abord la configuration"
                  : "Envoyer un e-mail de test"
              }
            >
              <Send className="mr-1.5 size-4" />
              {isPending ? "Envoi..." : "Envoyer un e-mail de test"}
            </Button>
          </div>

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

          {lastTest.at && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Dernier test : </span>
              {format(new Date(lastTest.at), "dd MMM yyyy HH:mm", {
                locale: fr,
              })}
              {" · "}
              {lastTest.ok ? (
                <span className="text-emerald-600">succès</span>
              ) : (
                <span className="text-destructive">échec</span>
              )}
              {lastTest.message ? ` — ${lastTest.message}` : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
