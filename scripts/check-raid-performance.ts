/**
 * Contrôles du lot 1 — performance des actions.
 * Exécution : npx tsx scripts/check-raid-performance.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RAID_PERF_MIN_DUE,
  RAID_PERF_NONE,
  buildRaidPerformance,
  daySpan,
  orderPerfGroups,
  parseMedianOrigin,
  perfCardHistory,
  resolvePerfWindow,
  toPerfInputs,
  withMedianOrigin,
  type PerfGroup,
  type PerfScreen,
  type RawPerfLog,
  type RawPerfRaid,
  type Tone,
} from "../lib/raid-performance";

const NOW = new Date("2026-10-18T12:00:00.000Z");
const SCREEN: PerfScreen = {
  basePath: "/raid/performance",
  backHref: "/raid",
  backLabel: "Registre RAID",
  heading: "Performance des actions",
  kicker: "Vue programme",
};

const MUTED: PerfGroup["tones"] = {
  tenue: "muted",
  prise: "muted",
  cycle: "muted",
  stock: "muted",
  glide: "muted",
};

function raid(
  over: Partial<RawPerfRaid> & { id: string; statut: string }
): RawPerfRaid {
  return {
    code: over.id,
    intitule: over.id,
    chantierId: "c1",
    teamLabel: "Alpha",
    teamCode: "A",
    responsableId: "r1",
    responsable: "Amina",
    createdAt: "2026-08-01T00:00:00.000Z",
    initiale: "2026-09-01T00:00:00.000Z",
    actualisee: null,
    dateFinReelle: null,
    ...over,
  };
}

function group(
  id: string,
  label: string,
  tenuePct: number | null,
  extra: Partial<PerfGroup> = {}
): PerfGroup {
  return {
    id,
    label,
    code: "",
    due: 5,
    held: 0,
    tenuePct,
    abandon: 0,
    missed: 0,
    unmeasured: 0,
    glide: 0,
    glidePct: null,
    priseMedian: null,
    priseN: 0,
    priseExcludedMissing: 0,
    priseExcludedInverted: 0,
    cycleMedian: null,
    cycleP90: null,
    cycleN: 0,
    blindPrise: 0,
    blindClose: 0,
    stockOpen: 0,
    stockOverdue: 0,
    stockPct: null,
    tones: MUTED,
    ...extra,
  };
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

check("fenêtres de même durée, 365 jours, trimestre non civil", () => {
  for (const preset of ["30", "90", "365", "quarter"] as const) {
    const window = resolvePerfWindow(NOW, preset);
    assert.equal(window.endDay, "2026-10-18");
    assert.equal(
      daySpan(window.startDay, window.endDay),
      daySpan(window.prevStartDay, window.prevEndDay)
    );
  }
  const quarter = resolvePerfWindow(NOW, "quarter");
  assert.equal(quarter.startDay, "2026-10-01");
  assert.equal(quarter.prevEndDay, "2026-09-30");
  assert.equal(quarter.prevStartDay, "2026-09-13");
  assert.notEqual(quarter.prevStartDay, "2026-07-01");
  const year = resolvePerfWindow(NOW, "365");
  assert.equal(daySpan(year.startDay, year.endDay) + 1, 365);
  const capped = resolvePerfWindow(NOW, "custom", "2026-10-01", "2026-12-31");
  assert.equal(capped.endDay, "2026-10-18");
  const fallback = resolvePerfWindow(NOW, "custom", "2026-11-01", "2026-12-31");
  assert.equal(fallback.preset, "90");
});

check("règles de tenue, de prise, de stock et d'exclusion", () => {
  const rows: RawPerfRaid[] = [
    raid({
      id: "early",
      statut: "Clôturé",
      createdAt: "2026-09-01T00:00:00.000Z",
      initiale: "2026-09-28T00:00:00.000Z",
      dateFinReelle: "2026-09-12T00:00:00.000Z",
    }),
    raid({
      id: "late",
      statut: "Clôturé",
      createdAt: "2026-08-20T00:00:00.000Z",
      initiale: "2026-09-01T00:00:00.000Z",
      actualisee: "2026-09-15T00:00:00.000Z",
      dateFinReelle: "2026-09-20T00:00:00.000Z",
    }),
    raid({
      id: "abandon",
      statut: "Abandonné",
      initiale: "2026-08-15T00:00:00.000Z",
      dateFinReelle: "2026-08-20T00:00:00.000Z",
    }),
    raid({
      id: "undated",
      statut: "Clôturé",
      initiale: "2026-08-10T00:00:00.000Z",
    }),
    raid({
      id: "due-today",
      statut: "En cours",
      createdAt: "2026-10-01T00:00:00.000Z",
      initiale: "2026-10-18T00:00:00.000Z",
    }),
    raid({
      id: "old-stock",
      statut: "En cours",
      chantierId: "c2",
      teamLabel: "Beta",
      teamCode: "B",
      createdAt: "2026-01-01T00:00:00.000Z",
      initiale: "2026-01-15T00:00:00.000Z",
      actualisee: "2026-02-01T00:00:00.000Z",
    }),
    raid({
      id: "prev-glide",
      statut: "Clôturé",
      createdAt: "2026-05-01T00:00:00.000Z",
      initiale: "2026-06-01T00:00:00.000Z",
      actualisee: "2026-06-15T00:00:00.000Z",
      dateFinReelle: "2026-06-20T00:00:00.000Z",
    }),
    raid({ id: "doublon", statut: "Doublon" }),
    raid({ id: "na", statut: "NA", initiale: null }),
    raid({
      id: "waiting",
      statut: "Planifié",
      initiale: null,
    }),
  ];
  const logs: RawPerfLog[] = [
    { raidId: "early", newValue: "En cours", createdAt: "2026-09-08T00:00:00.000Z" },
    { raidId: "late", newValue: "En cours", createdAt: "2026-08-22T00:00:00.000Z" },
    { raidId: "undated", newValue: "En cours", createdAt: "2026-08-02T00:00:00.000Z" },
  ];
  const inputs = toPerfInputs(rows, logs);
  assert.deepEqual(
    inputs.map((row) => row.id).sort(),
    [
      "abandon",
      "due-today",
      "early",
      "late",
      "old-stock",
      "prev-glide",
      "undated",
      "waiting",
    ]
  );
  const view = buildRaidPerformance(
    inputs,
    resolvePerfWindow(NOW, "90"),
    NOW,
    null,
    SCREEN
  );
  const programme = view.programme;
  assert.equal(programme.due, 4);
  assert.equal(programme.held, 1);
  assert.equal(programme.missed, 1);
  assert.equal(programme.abandon, 1);
  assert.equal(programme.unmeasured, 1);
  assert.equal(programme.blindClose, 1);
  assert.equal(programme.tenuePct, 25);
  assert.equal(programme.glide, 1);
  assert.equal(programme.priseN, 3);
  assert.equal(programme.priseMedian, 2);
  assert.notEqual(programme.priseMedian, 0);
  assert.equal(programme.cycleN, 2);
  assert.equal(programme.cycleMedian, 17);
  assert.equal(programme.cycleP90, 29);
  assert.equal(programme.stockOpen, 2);
  assert.equal(programme.stockOverdue, 1);
  assert.equal(programme.stockPct, 50);
  assert.equal(view.previous.glide, 1);
  assert.equal(view.previous.glidePct, 100);
  assert.equal(typeof view.previous.stockOverdue, "number");
  assert.ok(view.previous.stockOverdue >= 1);
  assert.equal(view.medianOrigin, "creation");
  assert.equal(programme.priseExcludedMissing, 0);
  assert.equal(programme.priseExcludedInverted, 0);
  assert.equal(view.evidence.tenue.length, programme.due);
  assert.equal(view.evidence.glide.length, programme.due);
  assert.equal(view.evidence.prise.length, programme.priseN);
  assert.equal(view.evidence.cycle.length, programme.cycleN);
  assert.equal(view.evidence.stock.length, programme.stockOverdue);
  assert.equal(view.priseOrigins.creation.median, programme.priseMedian);
  assert.equal(view.priseOrigins.creation.n, programme.priseN);
  const withoutIdentification = buildRaidPerformance(
    inputs,
    resolvePerfWindow(NOW, "90"),
    NOW,
    null,
    SCREEN,
    "identification"
  );
  assert.equal(withoutIdentification.programme.priseN, 0);
  assert.equal(withoutIdentification.programme.priseMedian, null);
  assert.equal(withoutIdentification.programme.priseExcludedMissing, 3);
  assert.equal(withoutIdentification.programme.priseExcludedInverted, 0);
  assert.equal(withoutIdentification.programme.cycleMedian, programme.cycleMedian);
  assert.equal(withoutIdentification.programme.cycleN, programme.cycleN);
  assert.equal(withoutIdentification.programme.tenuePct, programme.tenuePct);
  assert.equal(withoutIdentification.programme.stockOverdue, programme.stockOverdue);
  assert.equal(withoutIdentification.programme.glide, programme.glide);
  assert.equal(withoutIdentification.evidence.prise.length, 0);
  assert.equal(withoutIdentification.evidence.cycle.length, programme.cycleN);
});

check("origine identification : exclusions, délai 0 conservé en création, cycle inchangé", () => {
  assert.equal(parseMedianOrigin(undefined), "creation");
  assert.equal(parseMedianOrigin("creation"), "creation");
  assert.equal(parseMedianOrigin("identification"), "identification");
  assert.equal(parseMedianOrigin("autre"), "creation");
  assert.equal(withMedianOrigin("preset=90", "creation"), "preset=90");
  assert.equal(
    withMedianOrigin("preset=90", "identification"),
    "preset=90&origine=identification"
  );
  assert.equal(withMedianOrigin("", "identification"), "origine=identification");

  const rows: RawPerfRaid[] = [
    raid({
      id: "measured",
      code: "A",
      statut: "En cours",
      createdAt: "2026-09-01T00:00:00.000Z",
      dateIdentification: "2026-08-01T00:00:00.000Z",
    }),
    raid({
      id: "missing",
      code: "B",
      statut: "En cours",
      createdAt: "2026-09-01T00:00:00.000Z",
      dateIdentification: null,
    }),
    raid({
      id: "inverted",
      code: "C",
      statut: "En cours",
      createdAt: "2026-08-01T00:00:00.000Z",
      dateIdentification: "2026-09-20T00:00:00.000Z",
    }),
    raid({
      id: "closed",
      code: "D",
      statut: "Clôturé",
      createdAt: "2026-09-01T00:00:00.000Z",
      dateIdentification: null,
      dateFinReelle: "2026-09-12T00:00:00.000Z",
    }),
    raid({
      id: "clamped",
      code: "E",
      statut: "En cours",
      createdAt: "2026-09-20T00:00:00.000Z",
      dateIdentification: "2026-09-01T00:00:00.000Z",
    }),
  ];
  const logs: RawPerfLog[] = [
    { raidId: "measured", newValue: "En cours", createdAt: "2026-09-10T00:00:00.000Z" },
    { raidId: "missing", newValue: "En cours", createdAt: "2026-09-05T00:00:00.000Z" },
    { raidId: "inverted", newValue: "En cours", createdAt: "2026-09-10T00:00:00.000Z" },
    { raidId: "closed", newValue: "En cours", createdAt: "2026-09-02T00:00:00.000Z" },
    { raidId: "clamped", newValue: "En cours", createdAt: "2026-09-10T00:00:00.000Z" },
  ];
  const inputs = toPerfInputs(rows, logs);
  const window = resolvePerfWindow(NOW, "90");
  const creation = buildRaidPerformance(inputs, window, NOW, null, SCREEN, "creation");
  const identification = buildRaidPerformance(
    inputs,
    window,
    NOW,
    null,
    SCREEN,
    "identification"
  );
  assert.equal(creation.programme.priseN, 5);
  assert.equal(creation.programme.priseMedian, 4);
  assert.equal(creation.programme.priseExcludedMissing, 0);
  assert.equal(creation.programme.priseExcludedInverted, 0);
  assert.equal(
    creation.evidence.prise.find((row) => row.id === "clamped")?.calcul,
    "0 j"
  );
  assert.equal(identification.programme.priseN, 2);
  assert.equal(identification.programme.priseMedian, 25);
  assert.equal(identification.programme.priseExcludedMissing, 2);
  assert.equal(identification.programme.priseExcludedInverted, 1);
  assert.deepEqual(
    identification.evidence.prise.map((row) => row.id),
    ["measured", "clamped"]
  );
  assert.equal(
    identification.evidence.prise.find((row) => row.id === "measured")?.calcul,
    "40 j"
  );
  assert.equal(creation.priseOrigins.identification.median, 25);
  assert.equal(creation.priseOrigins.identification.n, 2);
  assert.equal(identification.priseOrigins.creation.median, 4);
  assert.equal(creation.programme.cycleMedian, 10);
  assert.equal(identification.programme.cycleMedian, 10);
  assert.equal(creation.programme.cycleN, 1);
  assert.equal(identification.programme.cycleN, 1);
  assert.equal(creation.programme.tenuePct, identification.programme.tenuePct);
  assert.equal(creation.programme.stockOverdue, identification.programme.stockOverdue);
  assert.equal(creation.programme.glide, identification.programme.glide);
  assert.equal(creation.evidence.cycle.length, 1);
  assert.equal(identification.evidence.cycle.length, 1);
  assert.equal(identification.evidence.prise.length, identification.programme.priseN);
});

check("coloration à partir de cinq dues, ex æquo neutre", () => {
  const rows: RawPerfRaid[] = [];
  function add(
    team: string | null,
    label: string,
    count: number,
    held: number
  ) {
    for (let i = 0; i < count; i += 1) {
      const id = `${team}-${i}`;
      const onTime = i < held;
      rows.push(
        raid({
          id,
          statut: "Clôturé",
          chantierId: team,
          teamLabel: label,
          teamCode: team ?? "",
          initiale: "2026-09-01T00:00:00.000Z",
          dateFinReelle: onTime
            ? "2026-08-20T00:00:00.000Z"
            : "2026-09-20T00:00:00.000Z",
        })
      );
    }
  }
  add("good", "Good", 5, 5);
  add("mid", "Mid", 5, 3);
  add("bad", "Bad", 5, 0);
  add("grey", "Grey", 4, 4);
  add(null, "Non rattaché", 4, 4);
  const view = buildRaidPerformance(
    toPerfInputs(rows, []),
    resolvePerfWindow(NOW, "90"),
    NOW,
    null,
    SCREEN
  );
  const toneOf = (id: string): Tone => {
    const team = view.teams.find((row) => row.id === id);
    assert.ok(team);
    return team.tones.tenue;
  };
  assert.equal(toneOf("good"), "good");
  assert.equal(toneOf("mid"), "mid");
  assert.equal(toneOf("bad"), "bad");
  assert.equal(toneOf("grey"), "muted");
  assert.equal(toneOf(RAID_PERF_NONE), "muted");
  assert.equal(view.colorMedian.tenue, 60);
  assert.equal(view.teams.at(-1)?.id, RAID_PERF_NONE);
  assert.ok(
    (view.teams.find((row) => row.id === "grey")?.due ?? 0) < RAID_PERF_MIN_DUE
  );
});

check("Non rattaché reste dernier dans tous les tris", () => {
  const rows = [
    group(RAID_PERF_NONE, "Non rattaché", 90),
    group("b", "Bravo", 10),
    group("a", "Alpha", 10),
    group("c", "Charlie", null, { due: 0, tenuePct: null }),
  ];
  for (const key of ["label", "due", "tenue", "prise", "stock", "glide", "abandon"] as const) {
    for (const dir of ["asc", "desc"] as const) {
      const ordered = orderPerfGroups(rows, { key, dir });
      assert.equal(ordered.at(-1)?.id, RAID_PERF_NONE, `${key} ${dir}`);
    }
  }
  const asc = orderPerfGroups(rows, { key: "tenue", dir: "asc" }).map((row) => row.id);
  assert.deepEqual(asc, ["a", "b", "c", RAID_PERF_NONE]);
  const desc = orderPerfGroups(rows, { key: "tenue", dir: "desc" }).map((row) => row.id);
  assert.deepEqual(desc, ["a", "b", "c", RAID_PERF_NONE]);
  const byName = orderPerfGroups(rows, { key: "label", dir: "asc" }).map((row) => row.label);
  assert.deepEqual(byName, ["Alpha", "Bravo", "Charlie", "Non rattaché"]);
  assert.equal(orderPerfGroups(rows, null)[0]?.id, RAID_PERF_NONE);
});

check("écarts historiques masqués, libellés du lot 1", () => {
  assert.equal(perfCardHistory("tenue"), "delta");
  assert.equal(perfCardHistory("prise"), "delta");
  assert.equal(perfCardHistory("cycle"), "delta");
  assert.equal(perfCardHistory("stock"), "unavailable");
  assert.equal(perfCardHistory("glide"), "unavailable");

  const screen = readFileSync("components/raid-performance-screen.tsx", "utf8");
  assert.match(screen, /Engagements tenus à l'échéance initiale/);
  assert.match(screen, /toutes échéances confondues/);
  assert.match(screen, /Échéances reportées/);
  assert.match(screen, /photographie actuelle/);
  assert.match(screen, /Évolution historique non disponible/);
  assert.match(screen, /Comparaison avec la période précédente de même durée/);
  assert.match(screen, /par rapport à la période précédente de même durée/);
  assert.match(screen, /90 % ont duré au plus/);
  assert.match(screen, /L'écart sous le chiffre compare la médiane, pas ce décile/);
  assert.match(screen, /photographie historique figée/);
  assert.match(screen, /Activité et respect des engagements/);
  assert.match(screen, /événements datés/);
  assert.match(screen, /Autres écarts/);
  assert.match(screen, /hors abandons et clôtures sans date de fin/);
  assert.match(screen, /12 mois \(365 jours glissants\)/);
  assert.match(screen, /volume insuffisant/);
  assert.match(screen, /base :\s*tenue/);
  assert.match(screen, /actions dues/);
  assert.match(screen, /Origine de la médiane de prise en charge/);
  assert.match(screen, /Date de création/);
  assert.match(screen, /Date d'identification/);
  assert.match(screen, /Voir le détail du calcul/);
  assert.match(screen, /ne changent pas avec ce choix/);
  assert.match(screen, /withMedianOrigin/);
  assert.match(screen, /Les délais du tableau sont triés/);
  assert.match(screen, /name="origine"/);
  assert.doesNotMatch(screen, /En écart/);
  assert.doesNotMatch(screen, /Rythme sur la période/);
  assert.doesNotMatch(screen, /"Glissement"/);

  const load = readFileSync("lib/raid-performance-load.ts", "utf8");
  assert.match(load, /deletedAt:\s*null/);
  assert.match(load, /Doublon/);
  assert.match(load, /canSeeRaidPerformance/);
});

console.log("raid-performance checks ok");
