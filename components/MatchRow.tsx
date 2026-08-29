import Link from "next/link";
import type { Match, Team, LeagueId } from "@/lib/schema";
import { leagueMeta } from "@/lib/content";
import { resultSign, verdict } from "@/lib/scoring";
import { Coupon } from "./Coupon";
import { CalBar } from "./CalBar";
import { Tag } from "./Tag";

function scoreText(match: Match) {
  if (match.status === "played" && match.score) return `${match.score.home}\u2013${match.score.away}`;
  if (match.status === "postponed") return "P\u2013P";
  return "\u00b7 \u00b7";
}

function verdictLabel(v: ReturnType<typeof verdict>) {
  return v === "hit" ? "Hit" : v === "miss" ? "Miss" : "\u2014";
}

export function MatchRow({ match, teams }: { match: Match; teams: Map<string, Team> }) {
  const home = teams.get(match.home);
  const away = teams.get(match.away);
  const v = verdict(match);

  return (
    <div className="matchrow">
      <div className="matchrow-top">
        <div className="teams">
          <div className="team">{home?.name ?? match.home}</div>
          <div className="team">{away?.name ?? match.away}</div>
        </div>
        <Coupon marks={match.forecast?.marks} result={resultSign(match)} />
        <div className="score data">{scoreText(match)}</div>
      </div>

      <div className="matchrow-bottom">
        {match.forecast ? (
          <div style={{ flex: 1 }}>
            <CalBar probs={match.forecast.probs} />
          </div>
        ) : match.status === "pending" ? (
          <Tag variant="pending">Not yet played</Tag>
        ) : (
          <Tag variant="noforecast">No forecast</Tag>
        )}
        {match.forecast && <div style={{ flex: 1 }} />}
        <div className={`verdict ${v}`}>{verdictLabel(v)}</div>
      </div>
    </div>
  );
}

export function MatchList({ matches, teams }: { matches: Match[]; teams: Map<string, Team> }) {
  return (
    <div className="matchlist">
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} teams={teams} />
      ))}
    </div>
  );
}

type Located = { match: Match; season: string; league: LeagueId; matchweek: number };

/**
 * A coupon in coupon order - rows numbered 1..n, each with its calibration
 * bar and printed percentages (Rasti 03, Components), a link to the source
 * matchweek by league abbreviation, and the hit/miss verdict. Shared by the
 * home page's "this week's coupon" block and the full round page so the two
 * always render identically.
 */
export function CouponRows({ located, teams }: { located: Located[]; teams: Map<string, Team> }) {
  return (
    <div className="matchlist">
      {located.map(({ match: m, season, league, matchweek }, i) => {
        const v = verdict(m);
        return (
          <div key={m.id} className="matchrow">
            <div className="matchrow-top">
              <span className="data" style={{ width: 20, color: "var(--ink-faint)", fontSize: 12 }}>
                {i + 1}
              </span>
              <div className="teams">
                <div className="team">{teams.get(m.home)?.name ?? m.home}</div>
                <div className="team">{teams.get(m.away)?.name ?? m.away}</div>
              </div>
              <Coupon marks={m.forecast?.marks} result={resultSign(m)} />
              <div className="score data">{scoreText(m)}</div>
            </div>

            <div className="matchrow-bottom">
              {m.forecast ? (
                <div style={{ flex: 1 }}>
                  <CalBar probs={m.forecast.probs} legend />
                </div>
              ) : m.status === "pending" ? (
                <Tag variant="pending">Not yet played</Tag>
              ) : (
                <Tag variant="noforecast">No forecast</Tag>
              )}
              {!m.forecast && <div style={{ flex: 1 }} />}
              <Link
                className="more"
                href={`/${season}/${league}/mw-${String(matchweek).padStart(2, "0")}`}
                style={{ color: "var(--ink-faint)" }}
              >
                {leagueMeta(league).short}
              </Link>
              <div className={`verdict ${v}`}>{verdictLabel(v)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
