import type { Match } from "./schema";

/* ---------------------------------------------------------------------------
 * strictlane — league-wide scoring patterns for the stats page
 *
 * Same rule as standings.ts: nothing here is stored. These used to be copied
 * by hand into content/statistics.md; now they're aggregated from played
 * matches at build time, so they can't drift from the results on the site.
 * ------------------------------------------------------------------------- */

export interface LeagueStats {
  played: number;
  homeWinPct: number;
  drawPct: number;
  nilNilPct: number;
  goalsPerGame: number;
  /** per-half averages over matches that carry a halfTime score; null if none do */
  firstHalf: number | null;
  secondHalf: number | null;
  /** how many of `played` the half averages are based on */
  halfTimeBasis: number;
  over25Pct: number;
  bttsPct: number;
}

export function computeLeagueStats(matches: Match[]): LeagueStats | null {
  const played = matches.filter((m) => m.status === "played" && m.score);
  const n = played.length;
  if (!n) return null;

  const pct = (count: number) => (100 * count) / n;
  const count = (fn: (h: number, a: number) => boolean) => played.filter((m) => fn(m.score!.home, m.score!.away)).length;
  const goals = played.reduce((s, m) => s + m.score!.home + m.score!.away, 0);

  const withHt = played.filter((m) => m.halfTime);
  const firstHalfGoals = withHt.reduce((s, m) => s + m.halfTime!.home + m.halfTime!.away, 0);
  const fullGoalsWithHt = withHt.reduce((s, m) => s + m.score!.home + m.score!.away, 0);

  return {
    played: n,
    homeWinPct: pct(count((h, a) => h > a)),
    drawPct: pct(count((h, a) => h === a)),
    nilNilPct: pct(count((h, a) => h === 0 && a === 0)),
    goalsPerGame: goals / n,
    firstHalf: withHt.length ? firstHalfGoals / withHt.length : null,
    secondHalf: withHt.length ? (fullGoalsWithHt - firstHalfGoals) / withHt.length : null,
    halfTimeBasis: withHt.length,
    over25Pct: pct(count((h, a) => h + a > 2)),
    bttsPct: pct(count((h, a) => h > 0 && a > 0)),
  };
}
