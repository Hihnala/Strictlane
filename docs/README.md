# Archive importer

Pulls two past seasons of results and closing odds from
[football-data.co.uk](https://www.football-data.co.uk/englandm.php) into
`data/{season}/{league}/mw-NN.json`.

## Run it

```bash
npm i -D tsx zod

# see what it would do, without writing
npx tsx scripts/import-archive.ts --seasons 2024-25,2025-26 --dry

# for real
npx tsx scripts/import-archive.ts --seasons 2024-25,2025-26

# one league, power-method margin removal
npx tsx scripts/import-archive.ts --seasons 2025-26 --leagues championship --margin power
```

Flags: `--seasons`, `--leagues`, `--margin proportional|power`, `--dry`.

## Expect it to fail the first time

It aborts on any team name not in `data/teams.json` and prints a paste-ready
stub. That is deliberate — a wrong team alias is exactly the kind of bug that
survives to production and quietly corrupts head-to-head records. `teams.json`
is seeded with the three divisions across 2024-25 → 2026-27, but football-data
abbreviates unpredictably (`Nott'm Forest`, `Peterboro`, `Sheffield Weds`,
`Wimbledon` for AFC Wimbledon), and squads change, so expect a few additions.

Fix the `name` and `short` fields by hand when you paste a stub in — the
generated values are placeholders, and `short` is what renders on a phone.

## What it writes, and what it refuses to

Every imported match gets `forecast: null`. We did not predict these games, and
writing hindsight forecasts into the archive would corrupt every calibration
number on the site. The build validator enforces this for archive seasons.

What it *does* carry is `market` — the closing odds, margin-stripped. That is
the point of importing at all: two seasons of results paired with the market's
own probability for each, which is the benchmark any Dixon-Coles model has to be
scored against.

## Three caveats worth knowing

**Matchweek numbers are inferred.** The CSVs contain dates, not matchweeks.
`lib/matchweeks.ts` reconstructs rounds using the round-robin constraint — a
team plays once per matchweek, a matchweek holds n/2 matches — walking fixtures
chronologically into the lowest free round. Tested against synthetic 20- and
24-team double round-robins with injected postponements: 380/380 and 552/552
assigned correctly. Every file carries `matchweekDerived: true` and the site
labels those matchweeks as inferred.

**Odds column choice matters.** Preference runs `AvgC*` (cross-book average
closing) → `PSC*` (Pinnacle closing) → `B365C*` → pre-closing averages as a last
resort. The pre-closing fallback is flagged in the `source` string so a row
built from opening odds is never silently compared against closing lines.

**Margin removal is a modelling choice.** Proportional is the default and
matches the numbers used in earlier work on this project. The power method
(solve Σpᵢᵏ = 1) handles favourite-longshot bias better, moving a 12% longshot
down about 1.3pp on a 6.8% book. Small per match, but it compounds across a
season of RPS comparisons. Pick one and stay with it — mixing methods across
seasons makes the calibration page meaningless.

## Provenance

Football-Data collects weekend odds on Friday afternoons and midweek odds on
Tuesday afternoons; there is no per-match odds timestamp, so `capturedAt`
records the kickoff. Fine for archive use, not precise enough to make
closing-line-value claims from.
