import type { Match, Team } from "@/lib/schema";
import { resultSign, verdict } from "@/lib/scoring";
import { Coupon } from "./Coupon";
import { CalBar } from "./CalBar";
import { Tag } from "./Tag";

export function MatchRow({ match, teams }: { match: Match; teams: Map<string, Team> }) {
  const home = teams.get(match.home);
  const away = teams.get(match.away);
  const result = resultSign(match);
  const v = verdict(match);

  return (
    <div className="matchrow">
      <div className="matchrow-top">
        <div className="teams">
          <div className="team">{home?.name ?? match.home}</div>
          <div className="team">{away?.name ?? match.away}</div>
        </div>
        <Coupon marks={match.forecast?.marks} result={result} />
        <div className="score data">
          {match.status === "played" && match.score
            ? `${match.score.home}\u2013${match.score.away}`
            : match.status === "postponed"
              ? "P\u2013P"
              : "\u00b7 \u00b7"}
        </div>
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
        <div className={`verdict ${v}`}>{v === "hit" ? "Hit" : v === "miss" ? "Miss" : "\u2014"}</div>
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
