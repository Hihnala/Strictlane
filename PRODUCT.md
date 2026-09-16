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
Product Principles). Readers are people curious whether these forecasts are
actually any good — including anyone who follows the Finnish Veikkaus Vakio
pools coupon, which is why "rounds" cut across three English leagues the way
they do. The disclaimer linking to Peluuri (Finland's gambling-harm helpline)
reflects that some readers may be pools players, even though the site is
explicit that it offers analysis, not betting advice.

## Product Purpose

Records football forecasts made before kickoff for the Premier League, EFL
Championship, and EFL League One, then keeps an honest scoring record of them
over time — hit rate and Ranked Probability Score, not a comparison against
any external benchmark. It is a ledger, not a fan site or a tipping service.
Success means the numbers stay honest and legible — including, and especially,
when the forecasts are wrong. Explicitly not scoped to grow: no audience
targets, no monetization, no tipster ambitions.

## Positioning

The differentiator is that every claim is locked in before it can be revised:
`capturedAt` must precede kickoff or the build fails, so a forecast can never
be quietly backfilled with hindsight. Unforecast matches are shown rather than
hidden, and a missed call is displayed exactly as calmly as a correct one.
There's no external benchmark here — RPS and hit rate are tracked purely as a
record of this one person's judgement over a season, not a claim to beat the
market. A neighbouring fan site or tipster could not truthfully copy this: the
mechanism only works because the site refuses to hide or dress up a bad
result, and there's no scoreboard to game by cherry-picking which weeks to
publish.

## Operating Context

Two axes, deliberately not nested, that cross-link: the **record** runs league
→ matchweek → match; the **forecasting log** runs round → coupon → review,
where a "round" is a Finnish Vakio-style coupon of 13 matches picked by the
pools operator, cutting across all three leagues. Weekly workflow: add
`data/{season}/{league}/mw-NN.json` (results) and optionally
`content/{season}/{league}/mw-NN.md` (commentary), then `git push` — the
matchweek rail, season grid, and calibration page all update automatically.
The top nav is five fixed items for the site's life; growth lives in the
matchweek rail and season grid, never in nav edits. Season rollover requires
updating three redirects in `next.config.mjs` and flipping `status` in
`data/seasons.json` — the one annual maintenance task.

## Capabilities and Constraints

- Scope: Premier League, EFL Championship, EFL League One, current season
  only. 2026-27 is the site's first season — no archive seasons, and none
  planned. Originally shelved after `scripts/import-archive.ts` hit a real
  limitation: its chronological greedy matchweek-derivation algorithm
  couldn't reliably reconstruct rounds for real historical seasons once
  enough fixtures had been rearranged for TV (verified against real 2024-25
  Premier League data). Now doubly moot since the site no longer tracks a
  betting-market benchmark to backtest anything against.
  `scripts/import-archive.ts` and `scripts/lib/matchweeks.ts` have been
  removed from the repo rather than kept on the shelf.
- RPS (Ranked Probability Score) is the primary metric, not accuracy —
  tracked over time as a self-measure of forecast quality, not against any
  external benchmark. Accuracy is shown but treated as near-meaningless since
  it rewards always backing the favourite.
- Nothing derived is ever stored (no cached RPS, hit-rate, or calibration
  fields) — every figure is computed at build time from the source match
  files, so nothing can drift out of sync.
- Build validator (`npm run validate`, runs via prebuild) enforces editorial
  rules mechanically: a forecast's `capturedAt` must precede kickoff; match
  ids are globally unique; a round's system arithmetic must match its marks;
  every team id resolves in `teams.json`.
- Unforecast matches are shown, not hidden ("No forecast" tag, not "N/A").
  Pending fixtures never show a placeholder score.
- No team crests, no per-league colours — colour on the site encodes outcome
  (1/X/2), never team success.
- No Dixon-Coles model, now or ever planned — there's no market to backtest
  against and no archive to train one on. This stays a small honest ledger,
  not a step toward shipping a forecasting model.
- Not yet built: automated tests, per-team/head-to-head pages. `sitemap.ts`,
  `robots.txt`, and the OG image are done; the site is live at strictlane.com.
- Coupon fixtures are pulled automatically from Veikkaus's public
  open-games API via a 3-stage pipeline, not written straight to `main`:
  (1) `scripts/fetch-vakio.ts`, run on a single Thursday cron via GitHub
  Actions, opens a PR with a draft at `data/rounds/drafts/{id}.json` plus a
  raw payload snapshot for provenance — no login or registered key, the
  header value is the literal string `ROBOT`. Thursday is past the Monday/
  Tuesday publication window and still two days clear of Saturday; the
  earlier Tue–Fri polling was dropped because same-day runs raced each
  other on the branch name. `{id}` is the coupon's **playing** date,
  derived from the draw's close time — not the date the fetch ran, which
  the Thursday schedule puts two days earlier; (2) fixtures/forecasts are added by hand
  on that PR branch before kickoff; (3) `scripts/promote-round.ts` joins
  the draft to real match records and derives the round's system block
  (singles/doubles/rows) from the marks rather than trusting a typed
  value, refusing if any fixture lacks a match or a forecast. Drafts live
  outside the validated path so an incomplete draft can never fail the
  production build. GitHub Actions was chosen over a Vercel cron
  specifically to keep the PR's commit timestamp as external, independent
  provenance and to keep the site fully static.
- Only **Lauantaivakio** is in scope. The open-games endpoint returns the
  whole Vakio family — Futisvakio, Sunnuntaivakio and whatever Veikkaus
  names next — and those coupons mix European and Finnish lower-division
  fixtures the site has no record of and are not always 13 matches. The
  fetcher whitelists the Saturday coupon by name rather than excluding
  known-bad ones, so a new draw type is skipped by default instead of
  breaking the run. Widening this later is a deliberate product decision,
  not a config tweak: a non-13-match coupon has no 8+0 shape.
- The API also exposes pool popularity (how the pari-mutuel pool split
  across 1/X/2 per match) — a different quantity from our own forecast
  probability, since Vakio payout depends on how many others picked the
  same row. Stored as `poolPopularity`, deliberately alongside and never
  merged into `forecast.probs`.
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
  package.json) and `docs/` (schema.ts, scoring.ts, validate.ts, teams.json,
  seasons.json) — these are drafted reference material to build the real app
  from, the actual app in the repo.
- One worked commentary example exists (`docs/2026-08-22.md`, a round review)
  demonstrating the voice in practice.
- The Vakio coupon fetch is **live**, not drafted: `scripts/fetch-vakio.ts`
  and `.github/workflows/fetch-vakio.yml` run on the Thursday cron and have
  captured a real coupon end to end (draw 100570, 3 Sep 2026). Field mapping
  is confirmed against real payloads for `outcome.home` / `outcome.away`;
  `competitors` and the `"Home - Away"` string remain as untested fallbacks.
  `docs/VEIKKAUS.md` is the reference write-up behind it.

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
