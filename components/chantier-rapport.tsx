"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Printer, Sun, CloudSun, CloudRain, ChevronRight } from "lucide-react";
import {
  computeMeteo,
  getActivePhase,
  getDirecteur,
  getSuppleant,
  getProbabiliteLabel,
  getImpactLabel,
  getProbabiliteColor,
  getImpactColor,
  getPhaseStats,
  type Meteo,
} from "@/lib/rapport-utils";
import { scoreCriticite, formatMAD, formatMADCompact } from "@/lib/utils-pmo";
import {
  ADHERENCE_CRITICITE_COLORS,
  ADHERENCE_STATUT_COLORS,
  ADHERENCE_TYPE_COLORS,
} from "@/lib/adherence-labels";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Raid {
  id: string;
  type: string;
  intitule: string;
  description: string;
  statut: string;
  probabilite: number | null;
  impact: number | null;
  mitigation: string;
  responsable: string;
  date_echeance: Date | null;
}

interface Jalon {
  id: string;
  phase: string;
  nom: string;
  statut: string;
  date_cible: Date;
  date_reelle: Date | null;
  livrables: string;
  ordre: number;
}

interface Membre {
  id: string;
  role: string;
  equipe: string;
  is_directeur: boolean;
  commentaires?: string;
  nom_complet?: string;
  ressource?: { nom_complet: string } | null;
}

interface AdherenceRef {
  id: string;
  code: string;
  nom: string;
}

interface Adherence {
  id: string;
  code: string;
  type: string;
  criticite: string;
  statut: string;
  description: string;
  chantierDependantLabel: string;
  chantierSource: AdherenceRef;
  chantierDependant: AdherenceRef | null;
}

interface Chantier {
  id: string;
  code: string;
  nom: string;
  directeur: string;
  pmo: string;
  domaine: string;
  statut: string;
  avancement: number;
  date_debut: Date;
  date_fin: Date;
  budgetTotalMAD: number;
  budgetProjetMAD: number;
  description: string;
  raids: Raid[];
  jalons: Jalon[];
  membres: Membre[];
  adherencesSource: Adherence[];
  adherencesDependant: Adherence[];
}

interface BurnRateTotals {
  cout_reel: number;
  cout_planifie: number;
  jours_reels: number;
  jours_planifies: number;
  taux_consommation: number;
}

interface Props {
  chantier: Chantier;
  burnRate?: BurnRateTotals | null;
  showPrintButton?: boolean;
}

// ─── Météo Icon ───────────────────────────────────────────────────────────────

function MeteoIcon({ meteo }: { meteo: Meteo }) {
  return (
    <div className="flex items-center gap-1">
      {(["vert", "orange", "rouge"] as Meteo[]).map((m) => {
        const active = m === meteo;
        const size = active ? 32 : 22;
        const opacity = active ? 1 : 0.35;
        if (m === "vert")
          return (
            <Sun
              key={m}
              style={{ width: size, height: size, opacity, color: "#fbbf24" }}
            />
          );
        if (m === "orange")
          return (
            <CloudSun
              key={m}
              style={{ width: size, height: size, opacity, color: "#f97316" }}
            />
          );
        return (
          <CloudRain
            key={m}
            style={{ width: size, height: size, opacity, color: "#60a5fa" }}
          />
        );
      })}
    </div>
  );
}

// ─── Bullet list item ─────────────────────────────────────────────────────────

