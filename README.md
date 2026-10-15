# Strictlane

A personal ledger at [strictlane.com](https://strictlane.com): football
forecasts made before kickoff for the Premier League, EFL Championship, and
EFL League One, scored honestly over the season.

It is a **ledger, not a fan site or a tipping service.** The point is honest
scorekeeping — showing whether the forecasts are any good, including when
they are not. No betting advice, no tipster ambitions, no audience targets.

## What makes this different

Every forecast is locked in before it can be revised: `capturedAt` must
precede kickoff or the build fails — enforced by the validator, not just
convention — so a prediction can never be quietly backfilled with hindsight.
Forecasts are scored with **Ranked Probability Score (RPS)** and hit rate,
tracked over the season as a record of one person's judgement rather than
against the betting market or any other external benchmark. Unforecast
matches are shown rather than hidden, and a missed call is displayed exactly
as calmly as a correct one, so there's no scoreboard to game by
cherry-picking which weeks to publish.

A "round" is a Finnish Veikkaus *Vakio* coupon: 13 matches picked by the
pools operator, cutting across all three leagues. Rounds and the ordinary
league/matchweek record are deliberately separate route trees that
cross-link — see `docs/TECH-SHEET.md` §5 before trying to unify them.

## Stack

Next.js 15 (App Router), static export. React 19, Server Components by
default. TypeScript pinned to `^5.7.0` — **do not bump to 7.x**, it silently
breaks the `@/*` alias resolution Next 15.5 depends on. zod for the runtime
data contract on every JSON file. Plain CSS with custom properties, no
Tailwind. No database, no CMS: all data lives in the repo as JSON and
Markdown, publishing is `git push`. Hosted on Vercel, source on GitHub.

Full detail: [`docs/TECH-SHEET.md`](docs/TECH-SHEET.md).

## Commands

```bash
npm install
npm run dev              # local dev server
npm run validate         # data integrity gate — read TECH-SHEET §6 first
npm run build             # runs validate first via prebuild, then next build
npm run fetch:results -- --dry   # preview the ballprediction.com results/fixtures sync
npm run fetch:odds -- 2026-10-17 --dry   # preview a coupon's odds pre-fill
```

`npm run build` fails if `validate` fails. That's intentional — the data
rules below are enforced mechanically, not by discipline.

## Repository layout

```
app/                                  Next.js App Router
components/                           presentational, no data fetching
lib/                                  schema.ts, scoring.ts, content.ts
scripts/                              validate.ts, fetch-vakio.ts, fetch-odds.ts, fetch-results.ts, promote-round.ts
data/                                 source of truth (JSON)
content/                              commentary (Markdown)
docs/                                 TECH-SHEET.md, DESIGN.md, VOICE.md, archive/ (old Rasti style guide)
.github/workflows/fetch-vakio.yml     weekly Vakio coupon fetch
.github/workflows/fetch-odds.yml      Saturday odds pre-fill of the coupon's forecasts
```

```
data/seasons.json                     season registry; exactly one is "current"
data/teams.json                       canonical team ids + external-source aliases
data/{season}/{league}/mw-NN.json     matches — the source of truth
data/rounds/{id}.json                 coupon: system + ordered match ids
data/results/{date}.json              log of each results sync: what changed, from which page, when
content/{season}/{league}/mw-NN.md    commentary, joined by path convention
content/rounds/{id}.md                round review
```

JSON and Markdown are joined **by path**, never by an id inside the prose.

## Data rules the validator enforces

| Rule | Why |
| --- | --- |
| `forecast.capturedAt` must precede `kickoff` | Backfilling a prediction would make every number on the site a lie — a build failure, not a convention. |
| Archive seasons must carry `forecast: null` | Hindsight predictions would corrupt calibration output. |
| Match ids globally unique | Rounds resolve matches by id across leagues. |
| A team appears at most once per matchweek | Catches import errors and duplicate fixtures. |
| A round's system arithmetic must match its marks | `8+0` means 8 doubles → 2⁸ = 256 rows; a mismatch means one of the two is wrong. |
| `halfTime` only on played matches, never above the full-time score | It feeds the per-half goal averages on the stats page. |

Nothing derived is ever stored — RPS, hit/miss, hit rate, coverage
probabilities, season totals, and the league statistics page are all computed
at build time from the source match files, so a displayed figure can never
drift out of sync with the data that produced it.

## Weekly workflow

1. Run **Fetch Vakio coupon** (`.github/workflows/fetch-vakio.yml`, manual)
   once the coupon is out. `scripts/fetch-vakio.ts` opens a PR with a draft
   coupon at `data/rounds/drafts/{id}.json` plus a raw API payload for
   provenance. It never pushes to `main` — a draft has no `matchIds` and no
   forecasts, so it can't satisfy the Round schema.
2. On Saturday morning, run **Fetch odds** (`.github/workflows/fetch-odds.yml`,
   manual; it fetches the coupon itself if step 1 was skipped).
   `scripts/fetch-odds.ts` pre-fills a forecast for each coupon match on that
   PR branch: `probs` from football-data.co.uk's Friday odds (Betfair
   Exchange, Bet365, Paddy Power, Sky Bet and bwin, each margin-stripped by the
   power method, then averaged), `marks` by the 8+0 rule steered by Veikkaus
   pool popularity, and that popularity as `pool`. It then runs
   `promote-round.ts`, which joins the draft to the real match records and
   derives the round's system block from the marks, and comments a review
   table on the PR.
