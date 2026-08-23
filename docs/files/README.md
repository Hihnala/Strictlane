# strictlane

Results, forecasts and calibration for the Premier League, Championship and
League One. Next.js 15, static output, deployed on Vercel at strictlane.com.

## Setup

```bash
npm install
npm run validate     # data integrity gate
npm run dev
npm run build        # runs validate first via prebuild
```

**Pin TypeScript to 5.x.** `npm i -D typescript` currently resolves to 7.x (the
native rewrite), which Next 15.5 does not yet support. It fails silently rather
than loudly: no `next-env.d.ts`, no tsconfig generation, and the `@/*` path
alias stops resolving, producing a wall of "Module not found" errors that look
like a config problem. `package.json` pins `^5.7.0`.

Related: relative imports inside `lib/` and `scripts/` are extensionless, not
`.js`. TypeScript's `bundler` resolution and webpack disagree about `.js`
specifiers pointing at `.ts` files, and extensionless works for both webpack and
`tsx`.

## Adding a matchweek

```
1. data/2026-27/championship/mw-03.json      results + market odds
2. content/2026-27/championship/mw-03.md     commentary (optional)
3. git push
```

Vercel rebuilds. The matchweek rail extends, the season grid fills a square, and
the calibration page recomputes. **No navigation edits, ever** — the top nav is
five fixed items, and everything that grows lives in the rail and the grid.

If the week was also a coupon round, add `data/rounds/2026-08-29.json` and
optionally `content/rounds/2026-08-29.md`.

## Structure

```
app/
  page.tsx                          Latest — the most recent round
  [season]/[league]/page.tsx        redirects to latest matchweek
  [season]/[league]/[mw]/page.tsx   matchweek: results, scoring, notes, grid
  rounds/, rounds/[id]/             coupon rounds (cut across leagues)
  calibration/                      season-to-date scorekeeping
  method/                           how forecasts are made and scored
lib/
  schema.ts     zod contract — market and forecast are siblings
  scoring.ts    RPS, coverage, calibration, draw watch
  content.ts    loads JSON + Markdown, joined by path convention
scripts/
  import-archive.ts  football-data.co.uk -> data/
  validate.ts        build gate
```

Two axes, deliberately not nested: the **record** runs league → matchweek →
match; the **forecasting log** runs round → coupon → review, and a round spans
leagues. A match appears in both and links each way.

## Data rules, enforced by `npm run validate`

- A forecast's `capturedAt` must precede kickoff. Backfilling fails the build.
- Archive seasons carry results and market odds, never forecasts.
- Match ids are globally unique; a team appears once per matchweek.
- A round's system arithmetic must match its marks (`8+0` implies 2⁸ = 256 rows).
- Nothing derived is stored — every figure is computed from the match files.

## Deploy

Import the repo in Vercel; framework auto-detects. Add `strictlane.com` and
`www.strictlane.com` under Domains, point the apex `A` record and the `www`
`CNAME` at the values Vercel shows, and set `www` to redirect to the apex. SSL is
automatic.

`next.config.mjs` redirects `/championship` → `/2026-27/championship` so the nav
links stay short while canonical URLs always carry the season. Update those three
redirects when the season rolls over — the one annual maintenance task.
