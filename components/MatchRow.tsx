import type { Match, Team } from "@/lib/schema";
import { resultSign, verdict } from "@/lib/scoring";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";
import { Coupon } from "./Coupon";
import { CalBar } from "./CalBar";

function scoreText(match: Match) {
  if (match.status === "played" && match.score) return `${match.score.home}–${match.score.away}`;
  if (match.status === "postponed") return "P–P";
  return "· ·";
}

/**
 * A matchweek's fixtures, one row each: teams, the probability bar (or a
 * "no forecast" pill — a match that was never forecast is shown, not hidden),
 * marks, score and verdict. Rows carry data-row; bar segments data-grow.
 * The coupon-ordered variant with numbers and league links is CouponList.
 */
export function MatchList({
  matches,
  teams,
  locale = "en",
}: {
  matches: Match[];
  teams: Map<string, Team>;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  return (
    <div className="clist">
      {matches.map((m) => {
        const v = verdict(m);
        return (
          <div key={m.id} className="crow mw" data-row="">
            <span className="crow-teams">
              {teams.get(m.home)?.name ?? m.home} <span className="sep">–</span> {teams.get(m.away)?.name ?? m.away}
            </span>
            <div className="crow-bar">
              {m.forecast ? (
                <CalBar probs={m.forecast.probs} />
              ) : (
                <span className="nf-pill">
                  {m.status === "pending" ? dict.common.notYetPlayed : dict.common.noForecast}
                </span>
              )}
            </div>
            <div className="crow-end">
              <Coupon marks={m.forecast?.marks} result={resultSign(m)} locale={locale} />
              <span className={`crow-score${m.status === "played" ? "" : " pending"}`}>{scoreText(m)}</span>
              <span className={`crow-verdict ${v}`}>
                {v === "hit" ? `✓ ${dict.common.hit}` : v === "miss" ? `✕ ${dict.common.miss}` : dict.common.dash}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
