"use client";

import { useState, useEffect, useMemo } from "react";
import {
  createRessource,
  updateRessource,
  createAccountForRessource,
  getProfilsRessource,
} from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Loader2, CircleCheck, CircleX, UserPlus } from "lucide-react";
import { RESSOURCE_TYPE_LABELS } from "@/lib/ressource-labels";

interface ProfilData {
  id: string;
  nom: string;
  type_ressource: string;
  tjm_defaut: number;
}

export type EquipeOption = {
  id: string;
  name: string;
  is_active: boolean;
  /** institutionnelle | fonctionnelle — optional for filtering */
  type?: string;
};

export type ActiveRoleOption = {
  code: string;
  label: string;
};

interface RessourceData {
  id: string;
  nom_complet: string;
  email: string;
  telephone: string;
  type: string;
  organisation: string;
  tarif_journalier: number;
  capacite_jours_mois: number;
  actif: boolean;
  profilId?: string | null;
  equipeHierarchieId?: string | null;
  equipeHierarchie?: { id: string; name: string; is_active?: boolean } | null;
  equipesFonctionnelles?: {
    equipeId: string;
    equipe?: { id: string; name: string; is_active?: boolean };
  }[];
  user?: { id: string; username: string; role: string; is_active: boolean } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ressource?: RessourceData | null;
  equipes?: EquipeOption[];
  /** Roles for optional account creation (Admin). */
  activeRoles?: ActiveRoleOption[];
  canCreateAccount?: boolean;
}