function BulletItem({
  text,
  color,
  subs,
}: {
  text: string;
  color: string;
  subs?: string[];
}) {
  return (
    <li className="flex gap-2 text-sm leading-snug mb-1.5">
      <ChevronRight className="mt-0.5 shrink-0" style={{ width: 14, height: 14, color }} />
      <div>
        <span>{text}</span>
        {subs && subs.length > 0 && (
          <ul className="mt-0.5 ml-2 space-y-0.5">
            {subs.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-[12px] text-gray-600">
                <ChevronRight className="mt-0.5 shrink-0" style={{ width: 11, height: 11, color: "#9ca3af" }} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

// ─── Jalon Timeline ───────────────────────────────────────────────────────────

const JALON_STATUT_COLORS: Record<string, string> = {
  Atteint: "#22c55e",
  "En cours": "#f97316",
  Planifié: "#9ca3af",
  Reporté: "#f59e0b",
  Annulé: "#d1d5db",
};

function JalonTimeline({ jalons }: { jalons: Jalon[] }) {
  if (jalons.length === 0)
    return <p className="text-sm text-gray-400 italic">Aucun jalon pour cette phase.</p>;

  return (
    <div className="relative">
      {/* Connecting line */}
      <div
        className="absolute top-4 left-4 right-4 h-0.5"
        style={{ backgroundColor: "#e5e7eb" }}
      />
      <div className="flex items-start justify-between gap-1 overflow-x-auto pb-2">
        {jalons.map((j) => {
          const color = JALON_STATUT_COLORS[j.statut] ?? "#9ca3af";
          const isRetard =
            new Date(j.date_cible) < new Date() &&
            !["Atteint", "Annulé"].includes(j.statut);
          return (
            <div
              key={j.id}
              className="flex flex-col items-center gap-1 min-w-[72px] max-w-[90px] flex-1 text-center"
            >
              {/* Circle */}
              <div
                className="relative z-10 flex items-center justify-center rounded-full border-2 border-white shadow-sm"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: color,
                  boxShadow: isRetard ? `0 0 0 2px #ef4444` : undefined,
                }}
              >
                {j.statut === "Atteint" && (
                  <svg viewBox="0 0 12 12" width={14} height={14}>
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {j.statut === "En cours" && (
                  <div className="rounded-full bg-white" style={{ width: 10, height: 10 }} />
                )}
              </div>
              {/* Date */}
              <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap">
                {format(new Date(j.date_cible), "dd/MM", { locale: fr })}
              </span>
              {/* Name */}
              <span
                className="text-[10px] leading-tight text-gray-700 font-medium"
                style={{ lineClamp: 2 }}
                title={j.nom}
              >
                {j.nom.length > 30 ? j.nom.slice(0, 28) + "…" : j.nom}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {[
          { label: "Fait", color: "#22c55e" },
          { label: "En cours", color: "#f97316" },
          { label: "Non démarré", color: "#9ca3af" },
          { label: "Reporté", color: "#f59e0b" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="rounded-full" style={{ width: 10, height: 10, backgroundColor: item.color }} />
            <span className="text-[10px] text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Report Component ─────────────────────────────────────────────────────

export function ChantierRapport({ chantier, burnRate, showPrintButton = true }: Props) {
  const now = new Date();
  const meteo = computeMeteo(chantier, chantier.jalons, chantier.raids);
  const activePhase = getActivePhase(chantier.jalons);
  const directeur = getDirecteur(chantier, chantier.membres);
  const suppleant = getSuppleant(chantier, chantier.membres);
  const phaseStats = getPhaseStats(chantier.jalons, activePhase);

  // Phase jalons for timeline
  const phaseJalons = chantier.jalons
    .filter((j) => j.phase === activePhase && j.statut !== "Annulé")
    .sort((a, b) => a.ordre - b.ordre);

  // Réalisations = Atteint jalons (most recent first)
  const realisations = chantier.jalons
    .filter((j) => j.statut === "Atteint")
    .sort((a, b) => new Date(b.date_reelle ?? b.date_cible).getTime() - new Date(a.date_reelle ?? a.date_cible).getTime())
    .slice(0, 6);

  // Actions en cours / à venir
  const openActions = chantier.raids
    .filter(
      (r) => r.type === "Action" && !["Clôturé", "Abandonné", "NA", "Doublon"].includes(r.statut)
    )
    .sort((a, b) => {
      // Overdue first
      const aOv = a.date_echeance && new Date(a.date_echeance) < now ? -1 : 0;
      const bOv = b.date_echeance && new Date(b.date_echeance) < now ? -1 : 0;
      return aOv - bOv;
    })
    .slice(0, 8);

  const upcomingJalons = chantier.jalons
    .filter((j) => !["Atteint", "Annulé"].includes(j.statut) && new Date(j.date_cible) >= now)
    .sort((a, b) => new Date(a.date_cible).getTime() - new Date(b.date_cible).getTime())
    .slice(0, 3);

  // Points d'attention = open risks sorted by criticité desc
  const openRisks = chantier.raids
    .filter((r) => r.type === "Risque" && !["Clos", "Matérialisé"].includes(r.statut))
    .sort((a, b) => {
      const scoreA = a.impact && a.probabilite ? scoreCriticite(a.impact, a.probabilite) : 0;
      const scoreB = b.impact && b.probabilite ? scoreCriticite(b.impact, b.probabilite) : 0;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  // KPIs
  const totalJalons = chantier.jalons.filter((j) => j.statut !== "Annulé").length;
  const jalonsAtteints = chantier.jalons.filter((j) => j.statut === "Atteint").length;
  const jalonsRetard = chantier.jalons.filter(
    (j) => new Date(j.date_cible) < now && !["Atteint", "Annulé"].includes(j.statut)
  ).length;
  const openRaidCount = chantier.raids.filter(
    (r) => !["Clôturé", "Abandonné", "Clos", "Matérialisé", "NA"].includes(r.statut)
  ).length;
  const budgetConsomme =
    burnRate && burnRate.cout_planifie > 0
      ? Math.round(burnRate.taux_consommation)
      : null;

  const meteoColors: Record<Meteo, string> = {
    vert: "#22c55e",
    orange: "#f97316",
    rouge: "#ef4444",
  };
  const meteoLabels: Record<Meteo, string> = {
    vert: "Favorable",
    orange: "Vigilance",
    rouge: "Critique",
  };

  return (
    <div
      className="bg-white"
      style={{ maxWidth: 1200, margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      {/* Print button — hidden during print */}
      {showPrintButton && (
        <div className="no-print flex justify-end gap-3 p-4 border-b">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#1e3a5f" }}
          >
            <Printer style={{ width: 16, height: 16 }} />
            Télécharger / Imprimer PDF
          </button>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ backgroundColor: "#1e3a5f", minHeight: 64 }}
      >
        {/* Title */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", width: 34, height: 34 }}
          >
            <svg viewBox="0 0 14 14" width={18} height={18} fill="none">
              <polygon points="3,2 11,7 3,12" fill="white" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white" style={{ fontSize: 15 }}>
              Statuts Chantiers
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              PMO Transformation Bancaire
            </div>
          </div>
        </div>

        {/* Chantier name */}
        <div className="text-center">
          <div className="font-bold text-white tracking-wide" style={{ fontSize: 13 }}>
            CHANTIER {chantier.code}
          </div>
          <div className="font-semibold text-white" style={{ fontSize: 16 }}>
            {chantier.nom}
          </div>
        </div>

        {/* DC / Supp + Météo */}
        <div className="flex items-center gap-6">
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <svg viewBox="0 0 16 16" width={13} height={13} fill="rgba(255,255,255,0.7)">
                <circle cx="8" cy="5" r="3" />
                <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
                DC: {directeur}
              </span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <svg viewBox="0 0 16 16" width={13} height={13} fill="rgba(255,255,255,0.7)">
                <circle cx="8" cy="5" r="3" />
                <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              </svg>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                Supp.: {suppleant}
              </span>
            </div>
          </div>
          <MeteoIcon meteo={meteo} />
        </div>
      </div>

      {/* ── KPI BAR ──────────────────────────────────────────────────────────── */}
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: "repeat(6, 1fr)",
          backgroundColor: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {[
          { label: "Avancement", value: `${chantier.avancement}%`, color: "#1e3a5f" },
          { label: "Phase active", value: activePhase, color: "#0b889e" },
          {
            label: "Jalons atteints",
            value: `${jalonsAtteints}/${totalJalons}`,
            color: "#22c55e",
          },
          {
            label: "Jalons en retard",
            value: String(jalonsRetard),
            color: jalonsRetard > 0 ? "#ef4444" : "#22c55e",
          },
          {
            label: "RAID ouverts",
            value: String(openRaidCount),
            color: openRaidCount > 5 ? "#f97316" : "#64748b",
          },
          {
            label: "Météo",
            value: meteoLabels[meteo],
            color: meteoColors[meteo],
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center py-2 px-2 text-center"
            style={{ borderRight: i < 5 ? "1px solid #e2e8f0" : undefined }}
          >
            <span className="font-bold" style={{ fontSize: 15, color: kpi.color }}>
              {kpi.value}
            </span>
            <span style={{ fontSize: 10, color: "#64748b" }}>{kpi.label}</span>
          </div>
        ))}
      </div>

      {/* ── BODY: two columns ────────────────────────────────────────────────── */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", minHeight: 220 }}>
        {/* Left: Réalisations */}
        <div
          className="p-5"
          style={{ borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="rounded-full"
              style={{ width: 12, height: 12, backgroundColor: "#22c55e", flexShrink: 0 }}
            />
            <span className="font-bold tracking-wide" style={{ fontSize: 12, color: "#166534" }}>
              RÉALISATIONS
            </span>
          </div>
          {realisations.length === 0 ? (
            <p className="text-sm italic" style={{ color: "#9ca3af" }}>
              Aucun jalon atteint pour le moment.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {realisations.map((j) => (
                <BulletItem
                  key={j.id}
                  color="#22c55e"
                  text={`${j.nom} (${format(new Date(j.date_reelle ?? j.date_cible), "dd/MM/yyyy", { locale: fr })})`}
                  subs={
                    j.livrables
                      ? j.livrables
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {/* Right: Actions en cours / à venir */}
        <div
          className="p-5"
          style={{ borderBottom: "1px solid #e5e7eb" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="rounded-full"
              style={{ width: 12, height: 12, backgroundColor: "#f97316", flexShrink: 0 }}
            />
            <span className="font-bold tracking-wide" style={{ fontSize: 12, color: "#9a3412" }}>
              ACTIONS EN COURS / À VENIR
            </span>
          </div>
          {openActions.length === 0 && upcomingJalons.length === 0 ? (
            <p className="text-sm italic" style={{ color: "#9ca3af" }}>
              Aucune action ouverte.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {openActions.map((a) => {
                const overdue = a.date_echeance && new Date(a.date_echeance) < now;
                return (
                  <BulletItem
                    key={a.id}
                    color={overdue ? "#ef4444" : "#f97316"}
                    text={`${a.intitule}${a.responsable ? ` — ${a.responsable}` : ""}${a.date_echeance ? ` (Éch: ${format(new Date(a.date_echeance), "dd/MM/yy", { locale: fr })})` : ""}`}
                  />
                );
              })}
              {upcomingJalons.map((j) => (
                <BulletItem
                  key={j.id}
                  color="#6366f1"
                  text={`[Jalon] ${j.nom} — ${format(new Date(j.date_cible), "dd/MM/yyyy", { locale: fr })}`}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── POINTS D'ATTENTION ───────────────────────────────────────────────── */}
      {openRisks.length > 0 && (
        <div
          className="mx-5 my-3 rounded-md overflow-hidden"
          style={{ border: "1.5px solid #d97706" }}
        >
          <div
            className="px-4 py-2"
            style={{ backgroundColor: "#fffbeb" }}
          >
            <span className="font-bold" style={{ fontSize: 12, color: "#92400e" }}>
              Points d&apos;attention à soumettre au comité
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#fef3c7" }}>
                {["Point d'attention", "Probabilité", "Impact", "Plan de mitigation"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-1.5"
                      style={{ fontSize: 11, color: "#92400e", fontWeight: 600, borderBottom: "1px solid #fde68a" }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {openRisks.map((r, i) => (
                <tr
                  key={r.id}
                  style={{ backgroundColor: i % 2 === 0 ? "#fffdf7" : "#fffbeb" }}
                >
                  <td className="px-3 py-1.5" style={{ fontSize: 11, color: "#374151", maxWidth: 320 }}>
                    {r.intitule}
                  </td>
                  <td className="px-3 py-1.5" style={{ fontSize: 11, fontWeight: 600, color: getProbabiliteColor(r.probabilite) }}>
                    {getProbabiliteLabel(r.probabilite)}
                  </td>
                  <td className="px-3 py-1.5" style={{ fontSize: 11, fontWeight: 600, color: getImpactColor(r.impact) }}>
                    {getImpactLabel(r.impact)}
                  </td>
                  <td className="px-3 py-1.5" style={{ fontSize: 11, color: "#374151" }}>
                    {r.mitigation || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADHÉRENCES ───────────────────────────────────────────────────────── */}
      {(chantier.adherencesSource.length > 0 || chantier.adherencesDependant.length > 0) && (() => {
        const CRITICITE_ORDER: Record<string, number> = { BLOQUANTE: 0, FORTE: 1, "MODÉRÉE": 2, FAIBLE: 3 };
        const rows = [
          ...chantier.adherencesDependant.map((a) => ({ ...a, direction: "entrante" as const })),
          ...chantier.adherencesSource.map((a) => ({ ...a, direction: "sortante" as const })),
        ].sort((a, b) => (CRITICITE_ORDER[a.criticite] ?? 9) - (CRITICITE_ORDER[b.criticite] ?? 9));

        return (
          <div className="mx-5 my-3 rounded-md overflow-hidden" style={{ border: "1.5px solid #6366f1" }}>
            <div className="px-4 py-2" style={{ backgroundColor: "#eef2ff" }}>
              <span className="font-bold" style={{ fontSize: 12, color: "#3730a3" }}>
                Adhérences — Dépendances du chantier ({rows.length})
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#e0e7ff" }}>
                  {["Sens", "Chantier lié", "Type", "Criticité", "Statut"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-1.5"
                      style={{ fontSize: 11, color: "#3730a3", fontWeight: 600, borderBottom: "1px solid #c7d2fe" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => {
                  const isEntrante = a.direction === "entrante";
                  const linkedChantier = isEntrante
                    ? `${a.chantierSource.code} — ${a.chantierSource.nom}`
                    : a.chantierDependant
                    ? `${a.chantierDependant.code} — ${a.chantierDependant.nom}`
                    : a.chantierDependantLabel || "Tous chantiers";
                  return (
                    <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? "#f5f7ff" : "#eef2ff" }}>
                      {/* Direction arrow */}
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <svg viewBox="0 0 20 20" width={18} height={18} fill="none">
                            {isEntrante ? (
                              /* → entrante green */
                              <path d="M5 10h10m0 0l-4-4m4 4l-4 4" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            ) : (
                              /* ← sortante red */
                              <path d="M15 10H5m0 0l4-4m-4 4l4 4" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            )}
                          </svg>
                          <span style={{ fontSize: 10, fontWeight: 600, color: isEntrante ? "#16a34a" : "#dc2626" }}>
                            {isEntrante ? "Entrante" : "Sortante"}
                          </span>
                        </div>
                      </td>
                      {/* Chantier lié */}
                      <td className="px-3 py-1.5" style={{ fontSize: 11, color: "#1e293b", maxWidth: 280 }}>
                        {linkedChantier}
                      </td>
                      {/* Type */}
                      <td className="px-3 py-1.5">
                        <span
                          className="px-1.5 py-0.5 rounded text-white"
                          style={{ fontSize: 10, backgroundColor: ADHERENCE_TYPE_COLORS[a.type] ?? "#6b7280" }}
                        >
                          {a.type}
                        </span>
                      </td>
                      {/* Criticité */}
                      <td className="px-3 py-1.5">
                        <span style={{ fontSize: 11, fontWeight: 700, color: ADHERENCE_CRITICITE_COLORS[a.criticite] ?? "#64748b" }}>
                          {a.criticite}
                        </span>
                      </td>
                      {/* Statut */}
                      <td className="px-3 py-1.5">
                        <span
                          className="px-1.5 py-0.5 rounded"
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: ADHERENCE_STATUT_COLORS[a.statut] ?? "#64748b",
                            backgroundColor: (ADHERENCE_STATUT_COLORS[a.statut] ?? "#64748b") + "18",
                          }}
                        >
                          {a.statut}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── JALON TIMELINE ───────────────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-5">
        <div className="flex items-center justify-between mb-3">
          <span
            className="font-bold tracking-wide"
            style={{ fontSize: 11, color: "#374151" }}
          >
            JALONS — PHASE {activePhase.toUpperCase()} ({phaseStats.atteints}/{phaseStats.total} atteints)
          </span>
          <span
            className="px-2 py-0.5 rounded text-white"
            style={{ fontSize: 10, backgroundColor: "#1e3a5f" }}
          >
            {format(new Date(chantier.date_debut), "dd/MM/yyyy")} → {format(new Date(chantier.date_fin), "dd/MM/yyyy")}
          </span>
        </div>
        <JalonTimeline jalons={phaseJalons} />
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <div
        className="px-6 py-2 flex items-center justify-between"
        style={{ backgroundColor: "#f1f5f9", borderTop: "1px solid #e2e8f0" }}
      >
        <span style={{ fontSize: 10, color: "#94a3b8" }}>
          Rapport généré le {format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
        </span>
        {chantier.budgetTotalMAD > 0 && (
          <span style={{ fontSize: 10, color: "#64748b" }}>
            Budget total:{" "}
            <strong>{formatMADCompact(chantier.budgetTotalMAD)}</strong>
            {budgetConsomme !== null && (
              <span style={{ marginLeft: 8 }}>
                Consommé: <strong>{budgetConsomme}%</strong>
              </span>
            )}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#94a3b8" }}>
          {chantier.code} — {chantier.domaine}
        </span>
      </div>
    </div>
  );
}
