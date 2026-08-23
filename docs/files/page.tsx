import Link from "next/link";
import { LEAGUES, currentSeason, getTeams, listRounds, getRound, getRoundMatches,
  latestPlayedMatchweek, getMatchweek, listMatchweeks } from "@/lib/content";
import { summarise, coverage, couponOutlook } from "@/lib/scoring";
import { MatchList } from "@/components/MatchRow";
import { StatCell } from "@/components/StatCell";
import { Tag } from "@/components/Tag";

export default async function Home() {
  const season = await currentSeason();
  const teams = await getTeams();
  const roundIds = await listRounds();
  const latestId = roundIds[0] ?? null;
  const round = latestId ? await getRound(latestId) : null;
  const located = latestId ? await getRoundMatches(latestId) : [];
  const matches = located.map((l) => l.match);
  const s = summarise(matches);

  const cov = matches.filter((m) => m.forecast).map((m) => coverage(m.forecast!.probs, m.forecast!.marks));
  const outlook = cov.length ? couponOutlook(cov) : null;

  // League cards
  const cards = await Promise.all(
    LEAGUES.map(async (l) => {
      const mwNo = await latestPlayedMatchweek(season.id, l.id);
      const mw = mwNo ? await getMatchweek(season.id, l.id, mwNo) : null;
      const played = mw?.matches.filter((m) => m.status === "played").length ?? 0;
      const total = mw?.matches.length ?? 0;
      const weeks = await listMatchweeks(season.id, l.id);
      return { ...l, mwNo, played, total, has: weeks.length > 0 };
    })
  );

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">
          {round ? `Latest round · ${latestId}` : "Latest"}
        </div>
        <h1>{round?.name ?? "No rounds logged yet"}</h1>

        {round ? (
          <>
            <p className="lede">
              {round.system
                ? `${round.system.type} system · ${round.system.singles} singles, ${round.system.doubles} doubles · ${round.system.rows} rows`
                : "Single row"}
            </p>

            <div style={{ marginTop: "var(--s4)" }}>
              <MatchList matches={matches} teams={teams} />
            </div>

            <div className="stat-grid" style={{ marginTop: "var(--s4)" }}>
              <StatCell
                value={`${s.hits}/${s.scored}`}
                label="Correct"
                sub={outlook ? `${outlook.expectedCovered.toFixed(1)} expected` : undefined}
              />
              <StatCell
                value={s.meanRps ? s.meanRps.toFixed(4) : "\u2014"}
                label="Mean RPS"
                sub={s.meanMarketRps ? `market ${s.meanMarketRps.toFixed(4)}` : undefined}
              />
              <StatCell
                value={s.rpsDelta !== null ? (s.rpsDelta <= 0 ? "" : "+") + s.rpsDelta.toFixed(4) : "\u2014"}
                label="vs market"
                sub={s.rpsDelta !== null && s.rpsDelta < 0 ? "ahead" : "behind"}
              />
            </div>

            <p style={{ marginTop: "var(--s3)" }}>
              <Link className="more" href={`/rounds/${latestId}`}>
                Full round \u2192
              </Link>
            </p>
          </>
        ) : (
          <div className="empty">No coupon rounds logged yet.</div>
        )}
      </section>

      <section className="section">
        <div className="sec-label">By league</div>
        {cards.map((c) => (
          <Link key={c.id} className="leaguecard" href={`/${season.id}/${c.id}`}>
            <span className="name">{c.label}</span>
            {c.has ? (
              <span className="meta data">
                MW {c.mwNo} \u00b7 {c.played}/{c.total}
              </span>
            ) : (
              <Tag variant="pending">No data</Tag>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
