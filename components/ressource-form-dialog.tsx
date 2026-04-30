"use client";

import { useState, useEffect, useMemo } from "react";
import { createRessource, updateRessource, getProfilsRessource } from "@/app/(app)/actions";
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
import { Loader2, CircleCheck, CircleX } from "lucide-react";
import { RESSOURCE_TYPE_LABELS } from "@/lib/ressource-labels";

interface ProfilData {
  id: string;
  nom: string;
  type_ressource: string;
  tjm_defaut: number;
}

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
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ressource?: RessourceData | null;
}

export function RessourceFormDialog({ open, onOpenChange, ressource }: Props) {
  const isEdit = !!ressource;
  const [loading, setLoading] = useState(false);

  const [nomComplet, setNomComplet] = useState(ressource?.nom_complet ?? "");
  const [email, setEmail] = useState(ressource?.email ?? "");
  const [telephone, setTelephone] = useState(ressource?.telephone ?? "");
  const [type, setType] = useState(ressource?.type ?? "Interne");
  const [profilId, setProfilId] = useState(ressource?.profilId ?? "");
  const [organisation, setOrganisation] = useState(ressource?.organisation ?? "");
  const [tarifJournalier, setTarifJournalier] = useState(ressource?.tarif_journalier ?? 0);
  const [capaciteJoursMois, setCapaciteJoursMois] = useState(ressource?.capacite_jours_mois ?? 20);
  const [actif, setActif] = useState(ressource?.actif ?? true);

  // Load all profiles
  const [profils, setProfils] = useState<ProfilData[]>([]);
  useEffect(() => {
    if (open) {
      getProfilsRessource().then((data) =>
        setProfils(data.map((p) => ({ id: p.id, nom: p.nom, type_ressource: p.type_ressource, tjm_defaut: p.tjm_defaut })))
      );
    }
  }, [open]);

  // Filter profiles by selected type
  const filteredProfils = useMemo(
    () => profils.filter((p) => p.type_ressource === type),
    [profils, type]
  );

  function handleTypeChange(newType: string) {
    setType(newType);
    // Reset profil if it doesn't match the new type
    const currentProfil = profils.find((p) => p.id === profilId);
    if (currentProfil && currentProfil.type_ressource !== newType) {
      setProfilId("");
    }
  }

  function handleProfilChange(newProfilId: string) {
    setProfilId(newProfilId);
    // Auto-fill TJM from profile default
    const selectedProfil = profils.find((p) => p.id === newProfilId);
    if (selectedProfil) {
      setTarifJournalier(selectedProfil.tjm_defaut);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data = {
      nom_complet: nomComplet,
      email,
      telephone,
      type,
      organisation,
      tarif_journalier: tarifJournalier,
      capacite_jours_mois: capaciteJoursMois,
      actif,
      profilId: profilId || null,
    };
    if (isEdit) {
      await updateRessource(ressource.id, data);
    } else {
      await createRessource(data);
    }
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la ressource" : "Nouvelle ressource"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Nom complet */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Nom complet</label>
            <Input
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              placeholder="Nom et prénom"
              required
            />
          </div>

          {/* Email + Telephone */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* Type + Profil */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESSOURCE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
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

          {/* Organisation + TJM */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Capacité + Actif */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Capacité (jours/mois)</label>
              <Input
                type="number"
                min={0}
                max={31}
                value={capaciteJoursMois}
                onChange={(e) => setCapaciteJoursMois(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Statut</label>
              <button
                type="button"
                className="flex items-center gap-2 text-sm h-9 px-3 border rounded-md"
                onClick={() => setActif(!actif)}
              >
                {actif ? (
                  <CircleCheck className="size-5 text-emerald-500" />
                ) : (
                  <CircleX className="size-5 text-muted-foreground" />
                )}
                <span className={actif ? "font-medium" : "text-muted-foreground"}>
                  {actif ? "Actif" : "Inactif"}
                </span>
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
