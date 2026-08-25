# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15.5 (App Router), static export via `generateStaticParams`. React 19,
Server Components by default. TypeScript pinned to `^5.7.0` (5.x — the 7.x
native rewrite silently breaks Next 15.5's `@/*` alias resolution, must stay
pinned). zod for the runtime data contract. `marked` + `gray-matter` for
build-time Markdown, no client JS from either. Plain CSS with custom
properties — no Tailwind, no CSS-in-JS. No database, no CMS, no API: all data
lives in the repo as JSON and Markdown, publishing is `git push`. Hosted on
Vercel (static, rebuild on push), source on GitHub. The only client-side
JavaScript in the app is the theme toggle. Full detail in
[docs/TECH-SHEET.md](docs/TECH-SHEET.md).

## Users

Primarily a personal journal — the author's own public record. Written in
English. The author intends to build a readership over time, but growing an
audience is a hoped secondary effect, not the reason the site exists (see
Product Principles). Readers are people curious whether these forecasts, or
the betting market itself, are actually any good — including anyone who
follows the Finnish Veikkaus Vakio pools coupon, which is why "rounds" cut
across three English leagues the way they do. The disclaimer linking to
Peluuri (Finland's gambling-harm helpline) reflects that some readers may be
pools players, even though the site is explicit that it offers analysis, not
betting advice.

## Product Purpose

Records football forecasts made before kickoff for the Premier League, EFL
Championship, and EFL League One, then scores those forecasts honestly against
the betting market. It is a ledger, not a fan site or a tipping service.
Success means the numbers stay honest and legible — including, and especially,
when the forecasts are wrong. Explicitly not scoped to grow: no audience
targets, no monetization, no tipster ambitions.

## Positioning

The differentiator is honesty under a real benchmark: forecasts are scored
with Ranked Probability Score against the closing betting market's own
margin-stripped probabilities, always computed over the identical fixture
subset, so the comparison can't be gamed by cherry-picking matches. Two
archive seasons carry real closing odds and are mechanically barred (by the
build validator) from ever carrying a hindsight forecast, so the historical
benchmark can't be quietly polluted. A neighboring "fan site" or tipster could
not truthfully copy this — the mechanism only works because the site refuses
to hide or dress up a bad result.

## Operating Context

Two axes, deliberately not nested, that cross-link: the **record** runs league
→ matchweek → match; the **forecasting log** runs round → coupon → review,
where a "round" is a Finnish Vakio-style coupon of 13 matches picked by the
pools operator, cutting across all three leagues. Weekly workflow: add
`data/{season}/{league}/mw-NN.json` (results + market odds) and optionally
`content/{season}/{league}/mw-NN.md` (commentary), then `git push` — the
matchweek rail, season grid, and calibration page all update automatically.
The top nav is five fixed items for the site's life; growth lives in the
matchweek rail and season grid, never in nav edits. Season rollover requires
updating three redirects in `next.config.mjs` and flipping `status` in
`data/seasons.json` — the one annual maintenance task.

## Capabilities and Constraints

- Scope: Premier League, EFL Championship, EFL League One, current season
  only. 2026-27 is the site's first season — no archive seasons. Decided
  after `scripts/import-archive.ts` hit a real limitation: its chronological
  greedy matchweek-derivation algorithm can't reliably reconstruct rounds
  for real historical seasons once enough fixtures have been rearranged for
  TV (verified against real 2024-25 Premier League data). Not worth solving
  for a personal ledger; the site starts its honest record from here.
- RPS (Ranked Probability Score) is the primary metric, not accuracy; accuracy
  is shown but treated as near-meaningless since it rewards always backing the
  favourite.
- Nothing derived is ever stored (no cached RPS, hit-rate, or calibration
  fields) — every figure is computed at build time from the source match
  files, so nothing can drift out of sync.
- Build validator (`npm run validate`, runs via prebuild) enforces editorial
  rules mechanically: a forecast's `capturedAt` must precede kickoff; archive
  seasons must carry `forecast: null`; match ids are globally unique; a
  round's system arithmetic must match its marks; every team id resolves in
  `teams.json`.
- Unforecast matches are shown, not hidden ("No forecast" tag, not "N/A").
  Pending fixtures never show a placeholder score.
- No team crests, no per-league colours — colour on the site encodes outcome
  (1/X/2), never team success.
- Not yet built: automated tests, per-team/head-to-head pages, a real
  Dixon-Coles forecasting model. `sitemap.ts`, `robots.txt`, and the OG
  image are done; the site is live at strictlane.com.
- Archive seasons: explicitly out of scope now, not a pending TODO (see
  Capabilities scope note above). `scripts/import-archive.ts` and
  `scripts/lib/matchweeks.ts` stay in the repo since the mechanism could be
  revisited later, but nothing currently depends on it working.
- Undecided: whether/when the site adds a Dixon-Coles model — the archive
  exists to backtest one against the market, but building it is explicitly
  out of scope for now (confirmed: stay a small honest ledger, not a step
  toward shipping a model).
- Coupon fixtures are pulled automatically from Veikkaus's public
  open-games API via a 3-stage pipeline, not written straight to `main`:
  (1) `scripts/fetch-vakio.ts`, scheduled Tue–Fri via GitHub Actions, opens
  a PR with a draft at `data/rounds/drafts/{id}.json` plus a raw payload
  snapshot for provenance — no login or registered key, the header value
  is the literal string `ROBOT`; (2) fixtures/forecasts are added by hand
  on that PR branch before kickoff; (3) `scripts/promote-round.ts` joins
  the draft to real match records and derives the round's system block
  (singles/doubles/rows) from the marks rather than trusting a typed
  value, refusing if any fixture lacks a match or a forecast. Drafts live
  outside the validated path so an incomplete draft can never fail the
  production build. GitHub Actions was chosen over a Vercel cron
  specifically to keep the PR's commit timestamp as external, independent
  provenance and to keep the site fully static.
- The API also exposes pool popularity (how the pari-mutuel pool split
  across 1/X/2 per match) — a different quantity from bookmaker
  probability, since Vakio payout depends on how many others picked the
  same row. Stored as `poolPopularity`, deliberately alongside and never
  merged into `market.probs`.
- Automation only removes fixture transcription — forecast probabilities
  and marks are still authored by hand before kickoff. That judgement is
  the part the site exists to score, so it is deliberately not automated.
- Veikkaus's licence terms need a read before strictlane.com goes live —
  republishing coupon data publicly is a different use than playing the
  game, and Finnish gambling-marketing rules may bind it. Flagged, not yet
  resolved.

## Brand Commitments

- Name: **Strictlane**, at strictlane.com. Design system name: **Rasti**
  (documented separately in `docs/rasti-brand-system.html`; visual details
  belong in DESIGN.md, not here).
- Two voices, walled apart: interface copy (nav, labels, stat cells, tags,
  empty states, method page) stays flat and neutral. Commentary in
  `content/**/*.md` is opinionated, sharp, and funny where a match earns it.
  Full guide: [docs/VOICE.md](docs/VOICE.md).
- Declared bias: Arsenal (favourite team), Ipswich Town (soft spot) — stated
  openly rather than hidden. Both are held to the same standard as any other
  team; excuses for either are explicitly against the voice rules.
- Standing footer disclaimer: "Strictlane is analysis, not betting advice."
  No Peluuri link — removed deliberately: Peluuri is a Veikkaus-branded
  service, and the site isn't a betting product, so a Veikkaus-affiliated
  link doesn't belong in the footer. Footer credit line: "Made with ❤ for
  football by Markku Hihnala."
- The wall is load-bearing: opinion in commentary must never touch a forecast
  probability, a mark, or any calibration figure.

## Evidence on Hand

- `docs/TECH-SHEET.md` and `docs/VOICE.md` are an existing, detailed product
  and editorial spec — treated as strong evidence throughout this document.
- `docs/rasti-brand-system.html` is a living style guide for the Rasti design
  system (visual world — for DESIGN.md/new-work, not consumed here).
- Reference source snippets already drafted under `docs/files/` (page.tsx,
  layout.tsx, Coupon.tsx, MatchRow.tsx, content.ts, globals.css,
  package.json) and `docs/` (schema.ts, scoring.ts, odds.ts, matchweeks.ts,
  validate.ts, import-archive.ts, teams.json, seasons.json) — these are
  drafted reference material to build the real app from, not yet an actual
  app in this repo.
- One worked commentary example exists (`docs/2026-08-22.md`, a round review)
  demonstrating the voice in practice.
- `docs/VEIKKAUS.md`, `docs/fetch-vakio.ts`, and `docs/fetch-vakio.yml` are a
  drafted, reference-verified pipeline for automated Vakio coupon fetch (see
  Capabilities and Constraints) — not yet wired into a running GitHub Actions
  workflow in this repo.
- State absence: no `app/`, `data/`, or `content/` directories exist yet at
  the project root — the real Next.js app has not been scaffolded here, and
  no real match data has been imported. The two archive seasons
  (2024-25, 2025-26) are not yet imported. Future work must not assume a
  running site exists yet.

## Product Principles

1. **Honesty over performance** — a missed call must look exactly as calm as
   a correct one; RPS and calibration figures are never softened or hidden.
2. **Two voices, one wall** — commentary can be opinionated and openly biased;
   every forecast number stays neutral and untouched by opinion, always.
3. **Nothing derived is stored** — every stat is computed at build time from
   source match files, so a displayed figure can never drift from the data
   that produced it.
4. **The record includes what wasn't called** — unforecast and pending
   matches are shown, never hidden or faked with a placeholder.
5. **Small and honest beats big and persuasive** — this stays a personal
   ledger; if a readership grows, it grows around the honesty, not instead
   of it. No audience-growth tradeoffs against the numbers.