export function RessourceFormDialog({
  open,
  onOpenChange,
  ressource,
  equipes = [],
  activeRoles = [],
  canCreateAccount = false,
}: Props) {
  const isEdit = !!ressource;
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  /** Institutional teams only (bank hierarchy). */
  const equipesInst = useMemo(
    () =>
      equipes.filter(
        (e) => !e.type || e.type === "institutionnelle"
      ),
    [equipes]
  );
  /** Functional (chantier) teams. */
  const equipesFonc = useMemo(
    () => equipes.filter((e) => e.type === "fonctionnelle"),
    [equipes]
  );

  const activeHierarchie = useMemo(
    () => equipesInst.filter((e) => e.is_active),
    [equipesInst]
  );

  const defaultHierarchie =
    ressource?.equipeHierarchieId ??
    ressource?.equipeHierarchie?.id ??
    activeHierarchie[0]?.id ??
    equipesInst[0]?.id ??
    "";

  const [nomComplet, setNomComplet] = useState(ressource?.nom_complet ?? "");
  const [email, setEmail] = useState(ressource?.email ?? "");
  const [telephone, setTelephone] = useState(ressource?.telephone ?? "");
  const [type, setType] = useState(ressource?.type ?? "Interne");
  const [profilId, setProfilId] = useState(ressource?.profilId ?? "");
  const [organisation, setOrganisation] = useState(ressource?.organisation ?? "");
  const [tarifJournalier, setTarifJournalier] = useState(
    ressource?.tarif_journalier ?? 0
  );
  const [capaciteJoursMois, setCapaciteJoursMois] = useState(
    ressource?.capacite_jours_mois ?? 20
  );
  const [actif, setActif] = useState(ressource?.actif ?? true);
  const [equipeHierarchieId, setEquipeHierarchieId] = useState(defaultHierarchie);
  const [equipeFonctionnelleIds, setEquipeFonctionnelleIds] = useState<string[]>(
    ressource?.equipesFonctionnelles?.map((l) => l.equipeId) ?? []
  );

  // Account creation (new resource or existing without account)
  const hasAccount = !!ressource?.user;
  const [createAccount, setCreateAccount] = useState(false);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountRole, setAccountRole] = useState(
    activeRoles.find((r) => r.code === "PMO_Chantier")?.code ??
      activeRoles[0]?.code ??
      ""
  );

  // Load all profiles
  const [profils, setProfils] = useState<ProfilData[]>([]);
  useEffect(() => {
    if (open) {
      getProfilsRessource().then((data) =>
        setProfils(
          data.map((p) => ({
            id: p.id,
            nom: p.nom,
            type_ressource: p.type_ressource,
            tjm_defaut: p.tjm_defaut,
          }))
        )
      );
    }
  }, [open]);

  const filteredProfils = useMemo(
    () => profils.filter((p) => p.type_ressource === type),
    [profils, type]
  );

  const hierarchieOptions = useMemo(() => {
    const list = [...activeHierarchie];
    if (equipeHierarchieId) {
      const current = equipesInst.find((e) => e.id === equipeHierarchieId);
      if (current && !list.some((e) => e.id === current.id)) {
        list.push(current);
      }
      // Fallback: name from the resource relation when catalog is incomplete
      if (
        !list.some((e) => e.id === equipeHierarchieId) &&
        ressource?.equipeHierarchie?.id === equipeHierarchieId
      ) {
        list.push({
          id: ressource.equipeHierarchie.id,
          name: ressource.equipeHierarchie.name,
          is_active: ressource.equipeHierarchie.is_active ?? true,
          type: "institutionnelle",
        });
      }
    }
    return list;
  }, [
    activeHierarchie,
    equipesInst,
    equipeHierarchieId,
    ressource?.equipeHierarchie,
  ]);

  const hierarchieLabel = useMemo(() => {
    const fromList = hierarchieOptions.find((e) => e.id === equipeHierarchieId);
    if (fromList?.name) return fromList.name;
    if (ressource?.equipeHierarchie?.id === equipeHierarchieId) {
      return ressource.equipeHierarchie.name;
    }
    return undefined;
  }, [hierarchieOptions, equipeHierarchieId, ressource?.equipeHierarchie]);

  const fnOptions = useMemo(() => {
    const byId = new Map<string, { value: string; label: string }>();
    for (const e of equipesFonc) {
      if (e.is_active || equipeFonctionnelleIds.includes(e.id)) {
        byId.set(e.id, {
          value: e.id,
          label: e.is_active ? e.name : `${e.name} (inactive)`,
        });
      }
    }
    // Ensure selected functional teams always show a name, not a raw UUID
    for (const link of ressource?.equipesFonctionnelles ?? []) {
      if (!byId.has(link.equipeId) && link.equipe?.name) {
        byId.set(link.equipeId, {
          value: link.equipeId,
          label: link.equipe.name,
        });
      }
    }
    for (const id of equipeFonctionnelleIds) {
      if (!byId.has(id)) {
        byId.set(id, { value: id, label: "Équipe (réf. inconnue)" });
      }
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [equipesFonc, equipeFonctionnelleIds, ressource?.equipesFonctionnelles]);

  function handleTypeChange(newType: string) {
    setType(newType);
    const currentProfil = profils.find((p) => p.id === profilId);
    if (currentProfil && currentProfil.type_ressource !== newType) {
      setProfilId("");
    }
  }

  function handleProfilChange(newProfilId: string) {
    setProfilId(newProfilId);
    const selectedProfil = profils.find((p) => p.id === newProfilId);
    if (selectedProfil) {
      setTarifJournalier(selectedProfil.tjm_defaut);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!equipeHierarchieId) {
      setFormError("Sélectionnez l'équipe hiérarchique.");
      return;
    }
    if (createAccount && canCreateAccount && !hasAccount) {
      if (!accountUsername.trim() || !accountPassword || !accountRole) {
        setFormError(
          "Pour créer un compte : renseignez login, mot de passe et rôle."
        );
        return;
      }
    }

    setLoading(true);
    try {
      const base = {
        nom_complet: nomComplet,
        email,
        telephone,
        type,
        organisation,
        tarif_journalier: tarifJournalier,
        capacite_jours_mois: capaciteJoursMois,
        actif,
        profilId: profilId || null,
        equipeHierarchieId,
        equipeFonctionnelleIds,
      };

      if (isEdit) {
        await updateRessource(ressource.id, base);
        if (createAccount && canCreateAccount && !hasAccount) {
          await createAccountForRessource(ressource.id, {
            username: accountUsername.trim(),
            password: accountPassword,
            role: accountRole,
          });
        }
      } else {
        await createRessource({
          ...base,
          createAccount:
            createAccount && canCreateAccount
              ? {
                  username: accountUsername.trim(),
                  password: accountPassword,
                  role: accountRole,
                }
              : null,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-br from-white via-[#f7fbfd] to-[#eef8f8] px-6 py-5 dark:from-background dark:via-background dark:to-muted/30">
          <DialogTitle className="text-xl text-[#0A3C74] dark:text-foreground">
            {isEdit ? "Modifier la ressource" : "Nouvelle ressource"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Identité, rattachement organisationnel et capacité.
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Identity */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00BDBB]">
                Identité
              </h3>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Nom complet <span className="text-destructive">*</span>
                </label>
                <Input
                  value={nomComplet}
                  onChange={(e) => setNomComplet(e.target.value)}
                  placeholder="Nom et prénom"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.com"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Téléphone</label>
                  <Input
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="+212 6..."
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={type} onValueChange={handleTypeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RESSOURCE_TYPE_LABELS).map(
                        ([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Profil</label>
                  <Select
                    value={profilId || ""}
                    onValueChange={handleProfilChange}
                    disabled={filteredProfils.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner un profil" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProfils.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Teams */}
            <section className="space-y-3 rounded-xl border border-[#0A3C74]/10 bg-muted/20 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00BDBB]">
                Rattachement équipes
              </h3>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Équipe institutionnelle (hiérarchie){" "}
                  <span className="text-destructive">*</span>
                </label>
                <Select
                  value={equipeHierarchieId || undefined}
                  onValueChange={setEquipeHierarchieId}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Rattachement banque">
                      {hierarchieLabel
                        ? `${hierarchieLabel}${
                            hierarchieOptions.find(
                              (e) => e.id === equipeHierarchieId
                            )?.is_active === false
                              ? " (inactive)"
                              : ""
                          }`
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {hierarchieOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                        {!e.is_active ? " (inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Organisation de la banque (hiérarchie RH).
                </p>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Équipes fonctionnelles (chantiers)
                </label>
                <MultiSelect
                  options={fnOptions}
                  selected={equipeFonctionnelleIds}
                  onChange={setEquipeFonctionnelleIds}
                  placeholder="Sélectionner des équipes chantier…"
                  chips
                />
                <p className="text-[11px] text-muted-foreground">
                  Équipes programme des chantiers. Les noms longs s&apos;affichent
                  sur plusieurs lignes.
                </p>
              </div>
            </section>

            {/* Capacity */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00BDBB]">
                Capacité &amp; organisation
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Organisation</label>
                  <Input
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    placeholder="DSI Banque, McKinsey..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">TJM (MAD/jour)</label>
                  <Input
                    type="number"
                    min={0}
                    value={tarifJournalier}
                    onChange={(e) => setTarifJournalier(Number(e.target.value))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">
                    Capacité (jours/mois)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={capaciteJoursMois}
                    onChange={(e) =>
                      setCapaciteJoursMois(Number(e.target.value))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Statut</label>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors hover:bg-accent/40"
                    onClick={() => setActif(!actif)}
                  >
                    {actif ? (
                      <CircleCheck className="size-5 text-emerald-500" />
                    ) : (
                      <CircleX className="size-5 text-muted-foreground" />
                    )}
                    <span
                      className={
                        actif ? "font-medium" : "text-muted-foreground"
                      }
                    >
                      {actif ? "Actif" : "Inactif"}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            {/* Account section */}
            {hasAccount && (
              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <UserPlus className="size-4 text-[#00BDBB]" />
                  Compte applicatif
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Login :{" "}
                  <span className="font-medium text-foreground">
                    {ressource.user!.username}
                  </span>
                  {" · "}
                  Rôle : {ressource.user!.role}
                  {" · "}
                  {ressource.user!.is_active ? "Actif" : "Inactif"}
                </p>
              </div>
            )}

            {canCreateAccount && !hasAccount && (
              <div className="space-y-3 rounded-xl border border-[#00BDBB]/30 bg-[#00BDBB]/5 p-4">
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                    className="size-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm font-medium">
                    {isEdit
                      ? "Créer un compte applicatif pour cette ressource"
                      : "Créer un compte applicatif en même temps"}
                  </span>
                </label>
                {createAccount && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">
                        Nom d&apos;utilisateur
                      </label>
                      <Input
                        value={accountUsername}
                        onChange={(e) => setAccountUsername(e.target.value)}
                        placeholder="ex: j.dupont"
                        autoComplete="off"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">
                        Mot de passe temporaire
                      </label>
                      <Input
                        type="password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        placeholder="Min. 8 car., maj., min., chiffre, spécial"
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Rôle</label>
                      <Select
                        value={accountRole}
                        onValueChange={setAccountRole}
                        disabled={activeRoles.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sélectionner un rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeRoles.map((r) => (
                            <SelectItem key={r.code} value={r.code}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/20 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !equipeHierarchieId}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
