/* ---------------------------------------------------------------------------
 * strictlane — bookmaker odds → probabilities → coupon marks
 *
 * The arithmetic behind scripts/fetch-odds.ts, kept apart from it so it can be
 * checked without a network or a coupon.
 *
 * Raw implied probabilities (1/odds) sum to more than 1; the excess is the
 * bookmaker's margin. Removing it is a modelling choice, not arithmetic. The
 * power method used here puts more of the margin on longshots, which is where
 * books load it (the favourite-longshot bias); a proportional split would
 * spread it evenly and overstate every outsider.
 * ------------------------------------------------------------------------- */

import type { Sign } from "../../lib/schema";

/** [home, draw, away] */
export type Triple = [number, number, number];

export const SIGNS: Sign[] = ["1", "X", "2"];

/** Raw implied probabilities, margin included. */
export const implied = (odds: Triple): Triple => odds.map((o) => 1 / o) as Triple;

/** Bookmaker margin, e.g. 0.0676 for a 6.76% book. An exchange can dip below 0. */
export const overround = (odds: Triple) => implied(odds).reduce((a, b) => a + b, 0) - 1;

/**
 * Power method: find k with Σ pᵢᵏ = 1 by bisection and return each pᵢᵏ.
 *
 * On a normal book k > 1, which shrinks small probabilities more than large
 * ones. An exchange price can carry a slightly negative margin, so the bracket
 * reaches below 1 as well.
 */
export function devigPower(odds: Triple): Triple {
  const raw = implied(odds);
  let lo = 0.5;
  let hi = 3;
  for (let i = 0; i < 100; i++) {
    const k = (lo + hi) / 2;
    if (raw.reduce((a, p) => a + p ** k, 0) > 1) lo = k;
    else hi = k;
  }
  const k = (lo + hi) / 2;
  return raw.map((p) => p ** k) as Triple;
}

/** Equal-weight mean of several books' margin-free probabilities. */
export function consensus(books: Triple[]): Triple {
  if (!books.length) throw new Error("consensus of no books");
  const sum = books.reduce((acc, b) => acc.map((x, i) => x + b[i]) as Triple, [0, 0, 0] as Triple);
  return sum.map((x) => x / books.length) as Triple;
}

/**
 * Whole percentages summing to exactly 100, by largest remainder, so no sign
 * moves more than a point from its exact value. Whole numbers match the
 * hand-written forecasts.
 */
export function toPercent(p: Triple): Record<Sign, number> {
  const exact = p.map((x) => x * 100);
  const out = exact.map(Math.floor);
  const order = [0, 1, 2].sort((a, b) => exact[b] - out[b] - (exact[a] - out[a]));
  for (let left = 100 - (out[0] + out[1] + out[2]), i = 0; left > 0; left--, i++) out[order[i % 3]]++;
  return { "1": out[0], X: out[1], "2": out[2] };
}

/* ----------------------------------------------------------------- marks --- */

export interface MarkInput {
  /** margin-free market probabilities, summing to 1 */
  p: Triple;
  /** pool shares, summing to 1; null when no popularity was available */
  q: Triple | null;
}

export interface MarkPick {
  marks: Sign[];
  favourite: Sign;
  /** market ÷ pool per sign, for the review table only; 1 throughout when the pool is unknown */
  value: Triple;
}

/**
 * The marks for an 8+0 coupon, chosen to cover as many results as possible.
 *
 *   doubles  the favourite plus the second most likely sign
 *   singles  the `singles` safest favourites, safest meaning the favourite
 *            keeps the largest share of what the two likeliest signs cover
 *
 * Ties go to the earlier coupon position. Given the probabilities, this is the
 * 8+0 split that maximises expected hits: a single gives up only its second
 * sign, so the singles belong where that sign is least likely.
 *
 * The pool doesn't steer anything. Until 22 November 2026 it did: singles went
 * only to favourites the pool didn't overplay, the doubles' second mark went
 * to the better-value sign, and open matches (home and away within 10 points)
 * carried the draw. Over the twelve rounds to 21 November that rule cost about
 * half a hit per round by the market's own numbers. It cut the chance of 13/13
 * to under a third of this rule's, in exchange for a bigger share of a prize
 * the coupon would rarely win. The draw rule lost on both counts: in the 46
 * open matches the outsider won 17 times and the draw came 14 times. See the
 * model review of 22 November 2026 in git history.
 *
 * `value` is still computed so the review table can show where the crowd
 * over- and underplays a sign. It never touches marks or probabilities.
 */
export function pickMarks(matches: MarkInput[], singles: number): MarkPick[] {
  const rows = matches.map(({ p, q }) => {
    const value = (q ? p.map((x, i) => x / Math.max(q[i], 1e-4)) : [1, 1, 1]) as Triple;
    const [fav, second] = [0, 1, 2].sort((a, b) => p[b] - p[a] || a - b);
    return { fav, second, value, safety: p[fav] / (p[fav] + p[second]) };
  });

  const single = new Set(
    rows
      .map((_, i) => i)
      .sort((a, b) => rows[b].safety - rows[a].safety || a - b)
      .slice(0, Math.max(0, singles))
  );

  return rows.map((r, i) => ({
    favourite: SIGNS[r.fav],
    value: r.value,
    marks: single.has(i) ? [SIGNS[r.fav]] : [r.fav, r.second].sort((a, b) => a - b).map((k) => SIGNS[k]),
  }));
}
