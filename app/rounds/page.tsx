import type { Metadata } from "next";
import { getRoundSummaries } from "@/lib/content";
import { summarise } from "@/lib/scoring";
import { RoundCard } from "@/components/RoundCard";
import { StatCell } from "@/components/StatCell";

export const metadata: Metadata = { title: "Coupon rounds" };

/** The archive. Every Lauantaivakio played, newest first, permanently. */
export default async function RoundsIndex() {
  const rounds = await getRoundSummaries();
  const settled = rounds.filter((r) => r.status === "settled");

  // Season totals computed across every settled round.
  const allMatches = settled.flatMap((r) => r.located.map((l) => l.match));
  const s = summarise(allMatches);

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">Archive</div>
        <h1>Coupon rounds</h1>
        <p className="lede">
          Every Lauantaivakio, kept permanently. A round cuts across leagues, so it is tracked
          separately from the matchweek record — each one holds the marks played, what they
          returned, and how the forecasts scored.
        </p>

        {settled.length > 0 && (
          <div className="stat-grid" style={{ marginTop: "var(--s5)" }}>
            <StatCell
              value={String(settled.length)}
              label="Rounds settled"
              sub={rounds.length > settled.length ? `${rounds.length - settled.length} open` : undefined}
            />
            <StatCell value={`${s.hits}/${s.scored}`} label="Correct"
              sub={s.hitRate !== null ? `${(s.hitRate * 100).toFixed(0)}%` : undefined} />
            <StatCell value={s.meanRps !== null ? s.meanRps.toFixed(4) : "\u2014"} label="Mean RPS" />
          </div>
        )}
      </section>

      <section className="section">
        {rounds.length === 0 && <div className="empty">No rounds logged yet.</div>}
        {rounds.map((r) => (
          <RoundCard key={r.id} r={r} />
        ))}
      </section>
    </div>
  );
}
