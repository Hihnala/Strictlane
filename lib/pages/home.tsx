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
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";

/** Shared by app/page.tsx (English, locale="en") and app/fi/page.tsx (locale="fi") — see I18N-PLAN.md §2.
 *  Next.js's app-router typechecking only allows a fixed set of exports from a page.tsx file
 *  (default, metadata, generateStaticParams, …), so the actual render logic lives here instead
 *  and the two page.tsx files stay thin wrappers that just pick a locale. */
export async function renderHome(locale: Locale) {
  const dict = getDictionary(locale);
  const prefix = localePrefix(locale);
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
          <div className="sec-label">{dict.home.thisWeeksCoupon} &middot; {open.id}</div>
          <h1>{open.round.name}</h1>
          <p className="lede">
            {open.round.system
              ? dict.home.system(open.round.system.type, open.round.system.singles, open.round.system.doubles, open.round.system.rows)
              : dict.home.singleRow}
            {outlook ? dict.home.expectedOf13(outlook.expectedCovered.toFixed(1)) : ""}
          </p>
          <div style={{ marginTop: "var(--s4)" }}>
            <CouponRows located={open.located} teams={teams} locale={locale} />
          </div>
          <p style={{ marginTop: "var(--s3)" }}>
            <Link className="more" href={`${prefix}/rounds/${open.id}`}>{dict.common.fullCouponArrow}</Link>
          </p>
        </section>
      )}

      {last && (
        <section className="section">
          <div className="sec-label">{dict.home.lastRound} &middot; {last.id}</div>
          <h2>{last.round.name}</h2>

          {/* Coupon shape at a glance — marks filled, true results underlined. */}
          <div className="roundcard-strips" style={{ marginBottom: "var(--s4)" }}>
            {last.located.map(({ match: m }) => (
              <Coupon key={m.id} size="sm" marks={m.forecast?.marks} result={resultSign(m)} locale={locale} />
            ))}
          </div>

          <div className="stat-grid">
            <StatCell value={`${lastS.hits}/${lastS.scored}`} label={dict.common.correct}
              sub={lastS.hitRate !== null ? `${(lastS.hitRate * 100).toFixed(0)}%` : undefined} />
            <StatCell value={lastS.meanRps !== null ? lastS.meanRps.toFixed(4) : dict.common.dash} label={dict.common.meanRps} />
          </div>
          <p style={{ marginTop: "var(--s3)" }}>
            <Link className="more" href={`${prefix}/rounds/${last.id}`}>{dict.common.reviewArrow}</Link>
            {"  "}
            <Link className="more" href={`${prefix}/rounds`} style={{ marginLeft: "var(--s4)" }}>{dict.common.allRoundsArrow}</Link>
          </p>
        </section>
      )}

      {!open && !last && <div className="empty">{dict.home.noRoundsYet}</div>}

      <section className="section">
        <div className="sec-label">{dict.home.byLeague}</div>
        {cards.map((c) => (
          <Link key={c.id} className="leaguecard" href={`${prefix}/${season.id}/${c.id}`}>
            <span className="name">{c.label}</span>
            {c.has ? (
              <span className="meta data">{dict.home.mwProgress(c.mwNo ?? 0, c.played, c.total)}</span>
            ) : (
              <Tag variant="pending">{dict.home.noData}</Tag>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
