import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { listRounds, getRound, getRoundMatches, getTeams, getRoundCommentary, roundNeighbours } from "@/lib/content";
import { summarise, coverage, couponOutlook, drawWatch } from "@/lib/scoring";
import { CouponRows } from "@/components/MatchRow";
import { StatCell } from "@/components/StatCell";
import { Prose } from "@/components/Prose";

export async function generateStaticParams() {
  return (await listRounds()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await getRound(id);
  return { title: r?.name ?? id };
}

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const round = await getRound(id);
  if (!round) notFound();

  const located = await getRoundMatches(id);
  const matches = located.map((l) => l.match);
  const teams = await getTeams();
  const commentary = await getRoundCommentary(id);
  const { newer, older } = await roundNeighbours(id);
  const s = summarise(matches);
  const draws = drawWatch(matches);

  const cov = matches.filter((m) => m.forecast).map((m) => coverage(m.forecast!.probs, m.forecast!.marks));
  const outlook = cov.length ? couponOutlook(cov) : null;

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">Round &middot; {id}</div>
        <h1>{round.name}</h1>
        {round.system && (
          <p className="lede">
            {round.system.type} &middot; {round.system.singles} singles, {round.system.doubles} doubles
            {round.system.triples ? `, ${round.system.triples} triples` : ""} &middot;{" "}
            {round.system.rows} rows
          </p>
        )}

        {/* The coupon in coupon order — the order is data, not presentation. */}
        <div style={{ marginTop: "var(--s4)" }}>
          <CouponRows located={located} teams={teams} />
        </div>
      </section>

      <section className="section">
        <div className="sec-label">Scoring</div>
        <div className="stat-grid">
          <StatCell value={`${s.hits}/${s.scored}`} label="Correct"
            sub={outlook ? `${outlook.expectedCovered.toFixed(2)} expected` : undefined} />
          <StatCell value={s.meanRps ? s.meanRps.toFixed(4) : "\u2014"} label="Mean RPS"
            sub={s.meanMarketRps ? `market ${s.meanMarketRps.toFixed(4)}` : undefined} />
          <StatCell value={`${draws.actual}/${draws.expected.toFixed(1)}`} label="Draws act/exp"
            sub={draws.z !== null ? `z ${draws.z.toFixed(2)}` : undefined} />
        </div>

        {outlook && (
          <table className="table" style={{ marginTop: "var(--s4)" }}>
            <thead>
              <tr><th>Outcome</th><th className="num">Probability</th><th className="num">Odds</th></tr>
            </thead>
            <tbody>
              {[matches.length, matches.length - 1, matches.length - 2, matches.length - 3]
                .filter((k) => k > 0)
                .map((k) => {
                  const p = k === matches.length ? outlook.pAll : outlook.distribution[k];
                  return (
                    <tr key={k}>
                      <td>{k === matches.length ? `All ${k} covered` : `Exactly ${k}`}</td>
                      <td className="num data">{(p * 100).toFixed(2)}%</td>
                      <td className="num data">{p > 0 ? `1 in ${Math.round(1 / p)}` : "\u2014"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </section>

      {commentary && (
        <section className="section">
          <div className="sec-label">Review</div>
          <Prose html={commentary.html} />
        </section>
      )}

      {/* Walk the archive without going back to the index each time. */}
      <nav className="roundnav" aria-label="Other rounds">
        {older ? <Link href={`/rounds/${older}`}>&larr; {older}</Link> : <span />}
        <span className="spacer" />
        <Link href="/rounds" style={{ border: "none" }}>All rounds</Link>
        <span className="spacer" />
        {newer ? <Link href={`/rounds/${newer}`}>{newer} &rarr;</Link> : <span />}
      </nav>
    </div>
  );
}
