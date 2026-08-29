import type { ProbTriple } from "@/lib/schema";

/**
 * The three-outcome probability bar — always 1 / X / 2, left to right.
 * With `legend`, the percentages print underneath as `1 · NN` etc.
 * (Rasti brand system, 03 — Components).
 */
export function CalBar({ probs, legend = false }: { probs: ProbTriple; legend?: boolean }) {
  const label = `1: ${probs["1"]}%, X: ${probs.X}%, 2: ${probs["2"]}%`;
  return (
    <>
      <div className="calbar" role="img" aria-label={label}>
        <span className="p1" style={{ width: `${probs["1"]}%` }} />
        <span className="px" style={{ width: `${probs.X}%` }} />
        <span className="p2" style={{ width: `${probs["2"]}%` }} />
      </div>
      {legend && (
        <div className="calbar-legend" aria-hidden="true">
          <span className="l1">1 &middot; {Math.round(probs["1"])}</span>
          <span className="lx">X &middot; {Math.round(probs.X)}</span>
          <span className="l2">2 &middot; {Math.round(probs["2"])}</span>
        </div>
      )}
    </>
  );
}
