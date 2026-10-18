import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FORECAST_HIGH_RISK_BELOW,
  FORECAST_HORIZONS,
  FORECAST_MIN_CELL,
  formatForecastDay,
  type RaidForecastPayload,
} from "@/lib/raid-forecast";

const RELIABILITY_LABEL = {
  validated: "Validé sur historique",
  validating: "En cours de validation",
  insufficient: "Données insuffisantes",
} as const;

/** Neuf colonnes de même largeur : le tableau tient dans la carte, sans défilement horizontal. */
const FORECAST_COLUMNS = [
  "11.12%",
  "11.11%",
  "11.11%",
  "11.11%",
  "11.11%",
  "11.11%",
  "11.11%",
  "11.11%",
  "11.11%",
] as const;

const FORECAST_HEADS = [
  "Code",
  "Intitulé",
  "Équipe",
  "Responsable",
  "Statut",
  "Échéance initiale",
  "Jours restants",
  "Probabilité de tenue",
  "Facteurs",
] as const;

const cellClass = "whitespace-normal break-words px-2 py-2 align-top text-xs leading-snug";

export function RaidForecastScreen({ data }: { data: RaidForecastPayload }) {
  const teamQuery = data.teamId ? `&equipe=${encodeURIComponent(data.teamId)}` : "";

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[90rem] space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 h-8 gap-1 px-0" asChild>
              <Link href="/raid/performance">
                <ArrowLeft className="size-4" />
                Performance des actions
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
                Aide à l&apos;anticipation
              </p>
              <span className="rounded border border-amber-600/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-950 dark:text-amber-50">
                EXPÉRIMENTAL
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
              Prévisions des engagements
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Les résultats présentés sont des estimations statistiques construites
              à partir de l&apos;historique disponible des actions RAID. Ils
              constituent une aide à l&apos;anticipation et ne remplacent pas les
              engagements formels ni l&apos;appréciation du Programme Office.
            </p>
          </div>
        </div>

        <form
          action="/raid/performance/previsions"
          className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3"
        >
          <div className="flex flex-wrap gap-1.5">
            {FORECAST_HORIZONS.map((horizon) => {
              const active = data.horizon === horizon;
              return (
                <Button
                  key={horizon}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={active ? "bg-[#0A3C74] hover:bg-[#0c4a8f]" : ""}
                  asChild
                >
                  <Link href={`/raid/performance/previsions?horizon=${horizon}${teamQuery}`}>
                    {horizon} prochains jours
                  </Link>
                </Button>
              );
            })}
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Équipe fonctionnelle
            <select
              name="equipe"
              defaultValue={data.teamId ?? ""}
              className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            >
              <option value="">Toutes les équipes</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.label}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="horizon" value={data.horizon} />
          <Button type="submit" size="sm" variant="outline">
            Appliquer
          </Button>
          <p className="w-full text-xs leading-relaxed text-muted-foreground">
            Engagements ouverts à échéance : 30 jours {data.volumes[30]} · 60 jours{" "}
            {data.volumes[60]} · 90 jours {data.volumes[90]}. Ces volumes décrivent
            le registre. Ce ne sont pas des prévisions.
          </p>
        </form>

        {data.reliability !== "validated" ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground">
            Les données historiques actuellement exploitables ne permettent pas
            encore de produire des prévisions suffisamment fiables. La collecte
            et la validation de l&apos;historique sont nécessaires avant
            activation des estimations.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card
            label="Tenue prévisionnelle"
            value={data.showProbabilities ? `${data.tenuePct} %` : "Prévisions non disponibles"}
            hint={
              data.showProbabilities
                ? `Moyenne des probabilités de ${data.scored} engagements scorés sur ${data.eligible} éligibles.`
                : data.reliability === "validated"
                  ? "Aucun engagement de cet horizon ne tombe dans un groupe comparable suffisant."
                  : "Aucun pourcentage n'est affiché sans modèle validé sur un bloc historique récent."
            }
          />
          <Card
            label="Engagements à échéance"
            value={String(data.eligible)}
            hint="Actions ouvertes, échéance initiale strictement future et dans l'horizon."
          />
          <Card
            label="Engagements à risque élevé"
            value={data.highRisk == null ? "Non calculable" : String(data.highRisk)}
            hint={`Seuil provisoire, non optimisé : tenue estimée inférieure à ${FORECAST_HIGH_RISK_BELOW} %.`}
          />
          <Card
            label="Fiabilité de la prévision"
            value={RELIABILITY_LABEL[data.reliability]}
            hint={data.history.reason}
          />
        </div>

        <section className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Déjà hors avenir : {data.overdue}{" "}
            {data.overdue > 1 ? "actions ouvertes" : "action ouverte"} dont
            l&apos;échéance initiale est aujourd&apos;hui ou déjà dépassée. Cette
            population ne reçoit pas de probabilité de tenue future.
          </p>
          <p className="mt-1">
            Sans échéance initiale : {data.undated}. Déjà terminées alors que
            l&apos;échéance initiale est encore dans l&apos;horizon : {data.terminalInHorizon}.
          </p>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-primary">
              {data.showProbabilities ? "Engagements à risque" : "Engagements à échéance dans l'horizon"}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {data.showProbabilities
                ? "Tri par probabilité de tenue croissante. Le responsable est indiqué pour ouvrir la fiche, pas pour être noté."
                : "Liste descriptive du registre. Aucune probabilité n'est calculée."}
            </p>
          </div>
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              {FORECAST_COLUMNS.map((width, index) => (
                <col key={FORECAST_HEADS[index]} style={{ width }} />
              ))}
            </colgroup>
            <thead className="border-b">
              <tr>
                {FORECAST_HEADS.map((label) => (
                  <th
                    key={label}
                    className="px-2 py-2 text-left align-bottom text-xs font-medium leading-tight break-words text-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-10 text-center text-muted-foreground">
                    Aucun engagement ouvert dont l&apos;échéance initiale se situe dans cet horizon.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className={cellClass}>
                      <Link href={`/raid/${row.id}`} className="font-medium break-all text-primary hover:underline">
                        {row.code}
                      </Link>
                    </td>
                    <td className={cellClass}>{row.intitule}</td>
                    <td className={cellClass}>{row.teamLabel}</td>
                    <td className={cellClass}>{row.responsable}</td>
                    <td className={cellClass}>{row.statut}</td>
                    <td className={`${cellClass} tabular-nums`}>
                      {formatForecastDay(row.initiale)}
                    </td>
                    <td className={`${cellClass} tabular-nums`}>{row.daysLeft}</td>
                    <td className={`${cellClass} tabular-nums`}>
                      {row.probability == null ? "Non calculable" : `${row.probability} %`}
                    </td>
                    <td className={`${cellClass} text-muted-foreground`}>
                      {row.factors ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="space-y-2 rounded-xl border bg-card p-4 text-sm leading-relaxed">
          <h2 className="text-sm font-semibold text-primary">
            Comment ces prévisions sont-elles calculées ?
          </h2>
          <p className="text-muted-foreground">
            Population observée : actions non supprimées, hors Doublon et NA, encore
            ouvertes à une date d&apos;observation située au plus {data.horizon} jours
            avant leur échéance initiale. L&apos;issue est connue seulement quand
            cette échéance est déjà passée.
          </p>
          <p className="text-muted-foreground">
            Période historique : {period(data)}. Apprentissage {data.history.trainN}{" "}
            · contrôle récent {data.history.testN}
            {data.history.scoredTest > 0 ? ` · scorés ${data.history.scoredTest}` : ""}.
            Engagements terminés reconstituables : {data.history.usable}. Sans journal
            exploitable : {data.history.unmeasured}
            {data.history.unmeasuredPct == null ? "" : ` (${data.history.unmeasuredPct} %)`}.
          </p>
          <p className="text-muted-foreground">
            Variables utilisées quand une probabilité est affichée : état de prise
            en charge connu à la date d&apos;observation, âge de l&apos;action, délai
            restant avant l&apos;échéance initiale. L&apos;équipe, le responsable,
            l&apos;échéance actualisée, la date de fin déclarée et updatedAt
            n&apos;entrent pas dans le calcul.
          </p>
          <p className="text-muted-foreground">
            Méthode : fréquence empirique du groupe comparable. Un groupe de moins
            de {FORECAST_MIN_CELL} issues est abandonné au profit d&apos;un groupe
            plus large, puis d&apos;aucune probabilité. Le filtre d&apos;équipe ne
            change pas le modèle : il restreint la liste. Ce n&apos;est pas une note
            d&apos;équipe ni de responsable, et ce n&apos;est pas une relation causale.
          </p>
          <p className="text-muted-foreground">
            Les probabilités ne sont publiées que si le journal couvre plus de la
            moitié des issues, si le contrôle récent bat le taux global, si
            l&apos;écart avec le taux observé reste d&apos;au plus 15 points, et
            si la moitié la plus risquée est réellement moins tenue. Décision : {data.history.reason}
            {data.history.brier == null
              ? ""
              : ` Brier ${data.history.brier} contre ${data.history.baselineBrier} pour le taux global. Tenue observée ${data.history.lowHoldPct} % dans la moitié basse, ${data.history.highHoldPct} % dans la moitié haute.`}
            {" "}Date de calcul : {formatForecastDay(data.calculatedOn)} (jour UTC).
          </p>
          <p className="text-muted-foreground">
            Limites : une fiche sans changement de statut journalisé n&apos;a pas
            d&apos;état passé reconstituable. Une suppression sort de l&apos;historique.
            Une réaffectation de chantier ou de responsable n&apos;est pas rejouée.
            Les probabilités affichées, lorsqu&apos;elles existent, sont recalculées
            sur tout l&apos;historique terminé ; la décision de les montrer repose
            sur le bloc récent tenu à l&apos;écart de cette décision.
          </p>
        </section>
      </main>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={
          value.length > 18
            ? "mt-2 text-lg font-bold leading-snug tracking-tight text-primary"
            : "mt-2 text-2xl font-bold tracking-tight text-primary"
        }
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

function period(data: RaidForecastPayload): string {
  if (!data.history.trainFrom || !data.history.testTo) {
    return "aucun bloc d'apprentissage retenu";
  }
  return `apprentissage ${formatForecastDay(data.history.trainFrom)} – ${formatForecastDay(data.history.trainTo)}, contrôle ${formatForecastDay(data.history.testFrom)} – ${formatForecastDay(data.history.testTo)}`;
}

