import { z } from "zod";

/* ---------------------------------------------------------------------------
 * strictlane — data contract
 *
 * Two things are kept deliberately separate:
 *
 *   market   observed data. Bookmaker closing odds, margin-stripped. Exists for
 *            every match we have odds for, including archive seasons.
 *   forecast our claim. Exists only where we actually made one, before kickoff.
 *
 * Nothing derived is ever stored — RPS, hit/miss, coverage and season totals are
 * computed at build time from these files, so the numbers can't drift apart.
 * ------------------------------------------------------------------------- */

export const LeagueId = z.enum(["premier-league", "championship", "league-one"]);
export type LeagueId = z.infer<typeof LeagueId>;

/** "2026-27" */
export const SeasonId = z.string().regex(/^\d{4}-\d{2}$/);

export const Sign = z.enum(["1", "X", "2"]);
export type Sign = z.infer<typeof Sign>;

/** Percentages, 0–100. Must sum to 100 (±1 for rounding). */
export const ProbTriple = z
  .object({ "1": z.number().min(0).max(100), X: z.number().min(0).max(100), "2": z.number().min(0).max(100) })
  .refine((p) => Math.abs(p["1"] + p.X + p["2"] - 100) <= 1, {
    message: "probabilities must sum to 100 (±1)",
  });
export type ProbTriple = z.infer<typeof ProbTriple>;

export const Market = z.object({
  /** e.g. "football-data:AvgC", "oddsportal-avg", "oddschecker-best" */
  source: z.string().min(1),
  /** how the bookmaker margin was removed */
  method: z.enum(["proportional", "power"]),
  /** bookmaker overround before stripping, e.g. 0.0676 for 6.76% */
  overround: z.number().min(0).max(1),
  probs: ProbTriple,
  /** when the odds were observed. Archive rows use the source's own snapshot. */
  capturedAt: z.string().datetime(),
});
export type Market = z.infer<typeof Market>;

export const Forecast = z.object({
  /** links this match to a coupon round, e.g. "2026-08-22" */
  roundId: z.string().nullable(),
  probs: ProbTriple,
  /** the signs actually marked — one for a single, two for a double, etc. */
  marks: z.array(Sign).min(1).max(3),
  /** MUST precede kickoff. Enforced in validate.ts — backfilling fails the build. */
  capturedAt: z.string().datetime(),
  note: z.string().optional(),
});
export type Forecast = z.infer<typeof Forecast>;

export const Match = z
  .object({
    id: z.string().min(1),
    home: z.string().min(1), // team id
    away: z.string().min(1), // team id
    kickoff: z.string().datetime(),
    status: z.enum(["played", "pending", "postponed"]),
    score: z.object({ home: z.number().int().min(0), away: z.number().int().min(0) }).nullable(),
    market: Market.nullable(),
    forecast: Forecast.nullable(),
  })
  .refine((m) => (m.status === "played" ? m.score !== null : m.score === null), {
    message: "played matches need a score; pending/postponed must not have one",
  })
  .refine((m) => m.home !== m.away, { message: "a team cannot play itself" });
export type Match = z.infer<typeof Match>;

export const Matchweek = z.object({
  season: SeasonId,
  league: LeagueId,
  matchweek: z.number().int().min(1).max(46),
  /** true when the number was inferred rather than published — see matchweeks.ts */
  matchweekDerived: z.boolean(),
  /** provenance for the whole file */
  source: z.string().min(1),
  importedAt: z.string().datetime().optional(),
  matches: z.array(Match).min(1),
});
export type Matchweek = z.infer<typeof Matchweek>;

export const Team = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** for narrow phone rows — aim for ≤ 12 chars */
  short: z.string().min(1).max(14),
  /** names used by external sources, so imports map cleanly */
  aliases: z.array(z.string()).default([]),
});
export type Team = z.infer<typeof Team>;

export const TeamsFile = z.object({ teams: z.array(Team) });

export const Round = z.object({
  id: z.string().min(1), // "2026-08-22"
  name: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  system: z
    .object({
      type: z.string(), // "8+0", "single", …
      singles: z.number().int().min(0),
      doubles: z.number().int().min(0),
      triples: z.number().int().min(0).default(0),
      rows: z.number().int().min(1),
    })
    .optional(),
  /** in coupon order — order is meaningful and must be preserved */
  matchIds: z.array(z.string()).min(1),
});
export type Round = z.infer<typeof Round>;
