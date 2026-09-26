import type { Metadata } from "next";

/* ---------------------------------------------------------------------------
 * i18n — Phase 1 (see docs/I18N-PLAN.md in the project notes).
 *
 * Two locales, mirrored routes: English lives at the root (unchanged URLs),
 * Finnish lives under /fi/... (app/fi/*). This file is the single source of
 * interface strings — every hardcoded English label in a component or page
 * should move here rather than live inline, the same instinct as schema.ts
 * making data correctness mechanical instead of a matter of discipline.
 *
 * `Dictionary` is a hand-written interface (not `typeof en`) precisely so
 * `en` and `fi` can hold different string literals while TypeScript still
 * enforces that both satisfy the exact same shape — a missing or
 * mistyped Finnish key is a compile error, not a silent runtime fallback.
 * ------------------------------------------------------------------------- */

export const LOCALES = ["en", "fi"] as const;
export type Locale = (typeof LOCALES)[number];

export interface Dictionary {
  meta: {
    description: string;
    ogLocale: "en_US" | "fi_FI";
    htmlLang: string;
  };
  footer: {
    links: { latest: string; stats: string; rounds: string; calibration: string; method: string };
    statement: string;
    credit: string;
  };
  nav: {
    leagueGroup: string;
    switchTo: string;
  };
  common: {
    correct: string;
    meanRps: string;
    drawsActExp: string;
    expected: string;
    actual: string;
    z: string;
    withinNoise: string;
    outsideNoise: string;
    scoredSuffix: (n: number) => string;
    latestSuffix: string;
    playedOf: (played: number, total: number) => string;
    reviewArrow: string;
    allRoundsArrow: string;
    fullCouponArrow: string;
    matchweekHeading: (n: number) => string;
    matchweekTitle: (n: number) => string;
    matchweeksAria: string;
    rowsCount: (n: number) => string;
    noForecast: string;
    notYetPlayed: string;
    hit: string;
    miss: string;
    dash: string;
  };
  home: {
    thisWeeksCoupon: string;
    singleRow: string;
    system: (type: string, singles: number, doubles: number, rows: number) => string;
    expectedOf13: (n: string) => string;
    lastRound: string;
    noRoundsYet: string;
    byLeague: string;
    noData: string;
    mwProgress: (n: number, played: number, total: number) => string;
  };
  matchweekPage: {
    scoring: string;
    notes: string;
    season: string;
    tableThrough: (n: number) => string;
    translationPending: string;
  };
  roundsIndex: {
    metaTitle: string;
    archive: string;
    title: string;
    lede: string;
    roundsSettled: string;
    open: (n: number) => string;
    noRoundsYet: string;
  };
  roundPage: {
    label: (id: string) => string;
    system: (type: string, singles: number, doubles: number, triples: number, rows: number) => string;
    outcome: string;
    probability: string;
    odds: string;
    allCovered: (k: number) => string;
    exactly: (k: number) => string;
    oneIn: (n: number) => string;
    expectedSub: (n: string) => string;
    review: string;
    allRounds: string;
    otherRoundsAria: string;
    translationPending: string;
  };
  calibration: {
    metaTitle: string;
    seasonToDate: (label: string) => string;
    title: string;
    lede: string;
    smallSample: (n: number) => string;
    reliability: string;
    reliabilityH2: string;
    reliabilityLede: string;
    band: string;
    n: string;
    predicted: string;
    observed: string;
    noScoredYet: string;
    drawWatch: string;
    drawWatchH2: string;
    drawWatchLede: string;
    overNMatches: (n: number) => string;
    baseRates: string;
    outcomeMix: string;
    outcomeMixLede: string;
    homeWins: string;
    draws: string;
    awayWins: string;
  };
  method: {
    metaTitle: string;
    label: string;
    h1: string;
    lede: string;
    forecastH2: string;
    forecastP: string;
    rpsH2: string;
    rpsP1: string;
    rpsP2: string;
    drawWatchH2: string;
    drawWatchP: string;
    wontH2: string;
    wontItems: string[];
  };
  stats: {
    metaTitle: string;
    seasonToDate: (label: string) => string;
    title: string;
    lede: string;
    noStatsYet: string;
  };
  standings: {
    team: string;
    p: string;
    w: string;
    d: string;
    l: string;
    gd: string;
    pts: string;
  };
  roundCard: {
    correct: string;
    awaitingResults: string;
    playedOf: (played: number, total: number) => string;
  };
}

