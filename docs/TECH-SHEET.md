# strictlane — tech sheet

Everything a developer joining cold needs to know. No prior context assumed.

---

## 1. What this is

A static site at **strictlane.com** that records football matches from three
English leagues alongside forecasts made before kickoff, then scores those
forecasts against the betting market.

It is a **ledger**, not a fan site or a tipping service. The product goal is
honest scorekeeping: showing whether the forecasts are any good, including when
they are not. Several design and code decisions only make sense in that light —
they are called out below.

**Scope:** Premier League, EFL Championship, EFL League One. Current season plus
two archive seasons. Roughly 2,300 matches at full load.

---

## 2. Stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | `15.5.23` | Static export via `generateStaticParams` |
| Runtime | React | `19.2.8` | Server Components by default |
| Language | TypeScript | `5.9.3` | **Must stay on 5.x** — see §8 |
| Validation | zod | `4.4.3` | Runtime contract for all data files |
| Markdown | marked | `18.0.10` | Build-time only, no client JS |
| Front-matter | gray-matter | `4.0.3` | |
| Script runner | tsx | `4.23.12` | For `scripts/*.ts` outside Next |
| Node | | `22.x` | `fetch` and `import.meta.dirname` used |
| Styling | Plain CSS + custom properties | — | No Tailwind, no CSS-in-JS |
| Hosting | Vercel | — | Static, rebuild on push |
| Source | GitHub | — | |

**No database, no CMS, no API.** Data lives in the repo as JSON and Markdown.
Publishing is `git push`.

**No state management, no data fetching library, no component library.** The
only client-side JavaScript in the entire app is the theme toggle.

---

## 3. Commands

```bash
npm install
npm run dev              # local dev server
npm run validate         # data integrity gate — read §6 before ignoring failures
npm run build            # runs validate first via prebuild, then next build
npm run import:archive   # pulls past seasons from football-data.co.uk
```

`npm run build` fails if `validate` fails. That is intentional.

---

## 4. Repository layout

```
app/                                  Next.js App Router
  page.tsx                            "Latest" — most recent coupon round
  [season]/[league]/page.tsx          redirects to latest matchweek
  [season]/[league]/[mw]/page.tsx     matchweek: results, scoring, notes, grid
  rounds/page.tsx                     coupon round index
  rounds/[id]/page.tsx                one round
  calibration/page.tsx                season-to-date scorekeeping
  method/page.tsx                     static explainer
  layout.tsx                          nav, footer, no-flash theme script
  globals.css, tokens.css             all styling

components/                           presentational, no data fetching
  Coupon.tsx  CalBar.tsx  MatchRow.tsx
  MatchweekRail.tsx  SeasonGrid.tsx
  StatCell.tsx  Tag.tsx  Nav.tsx  Footer.tsx  Prose.tsx
  ThemeToggle.tsx                     the only "use client" file

lib/
  schema.ts     zod contract for every data shape
  scoring.ts    RPS, coverage, calibration — pure functions, no I/O
  content.ts    filesystem loading, JSON+Markdown joining, build-time memo

scripts/
  import-archive.ts   football-data.co.uk CSV -> data/
  validate.ts         build gate
  lib/odds.ts         margin removal
  lib/matchweeks.ts   matchweek inference

data/                 source of truth (JSON)
content/              commentary (Markdown)
```

---

## 5. Data model

### Two axes, deliberately not nested

The **record** runs league → matchweek → match.
The **forecasting log** runs round → coupon → review.

A "round" is a Finnish *Vakio* coupon: 13 matches picked by the pools operator,
which **cuts across leagues** — the 22 Aug 2026 round spans Premier League MW1,
Championship MW2 and League One MW2. Neither axis contains the other, so they
are separate route trees that cross-link. Don't try to unify them.

### Files

```
data/seasons.json                     season registry; exactly one is "current"
data/teams.json                       canonical team ids + external-source aliases
data/{season}/{league}/mw-NN.json     matches — the source of truth
data/rounds/{id}.json                 coupon: system + ordered match ids
content/{season}/{league}/mw-NN.md    commentary, joined by path convention
content/rounds/{id}.md                round review
```

JSON and Markdown are joined **by path**, never by an id inside the prose.

### Match shape

```jsonc
{
  "id": "2026-27-e1-02-west-ham-charlton",
  "home": "west-ham",              // team id, not a display string
  "away": "charlton",
  "kickoff": "2026-08-22T14:00:00.000Z",
  "status": "played",              // played | pending | postponed
  "score": { "home": 1, "away": 2 },

  "market": {                      // observed data — exists wherever we have odds
    "source": "football-data:AvgC",
    "method": "proportional",      // how bookmaker margin was removed
    "overround": 0.0676,
    "probs": { "1": 68.9, "X": 19.0, "2": 12.1 },
    "capturedAt": "2026-08-22T09:00:00.000Z"
  },

  "forecast": {                    // our claim — null where we made none
    "roundId": "2026-08-22",
    "probs": { "1": 70, "X": 18, "2": 12 },
    "marks": ["1"],                // signs played: 1 = single, 2 = double
    "capturedAt": "2026-08-22T09:30:00.000Z"
  }
}
```

