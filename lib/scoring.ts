import type { Match, ProbTriple, Sign } from "./schema.js";

/* ---------------------------------------------------------------------------
 * strictlane — scoring
 *
 * Nothing here is stored. Every number on the site is computed from the match
 * files at build time, so a figure can never drift out of sync with the data
 * that produced it.
 *
 * The organising principle, carried over from the research briefings: raw
 * accuracy is close to meaningless because it is dataset-dependent and rewards
 * always backing the favourite. What matters is Ranked Probability Score
 * tracked over time — a self-measure of forecast quality, not a comparison
 * against any external benchmark.
 * ------------------------------------------------------------------------- */

export const SIGNS: Sign[] = ["1", "X", "2"];

/** Which sign a finished match produced. */
export function resultSign(m: Match): Sign | null {
  if (m.status !== "played" || !m.score) return null;
  if (m.score.home > m.score.away) return "1";
  if (m.score.home < m.score.away) return "2";
  return "X";
}

function asFractions(p: ProbTriple): [number, number, number] {
  return [p["1"] / 100, p.X / 100, p["2"] / 100];
}

/* ------------------------------------------------------------------- RPS --- */

/**
 * Ranked Probability Score for a three-outcome ordered forecast.
 *
 *   RPS = 1/(r-1) · Σ_{i=1}^{r-1} ( Σ_{j=1}^{i} (p_j - o_j) )²
 *
 * Lower is better; 0 is a perfect call. Order matters and is 1 / X / 2 — the
 * ordering is what makes RPS punish a confident 1 that finished 2 harder than a
 * confident 1 that finished X. That is the right behaviour for football, and it
 * is why RPS rather than Brier is the primary metric here.
 *
 * Reference point: the best model in the 2017 Soccer Prediction Challenge
 * managed RPS ≈ 0.2054 across 206 fixtures — a rough sense of scale, not a
 * target this site is trying to hit.
 */
export function rps(probs: ProbTriple, result: Sign): number {
  const p = asFractions(probs);
  const o = SIGNS.map((s) => (s === result ? 1 : 0));
  let cp = 0;
  let co = 0;
  let sum = 0;
  for (let i = 0; i < SIGNS.length - 1; i++) {
    cp += p[i];
    co += o[i];
    sum += (cp - co) ** 2;
  }
  return sum / (SIGNS.length - 1);
}

/** Multi-category Brier score. Kept for cross-checking; RPS is the headline. */
export function brier(probs: ProbTriple, result: Sign): number {
  const p = asFractions(probs);
  return SIGNS.reduce((acc, s, i) => acc + (p[i] - (s === result ? 1 : 0)) ** 2, 0) / 2;
}

/** Log loss. Undefined at p = 0, so clipped — a zero forecast is never honest. */
export function logLoss(probs: ProbTriple, result: Sign, floor = 0.001): number {
  const p = asFractions(probs);
  const i = SIGNS.indexOf(result);
  return -Math.log(Math.max(p[i], floor));
}

/* -------------------------------------------------------------- verdicts --- */

export type Verdict = "hit" | "miss" | "none";

/** A forecast hits when the true result is among the marked signs. */
export function verdict(m: Match): Verdict {
  const r = resultSign(m);
  if (!r || !m.forecast) return "none";
  return m.forecast.marks.includes(r) ? "hit" : "miss";
}

/** Probability the marked signs cover the result, per our own numbers. */
export function coverage(probs: ProbTriple, marks: Sign[]): number {
  return marks.reduce((a, s) => a + probs[s], 0) / 100;
}

/* ---------------------------------------------------------- aggregation --- */

export interface ScoreSummary {
  scored: number;
  hits: number;
  misses: number;
  hitRate: number | null;
  meanRps: number | null;
}

/**
 * Aggregate a set of matches into hit rate and mean RPS — the two headline
 * self-measures. There's no external benchmark folded in here: this is
 * purely how good these forecasts were, on their own terms.
 */