const en: Dictionary = {
  meta: {
    description:
      "Results, forecasts and calibration for the Premier League, Championship and League One.",
    ogLocale: "en_US",
    htmlLang: "en",
  },
  footer: {
    links: { latest: "Latest", stats: "Stats", rounds: "Rounds", calibration: "Calibration", method: "Method" },
    statement:
      "Strictlane is a personal ledger — football forecasts made before kickoff for the " +
      "Premier League, Championship, and League One, scored over time on their own terms. " +
      "Hits and misses both stay on the record.",
    credit: "Built by Markku Hihnala · © 2026 Strictlane/Markku Hihnala. All Rights Reserved.",
  },
  nav: {
    leagueGroup: "League",
    switchTo: "Suomeksi",
  },
  common: {
    correct: "Correct",
    meanRps: "Mean RPS",
    drawsActExp: "Draws act/exp",
    expected: "Expected",
    actual: "Actual",
    z: "z",
    withinNoise: "within noise",
    outsideNoise: "outside noise",
    scoredSuffix: (n) => `${n} scored`,
    latestSuffix: " · latest",
    playedOf: (played, total) => `${played}/${total} played`,
    reviewArrow: "Review →",
    allRoundsArrow: "All rounds →",
    fullCouponArrow: "Full coupon →",
    matchweekHeading: (n) => `Matchweek ${n}`,
    matchweekTitle: (n) => `Matchweek ${n}`,
    matchweeksAria: "Matchweeks",
    rowsCount: (n) => `${n} rows`,
    noForecast: "No forecast",
    notYetPlayed: "Not yet played",
    hit: "Hit",
    miss: "Miss",
    dash: "—",
  },
  home: {
    thisWeeksCoupon: "This week's coupon",
    singleRow: "Single row",
    system: (type, singles, doubles, rows) =>
      `${type} · ${singles} singles, ${doubles} doubles · ${rows} rows`,
    expectedOf13: (n) => ` · ${n} of 13 expected`,
    lastRound: "Last round",
    noRoundsYet: "No coupon rounds logged yet.",
    byLeague: "By league",
    noData: "No data",
    mwProgress: (n, played, total) => `MW ${n} · ${played}/${total}`,
  },
  matchweekPage: {
    scoring: "Scoring",
    notes: "Notes",
    season: "Season",
    tableThrough: (n) => `Table · through MW${n}`,
    translationPending: "Suomenkielinen käännös tulossa. Englanninkielinen versio näytetään toistaiseksi.",
  },
  roundsIndex: {
    metaTitle: "Coupon rounds",
    archive: "Archive",
    title: "Coupon rounds",
    lede:
      "Every Lauantaivakio, kept permanently. A round cuts across leagues, so it is tracked " +
      "separately from the matchweek record — each one holds the marks played, what they " +
      "returned, and how the forecasts scored.",
    roundsSettled: "Rounds settled",
    open: (n) => `${n} open`,
    noRoundsYet: "No rounds logged yet.",
  },
  roundPage: {
    label: (id) => `Round · ${id}`,
    system: (type, singles, doubles, triples, rows) =>
      `${type} · ${singles} singles, ${doubles} doubles${triples ? `, ${triples} triples` : ""} · ${rows} rows`,
    outcome: "Outcome",
    probability: "Probability",
    odds: "Odds",
    allCovered: (k) => `All ${k} covered`,
    exactly: (k) => `Exactly ${k}`,
    oneIn: (n) => `1 in ${n}`,
    expectedSub: (n) => `${n} expected`,
    review: "Review",
    allRounds: "All rounds",
    otherRoundsAria: "Other rounds",
    translationPending: "Suomenkielinen käännös tulossa. Englanninkielinen versio näytetään toistaiseksi.",
  },
  calibration: {
    metaTitle: "Calibration",
    seasonToDate: (label) => `Season to date · ${label}`,
    title: "Calibration",
    lede:
      "Raw accuracy is close to meaningless: it depends on which fixtures happened to be on the " +
      "coupon, and it rewards always backing the favourite. The number that matters is Ranked " +
      "Probability Score, tracked over time as a self-measure of forecast quality.",
    smallSample: (n) =>
      `${n} matches is far too small a sample to read much into the mean. A season-long ` +
      `log is what settles whether the forecasting is any good.`,
    reliability: "Reliability",
    reliabilityH2: "Do the percentages mean anything?",
    reliabilityLede:
      "Every forecast contributes three points, one per sign. If we are calibrated, predicted and " +
      "observed should track each other down the table.",
    band: "Band",
    n: "n",
    predicted: "Predicted",
    observed: "Observed",
    noScoredYet: "No scored forecasts yet.",
    drawWatch: "Draw watch",
    drawWatchH2: "Predicted draws vs actual",
    drawWatchLede:
      "Tracked separately because it is the failure this project has already walked into: a " +
      "coupon that excluded X on four soft favourites in a round that produced five draws. A " +
      "z-score inside ±2 is noise, not a bias worth correcting.",
    overNMatches: (n) => `over ${n} matches`,
    baseRates: "Base rates",
    outcomeMix: "Outcome mix",
    outcomeMixLede:
      "How the forecast matches actually resolved this season — the base rate any single " +
      "call is competing against.",
    homeWins: "Home wins",
    draws: "Draws",
    awayWins: "Away wins",
  },
  method: {
    metaTitle: "Method",
    label: "Method",
    h1: "How forecasts are made and scored",
    lede:
      "Strictlane is a ledger, not a tipping service. This page explains " +
      "the mechanism so the numbers elsewhere on the site can be checked, " +
      "not just trusted.",
    forecastH2: "The forecast",
    forecastP:
      "Before each coupon round, a probability triple — 1 / X / 2 — is " +
      "recorded for every match on the coupon, along with which signs are " +
      "actually marked. That timestamp must precede kickoff; a forecast " +
      "recorded after the fact is not a forecast, and the build fails if " +
      "one ever is.",
    rpsH2: "Ranked Probability Score",
    rpsP1:
      "RPS is the headline metric, not raw accuracy. Accuracy rewards " +
      "always backing the favourite and depends entirely on which " +
      "fixtures happened to be on that week's coupon — it is close to " +
      "meaningless on a small sample. RPS instead scores the full " +
      "probability triple against what actually happened, and — because " +
      "the outcomes 1 / X / 2 have a real order — it punishes a confident " +
      "home call that finished as an away win harder than one that " +
      "finished a draw. That is the right behaviour for football.",
    rpsP2:
      "There is no external benchmark folded into this figure. RPS is " +
      "tracked as a self-measure of forecast quality over time — this " +
      "season against last month, not this site against the betting " +
      "market.",
    drawWatchH2: "Draw watch",
    drawWatchP:
      "Tracked on its own because it is a failure this project has " +
      "already made in production: a coupon that excluded the draw on " +
      "several soft favourites, in a round that went on to produce five " +
      "draws. The expected draw count is the sum of predicted draw " +
      "probabilities; a result within two standard deviations of that " +
      "expectation is noise, not a bias worth correcting for.",
    wontH2: "What this site will not do",
    wontItems: [
      "Present a forecast as betting advice.",
      "Backfill a prediction after a match has kicked off.",
      "Hide a match that was never forecast, or fake a pending score.",
      "Store a derived figure — every number here is computed at build time from the underlying match data, so it cannot drift out of sync with what produced it.",
    ],
  },
  stats: {
    metaTitle: "Statistics",
    seasonToDate: (label) => `Season to date · ${label}`,
    title: "Statistics",
    lede:
      "League-wide scoring patterns across the Premier League, Championship, and League One " +
      "— not tied to any single coupon, and updated as the season goes on.",
    noStatsYet: "No statistics logged yet.",
  },
  standings: {
    team: "Team",
    p: "P",
    w: "W",
    d: "D",
    l: "L",
    gd: "GD",
    pts: "Pts",
  },
  roundCard: {
    correct: "correct",
    awaitingResults: "Awaiting results",
    playedOf: (played, total) => `${played}/${total} played`,
  },
};

