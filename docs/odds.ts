/* ---------------------------------------------------------------------------
 * Converting bookmaker odds to probabilities.
 *
 * Raw implied probabilities (1/odds) sum to more than 1. The excess is the
 * bookmaker's margin — the "overround". Removing it is a modelling choice, not
 * arithmetic, and the two common choices disagree most exactly where football
 * forecasting is hardest: on longshots.
 * ------------------------------------------------------------------------- */

export type Triple = [number, number, number]; // [home, draw, away]

/** Raw implied probabilities, still containing the margin. */
export function implied(odds: Triple): Triple {
  return odds.map((o) => 1 / o) as Triple;
}

/** Bookmaker margin, e.g. 0.0676 for a 6.76% book. */
export function overround(odds: Triple): number {
  return implied(odds).reduce((a, b) => a + b, 0) - 1;
}

/**
 * Proportional (multiplicative) normalisation. Divides every implied
 * probability by the book sum.
 *
 * Simple and standard, but it assumes the margin is spread evenly across the
 * three outcomes. It isn't: the favourite-longshot bias means books load more
 * margin onto longshots, so this method systematically *overstates* the
 * longshot and understates the favourite.
 */
export function proportional(odds: Triple): Triple {
  const p = implied(odds);
  const s = p[0] + p[1] + p[2];
  return [p[0] / s, p[1] / s, p[2] / s];
}

/**
 * Power (odds-ratio-free) method. Solves for k such that Σ pᵢᵏ = 1.
 *
 * Because k > 1, raising each probability to k shrinks small probabilities
 * more than large ones, which is the right direction for favourite-longshot
 * bias. On a 6.8% book this moves a 12% longshot down by roughly 1.3pp
 * relative to proportional — small per match, but it compounds across a season
 * of RPS comparisons.
 *
 * Bisection: monotone in k, converges in well under 80 iterations.
 */
export function power(odds: Triple): Triple {
  const raw = implied(odds);
  let lo = 0.5;
  let hi = 1.5;
  for (let i = 0; i < 80; i++) {
    const k = (lo + hi) / 2;
    const s = raw.reduce((a, p) => a + Math.pow(p, k), 0);
    if (s > 1) lo = k;
    else hi = k;
  }
  const k = (lo + hi) / 2;
  return raw.map((p) => Math.pow(p, k)) as Triple;
}

export type MarginMethod = "proportional" | "power";

/** Returns whole-number percentages, rounded so they sum to exactly 100. */
export function toProbs(odds: Triple, method: MarginMethod, dp = 1) {
  const p = method === "power" ? power(odds) : proportional(odds);
  const f = Math.pow(10, dp);
  const pct = p.map((x) => Math.round(x * 100 * f) / f) as Triple;

  // Push any rounding residue onto the largest component so the triple sums to 100.
  const residue = Math.round((100 - (pct[0] + pct[1] + pct[2])) * f) / f;
  if (residue !== 0) {
    const i = pct.indexOf(Math.max(...pct));
    pct[i] = Math.round((pct[i] + residue) * f) / f;
  }
  return { "1": pct[0], X: pct[1], "2": pct[2] };
}

/**
 * Pick the best available closing-odds column set from a football-data row.
 *
 * Preference order, and why:
 *   AvgC*  cross-book average closing — the consensus. Closest to the thing the
 *          literature calls "the market", and what Kaunitz et al. regressed.
 *   PSC*   Pinnacle closing — sharpest single book, low margin, good fallback.
 *   B365C* Bet365 closing — widest coverage in older files.
 *   Avg*   pre-closing average, last resort. Flagged in the source string so a
 *          row built from it is never silently compared against closing lines.
 */
export function pickOdds(row: Record<string, string>):
  | { odds: Triple; source: string }
  | null {
  const sets: Array<[string, string, string, string]> = [
    ["AvgCH", "AvgCD", "AvgCA", "football-data:AvgC"],
    ["PSCH", "PSCD", "PSCA", "football-data:PSC"],
    ["B365CH", "B365CD", "B365CA", "football-data:B365C"],
    ["AvgH", "AvgD", "AvgA", "football-data:Avg(pre-close)"],
    ["B365H", "B365D", "B365A", "football-data:B365(pre-close)"],
  ];
  for (const [h, d, a, source] of sets) {
    const oh = Number(row[h]);
    const od = Number(row[d]);
    const oa = Number(row[a]);
    if (oh > 1 && od > 1 && oa > 1) return { odds: [oh, od, oa], source };
  }
  return null;
}