**`market` and `forecast` are siblings, not nested.** Market odds exist for every
archived match; forecasts exist only where we actually made one. Nesting would
mean the archive couldn't carry odds without faking a forecast.

### Nothing derived is ever stored

RPS, hit/miss, hit rate, coverage probabilities, season totals, season-grid
states — all computed at build time from the match files. There is no cached
`"rps": 0.23` field anywhere, so a displayed figure cannot drift out of sync with
the data that produced it. **Do not add derived fields to the JSON.**

---

## 6. Data rules the validator enforces

`scripts/validate.ts` is a build gate, not a linter. It exists to make editorial
rules mechanical rather than a matter of discipline.

| Rule | Why |
|---|---|
| `forecast.capturedAt` **must** precede `kickoff` | Backfilling a prediction is the one thing that would make every number on the site a lie. It is a build failure, not a convention. |
| Archive seasons must have `forecast: null` | Hindsight predictions would corrupt all calibration output |
| Match ids globally unique | Rounds resolve matches by id across leagues |
| A team appears at most once per matchweek | Catches import errors and duplicate fixtures |
| Round system arithmetic must match its marks | `8+0` means 8 doubles → 2⁸ = 256 rows. A mismatch means one of the two is wrong. |
| Every team id resolves to `teams.json` | |
| `played` needs a score; `pending` must not have one | |

Warnings (non-blocking) cover things legitimate mid-season but wrong once a
round closes — e.g. an incomplete matchweek.

**Known limitation:** zod parse failures short-circuit the semantic checks for
that file, so a badly broken file may need two validate passes to surface
everything. Fixable by collecting schema errors and continuing with a partial
parse; not done because it adds complexity for a rare case.

---

## 7. Scoring — the domain logic

`lib/scoring.ts` is pure functions over match arrays. No I/O, trivially testable.

**Ranked Probability Score (RPS) is the primary metric, not accuracy.**

```
RPS = 1/(r-1) · Σᵢ ( Σⱼ≤ᵢ (pⱼ - oⱼ) )²      over outcomes ordered 1, X, 2
```

Lower is better. Order matters: RPS punishes a confident home call that finished
as an *away win* harder than one that finished a *draw*, which is correct for
football. Accuracy is displayed but treated as near-meaningless — it depends on
which fixtures happened to be on the coupon and rewards always backing the
favourite.

Reference point: the best model in the 2017 Soccer Prediction Challenge managed
RPS ≈ 0.2054 over 206 fixtures. Our forecasts and the market both sit near 0.23.

**Our RPS and the market's are always computed over the identical subset** — the
matches where both a forecast and a market price exist. Comparing means taken
over different fixture sets is the easiest way to fool yourself here.

Other exports: `couponOutlook()` (Poisson-binomial over per-match coverage,
gives P(k correct)), `calibration()` (reliability bins), `drawWatch()`,
`marketBaseline()`, `signMix()`.

`drawWatch()` is a named function rather than a line in a summary because
under-covering draws is a failure this project has already made in production.

---

## 8. Gotchas — read before debugging

**TypeScript must stay on 5.x.** `npm i -D typescript` now resolves to **7.x**
(the native rewrite), which Next 15.5 does not support. It fails *silently*: no
`next-env.d.ts` generated, no tsconfig augmentation, and the `@/*` path alias
stops resolving. The symptom is a wall of `Module not found: Can't resolve
'@/lib/...'` that looks like a tsconfig problem and is not. Worse, webpack
reports one file at a time, so fixing a file just surfaces the next. Pinned to
`^5.7.0` in `package.json` — **don't unpin it.**

**Relative imports in `lib/` and `scripts/` are extensionless**, not `.js`.
TypeScript's `bundler` resolution accepts `./schema.js` pointing at `schema.ts`;
webpack does not. Extensionless works for webpack, `tsx` and `tsc` alike.

**`tsconfig.json` needs `baseUrl: "."`** for the `@/*` alias to work in webpack,
not just `paths`.

**Archive matchweek numbers are inferred, not published.** football-data.co.uk
CSVs contain dates only. `scripts/lib/matchweeks.ts` reconstructs rounds using
the round-robin constraint (a team plays once per matchweek; a matchweek holds
n/2 matches), walking fixtures chronologically into the lowest free round.
Verified against synthetic 20- and 24-team double round-robins with injected
postponements: 380/380 and 552/552 correct. Every such file carries
`matchweekDerived: true` and the UI labels it. **It is still inference** — don't
treat those numbers as authoritative.

**Margin removal is a modelling choice, not arithmetic.** `proportional` is the
default. `power` (solve Σpᵢᵏ = 1) handles favourite-longshot bias better, moving
a 12% longshot down ~1.3pp on a 6.8% book. **Never mix methods across seasons** —
it would make the calibration page meaningless.

**Season-grid rendering re-reads every matchweek file** for the league on each
matchweek page. O(weeks²) per league across a full season build. Fine now
(build-time memo, 46 files); the first thing to fix if builds get slow.

