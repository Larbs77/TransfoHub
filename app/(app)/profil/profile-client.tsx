"use client";

import { useRef, useState, useTransition } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  KeyRound,
  Save,
  Building2,
  Calendar,
  LayoutDashboard,
  Camera,
  Trash2,
  ImageIcon,
  Sun,
  Moon,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { useTheme } from "@/components/theme-provider";
import type { Theme } from "@/lib/theme-script";
import {
  updateMyPhone,
  changeMyPassword,
  uploadMyAvatar,
  deleteMyAvatar,
  updateMyThemePreference,
  type ThemePreference,
} from "./actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export type ProfileData = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  avatar_url: string;
  theme_preference: ThemePreference;
  role: string;
  roleLabel: string;
  roleColor: string;
  dashboard_type: string;
  last_login: Date | null;
  createdAt: Date;
  updatedAt: Date;
  ressource: { id: string; nom_complet: string } | null;
};

function ReadOnlyField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex min-h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className={value ? "" : "text-muted-foreground"}>{value || "—"}</span>
      </div>
    </div>
  );
}

const PICK_MAX_BYTES = 12 * 1024 * 1024; // allow large source; crop output is small

export function ProfileClient({ profile }: { profile: ProfileData }) {
  const { setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [avatarVersion, setAvatarVersion] = useState(
    new Date(profile.updatedAt).getTime()
  );
  const [avatarMsg, setAvatarMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [phone, setPhone] = useState(profile.phone ?? "");
  const [phoneMsg, setPhoneMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [themePreference, setThemePreference] = useState<ThemePreference>(
    profile.theme_preference === "dark" ? "dark" : "light"
  );
  const [themeMsg, setThemeMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const fullName =
    `${profile.first_name} ${profile.last_name}`.trim() || profile.username;

  const revokeCropSrc = () => {
    if (cropSrc?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);
  };

  const handleAvatarPick = (file: File | null) => {
    if (!file) return;
    setAvatarMsg(null);

    if (!file.type.startsWith("image/")) {
      setAvatarMsg({
        type: "err",
        text: "Veuillez sélectionner un fichier image.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > PICK_MAX_BYTES) {
      setAvatarMsg({
        type: "err",
        text: "L'image source ne doit pas dépasser 12 Mo.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    revokeCropSrc();
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropComplete = (file: File) => {
    setSavingAvatar(true);
    setAvatarMsg(null);
    const fd = new FormData();
    fd.set("avatar", file);
    startTransition(async () => {
      try {
        const res = await uploadMyAvatar(fd);
        setAvatarUrl(res.avatar_url);
        setAvatarVersion(Date.now());
        setAvatarMsg({ type: "ok", text: "Photo de profil mise à jour." });
        setCropOpen(false);
        revokeCropSrc();
      } catch (e: unknown) {
        setAvatarMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Erreur",
        });
      } finally {
        setSavingAvatar(false);
      }
    });
  };

  const handleCropOpenChange = (open: boolean) => {
    if (!open && !savingAvatar) {
      setCropOpen(false);
      revokeCropSrc();
    }
  };

  const handleDeleteAvatar = () => {
    setAvatarMsg(null);
    startTransition(async () => {
      try {
        await deleteMyAvatar();
        setAvatarUrl("");
        setAvatarVersion(Date.now());
        setAvatarMsg({
          type: "ok",
          text: "Photo supprimée. L'initiale est à nouveau utilisée.",
        });
      } catch (e: unknown) {
        setAvatarMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Erreur",
        });
      }
    });
  };

  const handleSavePhone = () => {
    setPhoneMsg(null);
    startTransition(async () => {
      try {
        await updateMyPhone(phone);
        setPhoneMsg({ type: "ok", text: "Téléphone mis à jour." });
      } catch (e: unknown) {
        setPhoneMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Erreur",
        });
      }
    });
  };

  const handleSaveTheme = (next: ThemePreference) => {
    setThemeMsg(null);
    setThemePreference(next);
    setTheme(next as Theme);
    startTransition(async () => {
      try {
        await updateMyThemePreference(next);
        setThemeMsg({
          type: "ok",
          text: "Mode par défaut enregistré. Il sera appliqué à chaque connexion.",
        });
      } catch (e: unknown) {
        setThemeMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Erreur",
        });
      }
    });
  };

  const handleChangePassword = () => {
    setPwdMsg(null);
    startTransition(async () => {
      try {
        await changeMyPassword({
          currentPassword,
          newPassword,
          confirmPassword,
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPwdMsg({ type: "ok", text: "Mot de passe modifié avec succès." });
      } catch (e: unknown) {
        setPwdMsg({
          type: "err",
          text: e instanceof Error ? e.message : "Erreur",
        });
      }
    });
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-start gap-4">
        <UserAvatar
          name={fullName}
          color={profile.roleColor}
          src={avatarUrl}
          version={avatarVersion}
          size="2xl"
          className="shadow-sm ring-2 ring-border"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: profile.roleColor, color: profile.roleColor }}
            >
              <Shield className="mr-1 size-3" />
              {profile.roleLabel}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Dashboard{" "}
              {profile.dashboard_type === "limited" ? "limité" : "complet"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Avatar management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4" />
            Photo de profil
          </CardTitle>
          <CardDescription>
            Par défaut, la première lettre de votre nom est affichée. Choisissez
            une photo puis ajustez le cadrage (zoom et position) comme sur
            LinkedIn — seule la zone ronde est enregistrée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              name={fullName}
              color={profile.roleColor}
              src={avatarUrl}
              version={avatarVersion}
              size="2xl"
              className="ring-2 ring-border"
            />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) =>
                  handleAvatarPick(e.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="outline"
                disabled={isPending || savingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-1.5 size-4" />
                {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || savingAvatar}
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteAvatar}
                >
                  <Trash2 className="mr-1.5 size-4" />
                  Supprimer
                </Button>
              )}
            </div>
          </div>
          {avatarMsg && (
            <p
              className={`text-sm ${
                avatarMsg.type === "ok"
                  ? "text-emerald-600"
                  : "text-destructive"
              }`}
            >
              {avatarMsg.text}
            </p>
          )}
        </CardContent>
      </Card>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        onOpenChange={handleCropOpenChange}
        onComplete={handleCropComplete}
        isSaving={savingAvatar}
      />

      {/* Identity — read only */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations personnelles</CardTitle>
          <CardDescription>
            Ces informations sont gérées par un administrateur. Vous pouvez
            uniquement modifier votre téléphone et votre photo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnlyField
              label="Prénom"
              value={profile.first_name}
              icon={User}
            />
            <ReadOnlyField
              label="Nom"
              value={profile.last_name}
              icon={User}
            />
            <ReadOnlyField
              label="Nom d'utilisateur"
              value={profile.username}
            />
            <ReadOnlyField label="E-mail" value={profile.email} icon={Mail} />
            <ReadOnlyField
              label="Rôle"
              value={profile.roleLabel}
              icon={Shield}
            />
            <ReadOnlyField
              label="Ressource liée"
              value={profile.ressource?.nom_complet ?? ""}
              icon={Building2}
            />
            <ReadOnlyField
              label="Type de dashboard"
              value={
                profile.dashboard_type === "limited" ? "Limité" : "Complet"
              }
              icon={LayoutDashboard}
            />
            <ReadOnlyField
              label="Dernière connexion"
              value={
                profile.last_login
                  ? format(new Date(profile.last_login), "dd MMM yyyy HH:mm", {
                      locale: fr,
                    })
                  : "—"
              }
              icon={Calendar}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Téléphone (modifiable)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneMsg(null);
                    }}
                    className="pl-9"
                    placeholder="+212 6 …"
                  />
                </div>
              </div>
              <Button
                onClick={handleSavePhone}
                disabled={isPending || phone === (profile.phone ?? "")}
              >
                <Save className="mr-1.5 size-4" />
                {isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
            {phoneMsg && (
              <p
                className={`mt-2 text-sm ${
                  phoneMsg.type === "ok"
                    ? "text-emerald-600"
                    : "text-destructive"
                }`}
              >
                {phoneMsg.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appearance / default theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" />
            Mode d&apos;affichage
          </CardTitle>
          <CardDescription>
            Choisissez le mode par défaut (clair ou sombre) associé à votre
            compte. Il sera appliqué automatiquement à chaque accès à
            l&apos;application. Vous pouvez toujours basculer temporairement
            depuis le menu latéral.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Mode d'affichage par défaut"
          >
            <button
              type="button"
              role="radio"
              aria-checked={themePreference === "light"}
              disabled={isPending}
              onClick={() => handleSaveTheme("light")}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                themePreference === "light"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
                <Sun className="size-5 text-amber-500" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Mode clair</span>
                <span className="block text-xs text-muted-foreground">
                  Fond clair, idéal en journée
                </span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={themePreference === "dark"}
              disabled={isPending}
              onClick={() => handleSaveTheme("dark")}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                themePreference === "dark"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
                <Moon className="size-5 text-sky-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Mode sombre</span>
                <span className="block text-xs text-muted-foreground">
                  Fond sombre, plus confortable le soir
                </span>
              </span>
            </button>
          </div>
          {themeMsg && (
            <p
              className={`text-sm ${
                themeMsg.type === "ok"
                  ? "text-emerald-600"
                  : "text-destructive"
              }`}
            >
              {themeMsg.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>
            8 caractères minimum, avec majuscule, minuscule, chiffre et caractère
            spécial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mot de passe actuel</label>
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPwdMsg(null);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nouveau mot de passe</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPwdMsg(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmer</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPwdMsg(null);
                }}
              />
            </div>
          </div>
          {pwdMsg && (
            <p
              className={`text-sm ${
                pwdMsg.type === "ok" ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {pwdMsg.text}
            </p>
          )}
          <Button
            onClick={handleChangePassword}
            disabled={
              isPending ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
          >
            {isPending ? "Modification..." : "Modifier le mot de passe"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
