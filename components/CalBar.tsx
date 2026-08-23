import type { ProbTriple } from "@/lib/schema";

/** The three-outcome probability bar — always 1 / X / 2, left to right. */
export function CalBar({ probs }: { probs: ProbTriple }) {
  const label = `1: ${probs["1"]}%, X: ${probs.X}%, 2: ${probs["2"]}%`;
  return (
    <div className="calbar" role="img" aria-label={label}>
      <span className="p1" style={{ width: `${probs["1"]}%` }} />
      <span className="px" style={{ width: `${probs.X}%` }} />
      <span className="p2" style={{ width: `${probs["2"]}%` }} />
    </div>
  );
}