3. Review the suggestions on the PR branch and change anything you disagree
   with, keeping 5 singles and 8 doubles. A changed forecast gets a new
   `capturedAt`, still **before kickoff**. Anything listed under "Needs a
   human" (a missing fixture, odds not in the file yet) is yours to fill in,
   then `npx tsx scripts/promote-round.ts <round-id>`.
4. `npm run validate`, then merge.

After the weekend (and after midweek rounds), sync results and fixtures:

1. `scripts/fetch-results.ts` reads the `/results` and `/fixtures` pages for
   the three leagues on ballprediction.com (`epl`, `efl`, `elo`) and updates
   the current season's matchweek files: scores and half-time scores for
   finished matches, corrected kickoff times, postponements and new dates, and
   any missing fixtures — including every round whose matches mostly fall in
   the next 8 days (`--days N`), so next week's fixtures exist before the
   coupon is fetched. It never touches a forecast, never overwrites a score,
   and lists anything the site and the data disagree on under "Needs a human"
   instead of guessing. An unknown team name aborts the run with nothing
   written — add the site's spelling to that club's `aliases`.
2. It is meant to run from a manually triggered GitHub Action that opens a PR:
   `npx tsx scripts/fetch-results.ts --summary results-summary.md`, then
   `npm run validate`, then a PR with `results-summary.md` as its body if
   `git status --porcelain data` shows changes. Exit code 1 means the run
   aborted and wrote nothing.
3. Review the PR, write the commentary on that branch, merge.

`--dry` prints the report without writing; `--raw` prints what was parsed
from the site. The site's robots.txt asks for a 10-second crawl delay, so a
run takes about a minute.

The Veikkaus open-games API returns only currently-open draws and drops
closed coupons permanently, so the raw payload committed alongside each
draft is the only copy of that data that will ever exist.

## Two voices

Interface copy (labels, tags, empty states) is flat and neutral. Commentary
under `content/**/*.md` is opinionated, sharp, and openly biased toward
Arsenal and Ipswich Town — declared rather than hidden, and held to the same
standard as any other team. The wall between the two is load-bearing: opinion
never touches a forecast probability, a mark, or a calibration figure. Full
guide: [`docs/VOICE.md`](docs/VOICE.md).

## Design system

Sealed — dark-only, desktop-first, a 1160px column for heroes and cards and a
720px column for prose, with a floating glass header. Instrument Sans for text,
JetBrains Mono for every numeral. Colour encodes *outcome* (1/X/2), never team
success; whether a forecast hit is shown through form (underline, ✓/✕), not
colour — and hit and miss animate identically. Full spec:
[`docs/DESIGN.md`](docs/DESIGN.md).

## Not betting advice

Strictlane publishes analysis, not betting advice. No affiliate links, no
sponsorships. If gambling stops feeling fun, [GambleAware](https://www.gambleaware.org/)
(UK) is a free, confidential resource.

## Licence / ownership

© 2026 Strictlane/Markku Hihnala. All rights reserved. This is a personal
project; it isn't accepting external contributions.
