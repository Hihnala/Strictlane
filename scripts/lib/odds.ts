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
  /** market ÷ pool per sign; 1 throughout when the pool is unknown */
  value: Triple;
}

/**
 * The marks for an 8+0 coupon, steered by pool popularity.
 *
 * value = market probability ÷ pool share. Above 1 the crowd underplays a
 * sign, so a correct row through it is shared with fewer winners.
 *
 *   doubles  the market favourite plus whichever other sign has the better value
 *   singles  the `singles` safest favourites — safest meaning the favourite
 *            keeps the largest share of what the two likeliest signs cover —
 *            chosen only among favourites the pool doesn't overplay (value ≥ 1).
 *            If too few qualify, the least-overplayed favourites fill the gap.
 *
 * The pool steers marks only, never probabilities: crowd behaviour folded into
 * `forecast.probs` would corrupt every RPS figure on the site.
 */
export function pickMarks(matches: MarkInput[], singles: number): MarkPick[] {
  const rows = matches.map(({ p, q }) => {
    const value = (q ? p.map((x, i) => x / Math.max(q[i], 1e-4)) : [1, 1, 1]) as Triple;
    const byProb = [0, 1, 2].sort((a, b) => p[b] - p[a] || value[b] - value[a] || a - b);
    const fav = byProb[0];
    const partner = [0, 1, 2]
      .filter((i) => i !== fav)
      .sort((a, b) => value[b] - value[a] || p[b] - p[a] || a - b)[0];
    return { fav, partner, value, safety: p[fav] / (p[fav] + p[byProb[1]]) };
  });

  const idx = rows.map((_, i) => i);
  const qualify = idx
    .filter((i) => rows[i].value[rows[i].fav] >= 1)
    .sort((a, b) => rows[b].safety - rows[a].safety || a - b);
  const overplayed = idx
    .filter((i) => rows[i].value[rows[i].fav] < 1)
    .sort((a, b) => rows[b].value[rows[b].fav] - rows[a].value[rows[a].fav] || a - b);
  const single = new Set([...qualify, ...overplayed].slice(0, Math.max(0, singles)));

  return rows.map((r, i) => ({
    favourite: SIGNS[r.fav],
    value: r.value,
    marks: single.has(i) ? [SIGNS[r.fav]] : [r.fav, r.partner].sort((a, b) => a - b).map((k) => SIGNS[k]),
  }));
}
