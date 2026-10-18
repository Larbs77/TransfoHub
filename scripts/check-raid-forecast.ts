/**
 * Contrôles du lot 2 — prévisions des engagements.
 * Exécution : npx tsx scripts/check-raid-forecast.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addDays } from "../lib/raid-performance";
import {
  buildForecastTraining,
  buildRaidForecast,
  type ForecastAudit,
  type ForecastRaid,
} from "../lib/raid-forecast";

const NOW = new Date("2026-10-18T12:00:00.000Z");

function raid(over: Partial<ForecastRaid> & { id: string; statut: string }): ForecastRaid {
  return {
    code: over.id,
    intitule: over.id,
    chantierId: "c1",
    teamLabel: "Alpha",
    responsable: "Amina",
    createdAt: "2026-08-01T00:00:00.000Z",
    initiale: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

function pattern(count = 80): { raids: ForecastRaid[]; audits: ForecastAudit[] } {
  const raids: ForecastRaid[] = [];
  const audits: ForecastAudit[] = [];
  for (let i = 0; i < count; i += 1) {
    const initiale = addDays("2025-06-01", i * 3);
    const created = addDays(initiale, -40);
    const waiting = i % 2 === 0;
    const id = `p${String(i).padStart(3, "0")}`;
    raids.push(
      raid({
        id,
        statut: waiting ? "Planifié" : "Clôturé",
        createdAt: `${created}T00:00:00.000Z`,
        initiale: `${initiale}T00:00:00.000Z`,
      })
    );
    audits.push({
      raidId: id,
      oldValue: "A planifier",
      newValue: waiting ? "Planifié" : "En cours",
      createdAt: `${addDays(created, 1)}T00:00:00.000Z`,
    });
    if (!waiting) {
      audits.push({
        raidId: id,
        oldValue: "En cours",
        newValue: "Clôturé",
        createdAt: `${addDays(initiale, -2)}T00:00:00.000Z`,
      });
    }
  }
  return { raids, audits };
}

check("le journal passé ignore une clôture ultérieure", () => {
  const rows = buildForecastTraining(
    [
      raid({
        id: "late-close",
        statut: "Clôturé",
        createdAt: "2026-01-01T00:00:00.000Z",
        initiale: "2026-03-15T00:00:00.000Z",
      }),
    ],
    [
      {
        raidId: "late-close",
        oldValue: "A planifier",
        newValue: "Planifié",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
      {
        raidId: "late-close",
        oldValue: "Planifié",
        newValue: "En cours",
        createdAt: "2026-02-20T00:00:00.000Z",
      },
      {
        raidId: "late-close",
        oldValue: "En cours",
        newValue: "Clôturé",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ],
    30,
    NOW
  );
  assert.equal(rows.unmeasured, 0);
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]?.prise, "attente");
  assert.equal(rows.rows[0]?.held, true);
});

check("une fiche déjà close à la date d'observation ne sert pas d'exemple", () => {
  const rows = buildForecastTraining(
    [
      raid({
        id: "already",
        statut: "Clôturé",
        createdAt: "2026-01-01T00:00:00.000Z",
        initiale: "2026-03-15T00:00:00.000Z",
      }),
    ],
    [
      {
        raidId: "already",
        oldValue: "A planifier",
        newValue: "Clôturé",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ],
    30,
    NOW
  );
  assert.equal(rows.rows.length, 0);
  assert.equal(rows.unmeasured, 0);
});

check("sans journal, pas de probabilité fictive", () => {
  const view = buildRaidForecast(
    [
      raid({
        id: "gap",
        statut: "Clôturé",
        createdAt: "2026-01-01T00:00:00.000Z",
        initiale: "2026-02-01T00:00:00.000Z",
      }),
      raid({
        id: "future",
        statut: "En cours",
        createdAt: "2026-10-01T00:00:00.000Z",
        initiale: "2026-11-01T00:00:00.000Z",
      }),
      raid({ id: "bare", statut: "En cours", initiale: null }),
      raid({
        id: "late",
        statut: "En cours",
        initiale: "2026-10-01T00:00:00.000Z",
      }),
      raid({ id: "doublon", statut: "Doublon", initiale: "2026-11-01T00:00:00.000Z" }),
      raid({ id: "na", statut: "NA", initiale: null }),
      raid({
        id: "gone",
        statut: "En cours",
        initiale: "2026-11-02T00:00:00.000Z",
        deletedAt: "2026-10-02T00:00:00.000Z",
      }),
    ],
    [],
    NOW,
    30,
    null
  );
  assert.equal(view.reliability, "insufficient");
  assert.equal(view.showProbabilities, false);
  assert.equal(view.tenuePct, null);
  assert.equal(view.highRisk, null);
  assert.equal(view.history.unmeasured, 2);
  assert.equal(view.undated, 1);
  assert.equal(view.overdue, 1);
  assert.equal(view.eligible, 1);
  assert.equal(view.rows[0]?.id, "future");
  assert.equal(view.rows[0]?.probability, null);
  assert.equal(view.rows[0]?.factors, null);
});

check("la date de fin déclarée ne fabrique pas une tenue", () => {
  const declared = {
    ...raid({
      id: "declared",
      statut: "En cours",
      createdAt: "2026-01-01T00:00:00.000Z",
      initiale: "2026-03-15T00:00:00.000Z",
    }),
    dateFinReelle: "2026-03-01T00:00:00.000Z",
  };
  const rows = buildForecastTraining(
    [declared],
    [
      {
        raidId: "declared",
        oldValue: "A planifier",
        newValue: "En cours",
        createdAt: "2026-01-05T00:00:00.000Z",
      },
    ],
    30,
    NOW
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]?.held, false);
  assert.equal(rows.rows[0]?.prise, "prise");
});

check("un historique séparable active des probabilités déterministes", () => {
  const base = pattern();
  const liveWaiting = raid({
    id: "live-wait",
    code: "L-WAIT",
    statut: "Planifié",
    chantierId: "c1",
    teamLabel: "Alpha",
    createdAt: "2026-10-01T00:00:00.000Z",
    initiale: "2026-11-10T00:00:00.000Z",
  });
  const livePrise = raid({
    id: "live-prise",
    code: "L-PRISE",
    statut: "En cours",
    chantierId: "c2",
    teamLabel: "Beta",
    createdAt: "2026-10-01T00:00:00.000Z",
    initiale: "2026-11-12T00:00:00.000Z",
  });
  const liveBlind = raid({
    id: "live-blind",
    code: "L-BLIND",
    statut: "En cours",
    createdAt: "2026-10-01T00:00:00.000Z",
    initiale: "2026-11-08T00:00:00.000Z",
  });
  const far = raid({
    id: "far",
    statut: "Planifié",
    createdAt: "2026-10-01T00:00:00.000Z",
    initiale: "2026-12-20T00:00:00.000Z",
  });
  const audits: ForecastAudit[] = [
    ...base.audits,
    {
      raidId: "live-wait",
      oldValue: "A planifier",
      newValue: "Planifié",
      createdAt: "2026-10-02T00:00:00.000Z",
    },
    {
      raidId: "live-prise",
      oldValue: "A planifier",
      newValue: "En cours",
      createdAt: "2026-10-02T00:00:00.000Z",
    },
    {
      raidId: "far",
      oldValue: "A planifier",
      newValue: "Planifié",
      createdAt: "2026-10-02T00:00:00.000Z",
    },
  ];
  const raids = [...base.raids, liveWaiting, livePrise, liveBlind, far];
  const first = buildRaidForecast(raids, audits, NOW, 30, null);
  const second = buildRaidForecast(raids, audits, NOW, 30, null);
  assert.deepEqual(first, second);
  assert.equal(first.reliability, "validated");
  assert.equal(first.showProbabilities, true);
  assert.ok((first.history.brier ?? 1) < (first.history.baselineBrier ?? 0));
  assert.ok((first.history.highHoldPct ?? 0) - (first.history.lowHoldPct ?? 100) >= 10);
  const waiting = first.rows.find((row) => row.id === "live-wait");
  const prise = first.rows.find((row) => row.id === "live-prise");
  const blind = first.rows.find((row) => row.id === "live-blind");
  assert.ok(waiting && prise && blind);
  assert.equal(waiting.probability, 0);
  assert.equal(prise.probability, 100);
  assert.equal(blind.probability, null);
  assert.equal(blind.factors, null);
  assert.ok(waiting.factors?.includes("salle d'attente"));
  assert.equal(waiting.factors?.includes("Alpha"), false);
  assert.equal(waiting.factors?.includes("Amina"), false);
  assert.equal(first.rows[0]?.id, "live-wait");
  assert.equal(first.highRisk, 1);
  assert.equal(first.rows.some((row) => row.id === "far"), false);
  assert.equal(first.volumes[30], 3);
  assert.equal(first.volumes[60] >= 3, true);

  const narrow = buildRaidForecast(raids, audits, NOW, 30, "c2");
  assert.deepEqual(
    narrow.rows.map((row) => row.id),
    ["live-prise"]
  );
  assert.equal(narrow.history.usable, first.history.usable);

  const longer = buildRaidForecast(raids, audits, NOW, 90, null);
  assert.equal(longer.rows.some((row) => row.id === "far"), true);
});

check("l'écran et la route restent hors du menu et hors des KPI", () => {
  const screen = readFileSync("components/raid-forecast-screen.tsx", "utf8");
  const perf = readFileSync("components/raid-performance-screen.tsx", "utf8");
  const load = readFileSync("lib/raid-forecast-load.ts", "utf8");
  const gate = readFileSync("app/(app)/raid/performance/[chantierId]/page.tsx", "utf8");
  assert.match(screen, /EXPÉRIMENTAL/);
  assert.match(screen, /Prévisions non disponibles/);
  assert.match(screen, /Comment ces prévisions sont-elles calculées/);
  assert.match(screen, /w-full table-fixed border-collapse/);
  assert.doesNotMatch(screen, /overflow-x-auto/);
  assert.doesNotMatch(screen, /whitespace-nowrap/);
  assert.match(perf, /Prévisions des engagements/);
  assert.match(load, /deletedAt:\s*null/);
  assert.match(load, /requireRaidPerformance|buildRaidForecast/);
  assert.match(gate, /previsions/);
  assert.doesNotMatch(readFileSync("lib/raid-performance.ts", "utf8"), /buildRaidForecast/);
  assert.doesNotMatch(readFileSync("lib/app-pages.ts", "utf8"), /previsions/);
});

console.log("raid-forecast checks ok");
