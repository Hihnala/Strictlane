import Link from "next/link";
import type { Match, Team, LeagueId } from "@/lib/schema";
import { leagueMeta } from "@/lib/content";
import { resultSign, verdict } from "@/lib/scoring";
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";
import { Coupon } from "./Coupon";
import { CalBar } from "./CalBar";
import { Tag } from "./Tag";

function scoreText(match: Match) {
  if (match.status === "played" && match.score) return `${match.score.home}–${match.score.away}`;
  if (match.status === "postponed") return "P–P";
  return "· ·";
}

function verdictLabel(v: ReturnType<typeof verdict>, dict: ReturnType<typeof getDictionary>) {
  return v === "hit" ? dict.common.hit : v === "miss" ? dict.common.miss : dict.common.dash;
}

export function MatchRow({
  match,
  teams,
  locale = "en",
}: {
  match: Match;
  teams: Map<string, Team>;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
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
        <Coupon marks={match.forecast?.marks} result={resultSign(match)} locale={locale} />
        <div className="score data">{scoreText(match)}</div>
      </div>

      <div className="matchrow-bottom">
        {match.forecast ? (
          <div style={{ flex: 1 }}>
            <CalBar probs={match.forecast.probs} />
          </div>
        ) : match.status === "pending" ? (
          <Tag variant="pending">{dict.common.notYetPlayed}</Tag>
        ) : (
          <Tag variant="noforecast">{dict.common.noForecast}</Tag>
        )}
        {match.forecast && <div style={{ flex: 1 }} />}
        <div className={`verdict ${v}`}>{verdictLabel(v, dict)}</div>
      </div>
    </div>
  );
}

export function MatchList({
  matches,
  teams,
  locale = "en",
}: {
  matches: Match[];
  teams: Map<string, Team>;
  locale?: Locale;
}) {
  return (
    <div className="matchlist">
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} teams={teams} locale={locale} />
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
export function CouponRows({
  located,
  teams,
  locale = "en",
}: {
  located: Located[];
  teams: Map<string, Team>;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const prefix = localePrefix(locale);
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
              <Coupon marks={m.forecast?.marks} result={resultSign(m)} locale={locale} />
              <div className="score data">{scoreText(m)}</div>
            </div>

            <div className="matchrow-bottom">
              {m.forecast ? (
                <div style={{ flex: 1 }}>
                  <CalBar probs={m.forecast.probs} legend />
                </div>
              ) : m.status === "pending" ? (
                <Tag variant="pending">{dict.common.notYetPlayed}</Tag>
              ) : (
                <Tag variant="noforecast">{dict.common.noForecast}</Tag>
              )}
              {!m.forecast && <div style={{ flex: 1 }} />}
              <Link
                className="more"
                href={`${prefix}/${season}/${league}/mw-${String(matchweek).padStart(2, "0")}`}
                style={{ color: "var(--ink-faint)" }}
              >
                {leagueMeta(league).short}
              </Link>
              <div className={`verdict ${v}`}>{verdictLabel(v, dict)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
