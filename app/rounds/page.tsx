import Link from "next/link";
import type { Metadata } from "next";
import { listRounds, getRound, getRoundMatches } from "@/lib/content";
import { summarise } from "@/lib/scoring";

export const metadata: Metadata = { title: "Rounds" };

export default async function RoundsIndexPage() {
  const ids = await listRounds();
  const rounds = await Promise.all(
    ids.map(async (id) => {
      const round = await getRound(id);
      const located = await getRoundMatches(id);
      const s = summarise(located.map((l) => l.match));
      return { id, round, s };
    })
  );

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">Forecasting log</div>
        <h1>Rounds</h1>
        <p className="lede">
          Every coupon round, in order — the record of what was called
          before kickoff, cutting across all three leagues.
        </p>

        {rounds.length ? (
          rounds.map(({ id, round, s }) => (
            <Link key={id} className="roundcard" href={`/rounds/${id}`}>
              <div className="top">
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>
                  {round?.name ?? id}
                </span>
                <span className="meta data">
                  {s.scored ? `${s.hits}/${s.scored}` : "—"}
                </span>
              </div>
              <span className="muted" style={{ fontSize: 12.5 }}>{id}</span>
            </Link>
          ))
        ) : (
          <div className="empty">No coupon rounds logged yet.</div>
        )}
      </section>
    </div>
  );
}
