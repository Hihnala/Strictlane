# Veikkaus API — what's usable and what isn't

Source: [Veikkaus/sport-games-robot](https://github.com/Veikkaus/sport-games-robot)
(reference implementation + the only real API documentation).

## The short version

The coupon fetch works and needs no credentials. `SPORT` is Vakio.

```bash
curl --compressed \
  -H 'Accept: application/json' \
  -H 'X-ESA-API-Key: ROBOT' \
  'https://www.veikkaus.fi/api/sport-open-games/v1/games/SPORT/draws'
```

`X-ESA-API-Key: ROBOT` is not a key you register for — the literal string
`ROBOT` is what every automated client sends. There is no signup, no quota, no
secret to store in Vercel.

## Endpoints that matter here

| Endpoint | Auth | Use |
|---|---|---|
| `GET /api/sport-open-games/v1/games/SPORT/draws` | none | The coupon: fixtures, draw id, close time |
| `GET /api/sport-popularity/v1/games/SPORT/draws/{drawId}/popularity` | unclear | Pool distribution across 1/X/2 per match |
| `POST /api/sport-winshare/v1/games/SPORT/draws/{drawId}/winshare` | unclear | Estimated dividend for a given row |
| `https://www.veikkaus.fi/odds_data/vakio_N.zip` | none | Downloadable dividend files, Vakio 1–12 |

Everything else in the reference implementation is about **placing bets** —
login, balance, ticket submission, wager files. None of it is used, and none of
it should be. This project forecasts; it does not stake.

## The ephemerality problem

The draws endpoint returns **only open, playable draws**. When a coupon closes it
vanishes from the response and there is no archive endpoint. Miss the window and
that week's coupon is unrecoverable from Veikkaus.

Two consequences, both handled in `scripts/fetch-vakio.ts`:

1. The job runs on a schedule (Tue–Fri, three times a day) rather than once at a
   guessed hour.
2. Every fetch commits a **raw payload snapshot** to `data/rounds/raw/`. Storage
   is free; the data is not reproducible.

## Why GitHub Actions and not a Vercel cron

The obvious alternative is a Vercel cron hitting a route handler that fetches on
demand. Don't. Three reasons:

**Provenance.** A GitHub Actions run commits the coupon, and the commit
timestamp is independent, external evidence that the fixtures were captured
before kickoff. That is strictly stronger than a self-reported `capturedAt`
field the author could have typed afterwards — and given that this whole site
rests on "we never backfill a prediction", it is worth having the git history
prove it rather than asserting it.

**The architecture is static.** Everything is `generateStaticParams` off files in
the repo. A runtime fetch would make one page dynamic and split the data model
in two for no gain.

**Failure is visible.** A failed Action emails you. A failed serverless fetch
renders an empty section that nobody notices for a fortnight.

Client-side fetching is not an option at all: the API needs a custom header and
sends no CORS headers.

## Pool popularity is the interesting part

The coupon fetch saves fifteen minutes of typing. The popularity endpoint is a
genuinely new input.

Response is scaled ×100 — `7615` means 76.15%:

```json
{ "resultPopularities": [
  { "eventId": 0, "outcomes": ["1"], "percentage": 7615, "awdPercentage": 7334 }
]}
```

Vakio is **pari-mutuel**: the pot is split among winning rows, so a payout
depends on how many other people picked what you picked. Pool popularity is
therefore a completely different quantity from bookmaker probability, and the
**gap between them is where pool value lives.** A match the bookmakers price at
55% home but the pool backs at 76% is one where a correct home pick pays badly
and a correct draw pays extraordinarily well.

This does not change what a good forecast is. It changes which *coupon* is worth
playing given a forecast — a separate question the site has never modelled.

Stored as `poolPopularity`, deliberately alongside and never merged into
`market.probs`. Bookmaker probability and crowd behaviour are different things
and conflating them would corrupt every RPS figure on the site.

Two unknowns, flagged rather than guessed:

- `awdPercentage` is a second series with no documentation. Left raw. Do not
  build anything on it until its meaning is confirmed.
- Whether popularity requires an authenticated session is unclear from the docs.
  The fetcher treats failure as non-fatal.

## Unverified: the draws response shape

The README references `doc/sport-draws-reply.json` — **that file is not in the
repo.** The exact structure of `rows` for SPORT (whether fixtures arrive as a
`competitors` pair or a single `"Home - Away"` string) is therefore unconfirmed.

`mapDraw()` handles both and throws with the offending row rather than guessing.
**Run `npx tsx scripts/fetch-vakio.ts --raw` once and fix the mapping against a
real payload before trusting the output.**

Team names will also arrive in Veikkaus's own forms, which differ from both our
ids and football-data's abbreviations. The fetcher aborts on unmapped names and
prints `teams.json` stubs, same as the archive importer.

## What stays manual

The API supplies the **coupon**. It does not supply the **forecast**.

Probabilities and marks are still authored by hand before kickoff, which is the
point — that is the part the site exists to score. Automating fixture entry
removes transcription errors; it does not remove the judgement.

## Terms

The repo ships a `Lisenssisopimus.md` covering the reference implementation, and
the API is provided for playing Veikkaus games. **Republishing coupon data on a
public site is a different use, and worth reading the licence for before
strictlane.com goes live** — particularly whether attribution is required and
whether a public site carrying Veikkaus coupon data triggers anything under
Finnish gambling-marketing rules. That is a five-minute read, not a blocker, but
do it before pointing the domain.

Operational limits from the docs, all respected here: at most 4 parallel
processes, never poll odds more than once a minute, accept all cookies, accept
gzip.