const fi: Dictionary = {
  meta: {
    description:
      "Tulokset, ennusteet ja kalibrointi Valioliigalle, Championshipille ja League Onelle.",
    ogLocale: "fi_FI",
    htmlLang: "fi",
  },
  footer: {
    links: { latest: "Uusin", stats: "Tilastot", rounds: "Kierrokset", calibration: "Kalibrointi", method: "Menetelmä" },
    statement:
      "Strictlane on henkilökohtainen kirjanpito — jalkapallon ennusteita tehtynä ennen ottelua " +
      "Valioliigassa, Championshipissa ja League Onessa, arvioituna ajan mittaan omilla ehdoillaan. " +
      "Osumat ja huti molemmat jäävät kirjoihin.",
    credit: "Tekijä Markku Hihnala · © 2026 Strictlane/Markku Hihnala. Kaikki oikeudet pidätetään.",
  },
  nav: {
    leagueGroup: "Sarja",
    switchTo: "In English",
  },
  common: {
    correct: "Osumat",
    meanRps: "RPS keskiarvo",
    drawsActExp: "Tasapelit tot/odot",
    expected: "Odotettu",
    actual: "Toteutunut",
    z: "z",
    withinNoise: "kohinan sisällä",
    outsideNoise: "kohinan ulkopuolella",
    scoredSuffix: (n) => `${n} arvioitu`,
    latestSuffix: " · uusin",
    playedOf: (played, total) => `${played}/${total} pelattu`,
    reviewArrow: "Katsaus →",
    allRoundsArrow: "Kaikki kierrokset →",
    fullCouponArrow: "Koko kupongi →",
    matchweekHeading: (n) => `Kierros ${n}`,
    matchweekTitle: (n) => `Kierros ${n}`,
    matchweeksAria: "Kierrokset",
    rowsCount: (n) => `${n} riviä`,
    noForecast: "Ei ennustetta",
    notYetPlayed: "Ei vielä pelattu",
    hit: "Osui",
    miss: "Huti",
    dash: "—",
  },
  home: {
    thisWeeksCoupon: "Tämän viikon kuponki",
    singleRow: "Yksi rivi",
    system: (type, singles, doubles, rows) =>
      `${type} · ${singles} yhtä varmaa, ${doubles} kaksosta · ${rows} riviä`,
    expectedOf13: (n) => ` · ${n}/13 odotettu`,
    lastRound: "Viimeisin kierros",
    noRoundsYet: "Kuponkikierroksia ei ole vielä kirjattu.",
    byLeague: "Sarjoittain",
    noData: "Ei dataa",
    mwProgress: (n, played, total) => `Kierros ${n} · ${played}/${total}`,
  },
  matchweekPage: {
    scoring: "Arviointi",
    notes: "Muistiinpanot",
    season: "Kausi",
    tableThrough: (n) => `Sarjataulukko · kierrokseen ${n} asti`,
    translationPending: "Suomenkielinen käännös tulossa. Englanninkielinen versio näytetään toistaiseksi.",
  },
  roundsIndex: {
    metaTitle: "Kuponkikierrokset",
    archive: "Arkisto",
    title: "Kuponkikierrokset",
    lede:
      "Jokainen Lauantaivakio, säilytettynä pysyvästi. Kierros ulottuu useamman sarjan yli, " +
      "joten sitä seurataan erillään kierrosdatasta — jokainen sisältää pelatut merkit, " +
      "niiden tuoton ja sen, miten ennusteet osuivat.",
    roundsSettled: "Ratkaistut kierrokset",
    open: (n) => `${n} avoinna`,
    noRoundsYet: "Kierroksia ei ole vielä kirjattu.",
  },
  roundPage: {
    label: (id) => `Kierros · ${id}`,
    system: (type, singles, doubles, triples, rows) =>
      `${type} · ${singles} yhtä varmaa, ${doubles} kaksosta${triples ? `, ${triples} kolmosta` : ""} · ${rows} riviä`,
    outcome: "Tulos",
    probability: "Todennäköisyys",
    odds: "Kerroin",
    allCovered: (k) => `Kaikki ${k} katettuna`,
    exactly: (k) => `Tarkalleen ${k}`,
    oneIn: (n) => `1/${n}`,
    expectedSub: (n) => `${n} odotettu`,
    review: "Katsaus",
    allRounds: "Kaikki kierrokset",
    otherRoundsAria: "Muut kierrokset",
    translationPending: "Suomenkielinen käännös tulossa. Englanninkielinen versio näytetään toistaiseksi.",
  },
  calibration: {
    metaTitle: "Kalibrointi",
    seasonToDate: (label) => `Kausi tähän mennessä · ${label}`,
    title: "Kalibrointi",
    lede:
      "Raakaosumatarkkuus on lähes merkityksetön: se riippuu siitä, mitkä ottelut olivat sattumalta " +
      "kupongissa, ja se palkitsee suosikin valitsemisesta aina. Tärkeä luku on Ranked " +
      "Probability Score, jota seurataan ajan mittaan ennusteiden laadun omana mittarina.",
    smallSample: (n) =>
      `${n} ottelua on aivan liian pieni otos keskiarvon tulkitsemiseen. Kauden mittainen ` +
      `kirjanpito ratkaisee, onko ennustaminen ylipäätään hyvää.`,
    reliability: "Luotettavuus",
    reliabilityH2: "Tarkoittavatko prosentit mitään?",
    reliabilityLede:
      "Jokainen ennuste tuottaa kolme pistettä, yksi per merkki. Jos kalibrointi on kohdillaan, " +
      "ennustetun ja toteutuneen pitäisi kulkea käsi kädessä taulukossa.",
    band: "Vyöhyke",
    n: "n",
    predicted: "Ennustettu",
    observed: "Toteutunut",
    noScoredYet: "Arvioituja ennusteita ei ole vielä.",
    drawWatch: "Tasapelien seuranta",
    drawWatchH2: "Ennustetut tasapelit vs. toteutuneet",
    drawWatchLede:
      "Seurataan erikseen, koska se on virhe, jonka tämä projekti on jo tehnyt: kuponki, joka " +
      "sulki X:n pois neljästä lievästä suosikista kierroksella, joka tuotti viisi tasapeliä. " +
      "Z-arvo välillä ±2 on kohinaa, ei korjaamisen arvoinen vinouma.",
    overNMatches: (n) => `${n} ottelun yli`,
    baseRates: "Perustasot",
    outcomeMix: "Tulosjakauma",
    outcomeMixLede:
      "Miten ennustetut ottelut ovat tällä kaudella todellisuudessa ratkenneet — perustaso, " +
      "jota vastaan jokainen yksittäinen veikkaus kilpailee.",
    homeWins: "Kotivoitot",
    draws: "Tasapelit",
    awayWins: "Vierasvoitot",
  },
  method: {
    metaTitle: "Menetelmä",
    label: "Menetelmä",
    h1: "Miten ennusteet tehdään ja arvioidaan",
    lede:
      "Strictlane on kirjanpito, ei vihjepalvelu. Tämä sivu selittää " +
      "mekanismin, jotta muualla sivustolla näkyvät luvut voi tarkistaa " +
      "eikä ainoastaan luottaa niihin.",
    forecastH2: "Ennuste",
    forecastP:
      "Ennen jokaista kuponkikierrosta joka ottelulle kupongissa kirjataan " +
      "todennäköisyyskolmikko — 1 / X / 2 — sekä se, mitkä merkit on " +
      "todella pelattu. Aikaleiman on oltava ennen ottelun alkua; " +
      "jälkikäteen kirjattu ennuste ei ole ennuste, ja koko julkaisu " +
      "kaatuu, jos näin joskus tapahtuu.",
    rpsH2: "Ranked Probability Score",
    rpsP1:
      "RPS on päämittari, ei raakaosumatarkkuus. Osumatarkkuus palkitsee " +
      "suosikin valitsemisesta aina, ja se riippuu täysin siitä, mitkä " +
      "ottelut olivat sattumalta sen viikon kupongissa — pienellä otoksella " +
      "se on lähes merkityksetön. RPS puolestaan arvioi koko " +
      "todennäköisyyskolmikon suhteessa siihen, mitä todella tapahtui, ja " +
      "— koska tuloksilla 1 / X / 2 on aidosti järjestys — se rankaisee " +
      "varmasta kotivoittoennusteesta, joka päättyi vierasvoittoon, " +
      "ankarammin kuin sellaisesta, joka päättyi tasapeliin. Se on oikea " +
      "tapa arvioida jalkapallossa.",
    rpsP2:
      "Tähän lukuun ei ole sisällytetty ulkoista vertailukohtaa. RPS:ää " +
      "seurataan ennusteiden laadun omana mittarina ajan mittaan — tätä " +
      "kautta viime kuukautta vastaan, ei tätä sivustoa vedonlyöntimarkkinaa " +
      "vastaan.",
    drawWatchH2: "Tasapelien seuranta",
    drawWatchP:
      "Seurataan erikseen, koska se on virhe, jonka tämä projekti on jo " +
      "tehnyt käytännössä: kuponki, joka sulki tasapelin pois useista " +
      "lievistä suosikeista kierroksella, joka tuotti viisi tasapeliä. " +
      "Odotettu tasapelimäärä on ennustettujen tasapelitodennäköisyyksien " +
      "summa; tulos kahden keskihajonnan sisällä odotuksesta on kohinaa, " +
      "ei korjaamisen arvoinen vinouma.",
    wontH2: "Mitä tämä sivusto ei tee",
    wontItems: [
      "Esitä ennustetta vedonlyöntivihjeenä.",
      "Kirjaa ennustetta jälkikäteen ottelun alkamisen jälkeen.",
      "Piilota ottelua, jolle ei koskaan tehty ennustetta, tai teeskentele tulosta ennen ottelua.",
      "Tallenna johdettua lukua — jokainen tämän sivun luku lasketaan julkaisuhetkellä alkuperäisestä otteludatasta, jotta se ei voi ajautua eroon siitä, mistä se on laskettu.",
    ],
  },
  stats: {
    metaTitle: "Tilastot",
    seasonToDate: (label) => `Kausi tähän mennessä · ${label}`,
    title: "Tilastot",
    lede:
      "Sarjatason tulostrendit Valioliigassa, Championshipissa ja League Onessa " +
      "— ei sidottuna yksittäiseen kuponkiin, ja päivittyy kauden edetessä.",
    noStatsYet: "Tilastoja ei ole vielä kirjattu.",
  },
  standings: {
    team: "Joukkue",
    p: "O",
    w: "V",
    d: "T",
    l: "H",
    gd: "MaalE",
    pts: "P",
  },
  roundCard: {
    correct: "osumaa",
    awaitingResults: "Odottaa tuloksia",
    playedOf: (played, total) => `${played}/${total} pelattu`,
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, fi };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function localePrefix(locale: Locale): string {
  return locale === "fi" ? "/fi" : "";
}

/**
 * Metadata shared across every page in a locale: description, OG locale,
 * and hreflang alternates. `pathPart` is the route's path with NEITHER
 * locale prefix, e.g. "/", "/method", "/2026-27/premier-league/mw-05".
 */
export function baseMetadata(locale: Locale, pathPart: string, title?: string): Metadata {
  const dict = getDictionary(locale);
  const BASE = "https://strictlane.com";
  const clean = pathPart === "/" ? "" : pathPart;
  const enUrl = `${BASE}${clean}`;
  const fiUrl = `${BASE}/fi${clean}`;
  return {
    ...(title ? { title } : {}),
    description: dict.meta.description,
    openGraph: { locale: dict.meta.ogLocale },
    alternates: {
      canonical: locale === "en" ? enUrl : fiUrl,
      languages: { en: enUrl, fi: fiUrl },
    },
  };
}