---

## 9. Design system ("Rasti")

Documented in `rasti-brand-system.html` (a living style guide — open it).
Tokens live in `app/tokens.css` as CSS custom properties, remapped wholesale
under `[data-theme="dark"]`.

**The one rule that drives everything: colour encodes *outcome*, never
*success*.** Most football sites colour results green-for-win and red-for-loss.
This site has no team, so `1`, `X` and `2` get three colours of equal weight
(blue `#2563EB`, graphite `#5A6675`, brick `#A6392E`). Whether a forecast *hit*
is shown through **form** — a filled underline on the true result, a ✓/✕ in ink.
A missed call must look exactly as calm as a correct one.

**Every numeral is Roboto Mono with tabular figures**, including inside prose.
Apply `className="data"`. This is what lets a column of odds scan straight down.

Type: Montserrat (display) / Roboto (body) / Roboto Mono (data).
Layout: single column, 720px max, 16px gutters, 4px spacing base, phone-first.
Coupon marks keep square corners — the one place the radius scale is refused.

Theme: light default, dark toggle, OS preference on first visit, persisted to
`localStorage` in a try/catch. A blocking inline script in `layout.tsx` applies
it before paint so dark-mode users never see a white flash.

---

## 10. Adding data (the weekly workflow)

```
1. data/2026-27/championship/mw-03.json      results + market odds
2. content/2026-27/championship/mw-03.md     commentary (optional, front-matter + prose)
3. git push
```

The matchweek rail extends, the season grid fills a square, the calibration page
recomputes. **No navigation edits, ever.**

The top nav is five fixed items for the life of the site. This is deliberate:
38 + 46 + 46 matchweeks would be 130 nav entries by May. Growth lives in the
horizontal matchweek rail and the season grid instead.

If the week was also a coupon round, add `data/rounds/{date}.json` with the
system and ordered match ids, and set `forecast.roundId` on each match.

---

## 11. Archive import

```bash
npx tsx scripts/import-archive.ts --seasons 2024-25,2025-26 --dry
npx tsx scripts/import-archive.ts --seasons 2024-25,2025-26
```

Source: [football-data.co.uk](https://www.football-data.co.uk/englandm.php),
free CSVs per division per season (`E0` PL, `E1` Championship, `E2` League One),
including closing odds from several bookmakers. Column preference for the market
price: `AvgC*` (cross-book average closing) → `PSC*` (Pinnacle) → `B365C*` →
pre-closing averages as a flagged last resort.

**Expect the first run to fail.** It aborts on any team name missing from
`teams.json` and prints a paste-ready stub. That is deliberate — football-data
abbreviates unpredictably (`Nott'm Forest`, `Peterboro`, `Sheffield Weds`,
`Wimbledon` for AFC Wimbledon) and a wrong alias is the kind of bug that
survives to production. Fix the `name` and `short` fields by hand when pasting;
generated values are placeholders.

Be polite: the script sleeps 1.5s between requests.

---

## 12. Deploy

Vercel, framework auto-detected. Domains: `strictlane.com` + `www` → apex
redirect. Apex `A` record and `www` `CNAME` per Vercel's values. SSL automatic.

`next.config.mjs` holds three redirects (`/championship` →
`/2026-27/championship` etc.) so nav links stay short while canonical URLs always
carry the season. **Updating those three lines is the one annual maintenance
task** when the season rolls over — along with flipping `status` in
`seasons.json`.

---

## 13. Not built yet

- `sitemap.ts`, `robots.txt`, OG images — do before pointing the domain
- No automated tests; scoring functions are pure and easy to test if wanted
- No per-team pages or head-to-head views (team ids exist to make this possible)
- No Dixon-Coles model — the archive exists to backtest one against the market
- Archive seasons not yet imported

---

## 14. Editorial constraints a developer should not "fix"

These look like missing features. They are decisions.

- **Unforecast matches are shown, not hidden**, with an empty coupon and a "No
  forecast" tag. The record has to include what we didn't call.
- **Pending fixtures never show a placeholder score or a zero** — a dashed tag.
- **No team crests and no per-league colours.** Crests would import twenty other
  colour systems; extra league hues would collide with the outcome axis.
- **"No forecast made", never "N/A"** — N/A reads as missing data rather than a
  deliberate absence.
- **The site never presents a forecast as advice.** The footer carries a
  standing note that this is analysis, not betting advice, with a link to
  Peluuri.

### Two voices

Interface copy (labels, stat cells, tags, empty states, method page) is flat and
neutral. **Commentary in `content/**/*.md` is the opposite** — opinionated,
sharp, funny where a match earns it, and openly biased toward Arsenal and
Ipswich Town, which is declared rather than hidden.

The wall between them is load-bearing: opinion never touches a forecast
probability, a mark, or any figure on the calibration page. If the numbers bend
toward a preferred team, everything computed downstream is decoration. Full
guide in **`content/VOICE.md`** — read it before writing or editing anything
under `content/`.