export function summarise(matches: Match[]): ScoreSummary {
  let hits = 0;
  let misses = 0;
  let ours = 0;
  let scored = 0;

  for (const m of matches) {
    const r = resultSign(m);
    if (!r || !m.forecast) continue;
    scored++;
    if (m.forecast.marks.includes(r)) hits++;
    else misses++;
    ours += rps(m.forecast.probs, r);
  }

  return {
    scored,
    hits,
    misses,
    hitRate: scored ? hits / scored : null,
    meanRps: scored ? ours / scored : null,
  };
}

/* ------------------------------------------------------- coupon coverage --- */

export interface CouponOutlook {
  /** Σ coverage — how many of the marks we expect to be right. */
  expectedCovered: number;
  /** P(exactly k covered), index 0..n. */
  distribution: number[];
  /** P(all n covered) — the system contains a perfect row. */
  pAll: number;
  /** P(at least k covered). */
  atLeast(k: number): number;
}

/**
 * Poisson-binomial over per-match coverage probabilities.
 *
 * Assumes matches are independent, which slightly overstates the tails —
 * results correlate through shared conditions (weather, a refereeing directive,
 * an international break). Fine for sizing a coupon, not for a precise claim.
 */
export function couponOutlook(coverProbs: number[]): CouponOutlook {
  let dist = [1];
  for (const p of coverProbs) {
    const next = new Array(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * (1 - p);
      next[k + 1] += dist[k] * p;
    }
    dist = next;
  }
  return {
    expectedCovered: coverProbs.reduce((a, b) => a + b, 0),
    distribution: dist,
    pAll: dist[dist.length - 1],
    atLeast: (k: number) => dist.slice(k).reduce((a, b) => a + b, 0),
  };
}

/* ------------------------------------------------------------ calibration --- */

export interface CalibrationBin {
  lo: number;
  hi: number;
  n: number;
  meanPredicted: number | null;
  observed: number | null;
}

/**
 * Reliability check: of everything we called at ~60%, did ~60% happen?
 *
 * Every forecast contributes three data points (one per sign), which is what
 * makes this usable on a small sample — 13 matches gives 39 points.
 */
export function calibration(matches: Match[], bins = 5): CalibrationBin[] {
  const width = 100 / bins;
  const acc = Array.from({ length: bins }, (_, i) => ({
    lo: i * width,
    hi: (i + 1) * width,
    n: 0,
    sumP: 0,
    hits: 0,
  }));

  for (const m of matches) {
    const r = resultSign(m);
    if (!r || !m.forecast) continue;
    for (const s of SIGNS) {
      const p = m.forecast.probs[s];
      const i = Math.min(bins - 1, Math.floor(p / width));
      acc[i].n++;
      acc[i].sumP += p;
      if (s === r) acc[i].hits++;
    }
  }

  return acc.map((b) => ({
    lo: b.lo,
    hi: b.hi,
    n: b.n,
    meanPredicted: b.n ? b.sumP / b.n : null,
    observed: b.n ? (b.hits / b.n) * 100 : null,
  }));
}

/**
 * Predicted vs actual draws.
 *
 * Its own function because it is the specific failure this project has already
 * walked into: a coupon that excluded X on four soft favourites in a round that
 * produced five draws. Expected count is Σ P(X); the standard deviation is
 * √Σ p(1−p), which is what stops one bad weekend being read as a bias.
 */
export function drawWatch(matches: Match[]) {
  let expected = 0;
  let variance = 0;
  let actual = 0;
  let n = 0;

  for (const m of matches) {
    const r = resultSign(m);
    if (!r || !m.forecast) continue;
    const p = m.forecast.probs.X / 100;
    expected += p;
    variance += p * (1 - p);
    if (r === "X") actual++;
    n++;
  }

  const sd = Math.sqrt(variance);
  return {
    n,
    expected,
    actual,
    sd,
    /** how many standard deviations off we were; |z| < 2 is noise */
    z: sd > 0 ? (actual - expected) / sd : null,
  };
}

/** Outcome mix — useful as a base rate, and for the season grid. */
export function signMix(matches: Match[]) {
  const counts: Record<Sign, number> = { "1": 0, X: 0, "2": 0 };
  let n = 0;
  for (const m of matches) {
    const r = resultSign(m);
    if (!r) continue;
    counts[r]++;
    n++;
  }
  return { n, counts, share: n ? { "1": counts["1"] / n, X: counts.X / n, "2": counts["2"] / n } : null };
}
