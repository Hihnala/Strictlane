import Link from "next/link";
import type { Match, Team, LeagueId } from "@/lib/schema";
import { resultSign, verdict } from "@/lib/scoring";
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";
import { Coupon } from "./Coupon";
import { CalBar } from "./CalBar";

type Located = { match: Match; season: string; league: LeagueId; matchweek: number };

function scoreText(m: Match) {
  if (m.status === "played" && m.score) return `${m.score.home}–${m.score.away}`;
  if (m.status === "postponed") return "P–P";
  return "· ·";
}

/**
 * A coupon in coupon order, one 46px row per match: number, teams, the
 * probability bar with its legend, marks, a link to the source matchweek,
 * score and verdict. Wraps to two lines on narrow screens. Shared by the home
 * page and the round page so the two always render identically.
 *
 * Rows carry data-row (cascade inside a <Reveal>); bar segments carry
 * data-grow.
 */
export function CouponList({
  located,
  teams,
  locale = "en",
  glow = false,
}: {
  located: Located[];
  teams: Map<string, Team>;
  locale?: Locale;
  glow?: boolean;
}) {
  const dict = getDictionary(locale);
  const prefix = localePrefix(locale);
  const anyResult = located.some(({ match }) => resultSign(match) !== null);

  return (
    <div className="clist">
      {located.map(({ match: m, season, league, matchweek }, i) => {
        const v = verdict(m);
        const home = teams.get(m.home)?.name ?? m.home;
        const away = teams.get(m.away)?.name ?? m.away;
        return (
          <div key={m.id} className="crow" data-row="">
            <span className="crow-n">{i + 1}</span>
            <span className="crow-teams">
              {home} <span className="sep">–</span> {away}
            </span>
            <div className="crow-bar">
              {m.forecast ? (
                <CalBar probs={m.forecast.probs} legend />
              ) : (
                <span className="tag pending">{dict.common.noForecast}</span>
              )}
            </div>
            <div className="crow-end">
              <Coupon marks={m.forecast?.marks} result={resultSign(m)} locale={locale} glow={glow} />
              <Link
                className="crow-lg"
                href={`${prefix}/${season}/${league}/mw-${String(matchweek).padStart(2, "0")}`}
              >
                {dict.leagues[league].short}
              </Link>
              <span className={`crow-score${m.status === "played" ? "" : " pending"}`}>{scoreText(m)}</span>
              <span className={`crow-verdict ${v}${anyResult ? "" : " compact"}`}>
                {v === "hit" ? `✓ ${dict.common.hit}` : v === "miss" ? `✕ ${dict.common.miss}` : dict.common.dash}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
