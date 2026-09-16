import Link from "next/link";
import {
  LEAGUES, currentSeason, getTeams, latestSettledRound, openRound,
  latestPlayedMatchweek, getMatchweek, listMatchweeks,
} from "@/lib/content";
import { summarise, coverage, couponOutlook, resultSign } from "@/lib/scoring";
import { CouponRows } from "@/components/MatchRow";
import { Coupon } from "@/components/Coupon";
import { StatCell } from "@/components/StatCell";
import { Tag } from "@/components/Tag";

export default async function Home() {
  const season = await currentSeason();
  const teams = await getTeams();
  const open = await openRound();
  const last = await latestSettledRound();

  const cards = await Promise.all(
    LEAGUES.map(async (l) => {
      const mwNo = await latestPlayedMatchweek(season.id, l.id);
      const mw = mwNo ? await getMatchweek(season.id, l.id, mwNo) : null;
      const played = mw?.matches.filter((m) => m.status === "played").length ?? 0;
      const weeks = await listMatchweeks(season.id, l.id);
      return { ...l, mwNo, played, total: mw?.matches.length ?? 0, has: weeks.length > 0 };
    })
  );

  // The open coupon and the last settled one are shown side by side. Showing
  // only the newest round would hide the reviewable one the moment a coupon
  // lands — which is exactly what used to happen.
  const openMatches = open?.located.map((l) => l.match) ?? [];
  const openCov = openMatches.filter((m) => m.forecast).map((m) => coverage(m.forecast!.probs, m.forecast!.marks));
  const outlook = openCov.length ? couponOutlook(openCov) : null;

  const lastMatches = last?.located.map((l) => l.match) ?? [];
  const lastS = summarise(lastMatches);

  return (
    <div className="wrap">
      {open && (
        <section className="section">
          <div className="sec-label">This week&rsquo;s coupon &middot; {open.id}</div>
          <h1>{open.round.name}</h1>
          <p className="lede">
            {open.round.system
              ? `${open.round.system.type} \u00b7 ${open.round.system.singles} singles, ${open.round.system.doubles} doubles \u00b7 ${open.round.system.rows} rows`
              : "Single row"}
            {outlook ? ` \u00b7 ${outlook.expectedCovered.toFixed(1)} of 13 expected` : ""}
          </p>
          <div style={{ marginTop: "var(--s4)" }}>
            <CouponRows located={open.located} teams={teams} />
          </div>
          <p style={{ marginTop: "var(--s3)" }}>
            <Link className="more" href={`/rounds/${open.id}`}>Full coupon &rarr;</Link>
          </p>
        </section>
      )}

      {last && (
        <section className="section">
          <div className="sec-label">Last round &middot; {last.id}</div>
          <h2>{last.round.name}</h2>

          {/* Coupon shape at a glance — marks filled, true results underlined. */}
          <div className="roundcard-strips" style={{ marginBottom: "var(--s4)" }}>
            {last.located.map(({ match: m }) => (
              <Coupon key={m.id} size="sm" marks={m.forecast?.marks} result={resultSign(m)} />
            ))}
          </div>

          <div className="stat-grid">
            <StatCell value={`${lastS.hits}/${lastS.scored}`} label="Correct"
              sub={lastS.hitRate !== null ? `${(lastS.hitRate * 100).toFixed(0)}%` : undefined} />
            <StatCell value={lastS.meanRps !== null ? lastS.meanRps.toFixed(4) : "\u2014"} label="Mean RPS" />
          </div>
          <p style={{ marginTop: "var(--s3)" }}>
            <Link className="more" href={`/rounds/${last.id}`}>Review &rarr;</Link>
            {"  "}
            <Link className="more" href="/rounds" style={{ marginLeft: "var(--s4)" }}>All rounds &rarr;</Link>
          </p>
        </section>
      )}

      {!open && !last && <div className="empty">No coupon rounds logged yet.</div>}

      <section className="section">
        <div className="sec-label">By league</div>
        {cards.map((c) => (
          <Link key={c.id} className="leaguecard" href={`/${season.id}/${c.id}`}>
            <span className="name">{c.label}</span>
            {c.has ? (
              <span className="meta data">MW {c.mwNo} &middot; {c.played}/{c.total}</span>
            ) : (
              <Tag variant="pending">No data</Tag>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
