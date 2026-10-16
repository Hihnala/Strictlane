import Link from "next/link";
import {
  LEAGUES, currentSeason, getTeams, latestSettledRound, openRound, getRoundSummaries,
  latestPlayedMatchweek, getMatchweek, listMatchweeks, type RoundSummary,
} from "@/lib/content";
import type { Team } from "@/lib/schema";
import { summarise, coverage, couponOutlook, resultSign, verdict } from "@/lib/scoring";
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";
import {
  fmtDate, fmtShortDate, fmtLongDate, fmtDay, fmtTime, fmtDec, fmtLead, fmtStamp, zonedInstant, addDays,
} from "@/lib/format";
import { Ambient } from "@/components/Ambient";
import { Coupon } from "@/components/Coupon";
import { CouponList } from "@/components/CouponList";
import { CouponCard, type SlipRow } from "@/components/CouponCard";
import { HeroTimeline } from "@/components/HeroTimeline";
import { SeasonStrip } from "@/components/SeasonStrip";
import { StatCard } from "@/components/StatCard";
import { Tag } from "@/components/Tag";
import { Rise } from "@/components/motion/Rise";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";

/** Shared by app/page.tsx (English, locale="en") and app/fi/page.tsx (locale="fi") — see I18N-PLAN.md §2.
 *  Next.js's app-router typechecking only allows a fixed set of exports from a page.tsx file
 *  (default, metadata, generateStaticParams, …), so the actual render logic lives here instead
 *  and the two page.tsx files stay thin wrappers that just pick a locale.
 *
 *  Two hero states, derived at build time (the site rebuilds on push):
 *    open     a coupon is live (no results yet) → sealed coupon hero + coupon list + last round
 *    between  no live coupon → settled hero with countdown + the season's last six coupons */

function slipRows(r: RoundSummary, teams: Map<string, Team>): SlipRow[] {
  return r.located.map(({ match: m }, i) => ({
    n: i + 1,
    home: teams.get(m.home)?.name ?? m.home,
    away: teams.get(m.away)?.name ?? m.away,
    marks: m.forecast?.marks,
    result: resultSign(m),
    score: m.status === "played" && m.score ? `${m.score.home}–${m.score.away}` : "· ·",
    verdict: verdict(m),
  }));
}

/** Σ coverage — how many marks the forecasts themselves expected to land. */
function expectedCovered(r: RoundSummary): number {
  return r.located.reduce((a, { match: m }) => a + (m.forecast ? coverage(m.forecast.probs, m.forecast.marks) : 0), 0);
}

/** First weekday `dow` (0 = Sun) strictly after `date`. */
function nextWeekday(date: string, dow: number): string {
  const cur = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, ((dow - cur + 7) % 7) || 7);
}

export async function renderHome(locale: Locale) {
  const dict = getDictionary(locale);
  const t = dict.homeHero;
  const prefix = localePrefix(locale);
  const fi = locale === "fi";
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

  const lastMatches = last?.located.map((l) => l.match) ?? [];
  const lastS = summarise(lastMatches);

  /* ------------------------------------------------------------ open --- */
  let openHero: React.ReactNode = null;
  let openOutlook: ReturnType<typeof couponOutlook> | null = null;
  if (open) {
    const matches = open.located.map((l) => l.match);
    const covs = matches.filter((m) => m.forecast).map((m) => coverage(m.forecast!.probs, m.forecast!.marks));
    openOutlook = covs.length ? couponOutlook(covs) : null;
    const captured = matches.map((m) => m.forecast?.capturedAt).filter((x): x is string => !!x).sort().at(-1);
    const kickoff = matches.map((m) => m.kickoff).sort()[0];
    const sys = open.round.system;

    openHero = (
      <section className="hero">
        <div>
          <Rise i={0}>
            <span className="eyebrow-pill"><span className="dot" />{t.eyebrowOpen(fmtDate(open.id, locale))}</span>
          </Rise>
          <Rise i={1} as="h1">{t.h1Open}</Rise>
          <Rise i={2} as="p" className="hero-sub">{t.subOpen}</Rise>
          {captured && kickoff && (
            <Rise i={3} className="hero-times">
              <div>
                <div className="hero-fig">{fmtTime(captured, locale)}</div>
                <div className="hero-fig-label">{t.sealed}</div>
              </div>
              <div className="rule" />
              <div>
                <div className="hero-fig dim">{fmtTime(kickoff, locale)}</div>
                <div className="hero-fig-label">{t.kickoff} · {t.tz}</div>
              </div>
            </Rise>
          )}
        </div>
        <Rise i={2} style={{ width: "100%" }}>
          <CouponCard
            locale={locale}
            title={open.round.name}
            meta={sys ? `${sys.type} · ${sys.rows}` : dict.home.singleRow}
            replayLabel={t.replay}
            rows={slipRows(open, teams)}
            seal={{
              variant: "open",
              label: captured && kickoff ? t.sealedLine(fmtLead(Date.parse(kickoff) - Date.parse(captured))) : t.sealed,
              value: captured ? fmtStamp(captured) : dict.common.dash,
            }}
          />
        </Rise>
      </section>
    );
  }

  /* --------------------------------------------------------- between --- */
  let betweenHero: React.ReactNode = null;
  let seasonSection: React.ReactNode = null;
  if (!open && last) {
    const exp = fmtDec(expectedCovered(last), 2, locale);
    const fri = nextWeekday(last.id, 5);
    const sat = nextWeekday(fri, 6);
    const lastKickoff = lastMatches.map((m) => m.kickoff).sort().at(-1)!;
    const settledAt = Date.parse(lastKickoff) + 2 * 36e5;
    const fetchAt = zonedInstant(fri, 19, 0, "Europe/Helsinki").getTime();
    const kickoffAt = zonedInstant(sat, 15, 0, "Europe/London").getTime();

    betweenHero = (
      <section className="hero">
        <div>
          <Rise i={0}>
            <span className="eyebrow-pill"><span className="dot ring" />{t.eyebrowBetween(fmtDay(sat, locale))}</span>
          </Rise>
          <Rise i={1} as="h1">{t.h1Between}</Rise>
          <Rise i={2} as="p" className="hero-sub">
            {t.subBetween(fmtLongDate(last.id, locale), lastS.hits, lastS.scored, exp)}
          </Rise>
          <Rise i={3}>
            <HeroTimeline
              buildNow={Date.now()}
              settledAt={settledAt}
              fetchAt={fetchAt}
              kickoffAt={kickoffAt}
              steps={[
                { label: t.stepSettled, date: fmtDay(last.id, locale), at: settledAt },
                { label: t.stepPublished, date: fmtDay(fri, locale), at: fetchAt },
                { label: t.stepSealed, date: fmtDay(sat, locale), at: kickoffAt },
              ]}
              labels={{
                toKickoff: t.toKickoff(fmtTime(new Date(kickoffAt), locale)),
                now: t.now, unitD: t.unitD, unitH: t.unitH, unitM: t.unitM, passed: t.passed,
              }}
            />
          </Rise>
        </div>
        <Rise i={2} style={{ width: "100%" }}>
          <CouponCard
            locale={locale}
            title={<>{last.round.name} <span className="data">{last.id}</span></>}
            replayLabel={t.replay}
            rows={slipRows(last, teams)}
            seal={{
              variant: "settled",
              label: t.settledLine(lastS.hits, lastS.scored, exp),
              value: lastS.meanRps !== null ? `RPS ${fmtDec(lastS.meanRps, 4, locale)}` : "",
            }}
          />
          <div className="links-row" style={{ marginTop: 20, paddingLeft: 4 }}>
            <Link href={`${prefix}/rounds/${last.id}`}>{dict.common.reviewArrow}</Link>
            <Link href={`${prefix}/rounds`}>{dict.common.allRoundsArrow}</Link>
          </div>
        </Rise>
      </section>
    );

    // This season: settled rounds whose matches belong to the current season, oldest first.
    const seasonRounds = (await getRoundSummaries())
      .filter((r) => r.status === "settled" && r.located[0]?.season === season.id)
      .reverse();
    const totals = summarise(seasonRounds.flatMap((r) => r.located.map((l) => l.match)));
    const columns = seasonRounds.slice(-6).map((r) => {
      const s = summarise(r.located.map((l) => l.match));
      return {
        id: r.id, href: `${prefix}/rounds/${r.id}`, label: fmtShortDate(r.id, locale),
        hits: s.hits, scored: s.scored, rps: s.meanRps !== null ? fmtDec(s.meanRps, 4, locale) : dict.common.dash,
      };
    });

    seasonSection = (
      <section className="wide home-season">
        <Reveal className="label-mono">{t.seasonLabel} · {season.label}</Reveal>
        <Reveal as="h2" className="h2-sealed">{t.seasonTitle}</Reveal>
        <div className="season-grid">
          <Reveal className="season-card">
            <SeasonStrip columns={columns} />
            <div className="season-foot">
              <p>{t.seasonNote}</p>
              <Link href={`${prefix}/rounds`}>{dict.common.allRoundsArrow}</Link>
            </div>
          </Reveal>
          <div className="totals">
            <Reveal className="label-mono">{t.seasonTotals}</Reveal>
            <Reveal className="total">
              <span className="k">{t.roundsSettled}</span>
              <span className="v"><CountUp value={seasonRounds.length} /></span>
            </Reveal>
            <Reveal className="total">
              <span className="k">{dict.common.correct}</span>
              <span className="v">
                <CountUp value={totals.hits} /><span className="of">/{totals.scored}</span>{" "}
                {totals.hitRate !== null && <span className="pct">{Math.round(totals.hitRate * 100)}%</span>}
              </span>
            </Reveal>
            <Reveal className="total">
              <span className="k">{dict.common.meanRps}</span>
              <span className="v">
                {totals.meanRps !== null ? <CountUp value={totals.meanRps} decimals={4} comma={fi} /> : dict.common.dash}
              </span>
            </Reveal>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <Ambient variant="home" />
      {openHero}
      {betweenHero}

      {open && (
        <section className="wide home-coupon">
          <Reveal className="home-coupon-head">
            <div>
              <div className="label-mono">{dict.home.thisWeeksCoupon} · {open.id}</div>
              <h2 className="h2-sealed">{open.round.name}</h2>
            </div>
            <p className="system">
              {open.round.system
                ? dict.home.system(open.round.system.type, open.round.system.singles, open.round.system.doubles, open.round.system.rows)
                : dict.home.singleRow}
              {openOutlook ? dict.home.expectedOf13(fmtDec(openOutlook.expectedCovered, 1, locale)) : ""}
            </p>
          </Reveal>
          <Reveal>
            <CouponList located={open.located} teams={teams} locale={locale} glow />
          </Reveal>
          <Reveal style={{ marginTop: 20, fontSize: 15 }}>
            <Link href={`${prefix}/rounds/${open.id}`}>{dict.common.fullCouponArrow}</Link>
          </Reveal>
        </section>
      )}

      {open && last && (
        <section className="wide home-last">
          <Reveal className="label-mono">{dict.home.lastRound} · {last.id}</Reveal>
          <Reveal as="h2" className="big">{last.round.name}</Reveal>
          <div className="last-grid">
            <Reveal className="strip-card">
              <div className="strips">
                {last.located.map(({ match: m }) => (
                  <div key={m.id} data-row="">
                    <Coupon size="sm" marks={m.forecast?.marks} result={resultSign(m)} locale={locale} />
                  </div>
                ))}
              </div>
              <p className="strip-note">{t.stripNote}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <StatCard
                label={dict.common.correct}
                figure={<><CountUp value={lastS.hits} /><span className="of">/{lastS.scored}</span></>}
                sub={lastS.hitRate !== null ? `${Math.round(lastS.hitRate * 100)}%` : undefined}
              />
            </Reveal>
            <Reveal delay={0.16}>
              <StatCard
                label={dict.common.meanRps}
                figure={lastS.meanRps !== null ? <CountUp value={lastS.meanRps} decimals={4} comma={fi} /> : dict.common.dash}
              />
            </Reveal>
          </div>
          <Reveal className="links-row" style={{ marginTop: 28, fontSize: 16 }}>
            <Link href={`${prefix}/rounds/${last.id}`}>{dict.common.reviewArrow}</Link>
            <Link href={`${prefix}/rounds`}>{dict.common.allRoundsArrow}</Link>
          </Reveal>
        </section>
      )}

      {seasonSection}

      {!open && !last && (
        <section className="wide" style={{ paddingTop: 64 }}>
          <div className="empty">{dict.home.noRoundsYet}</div>
        </section>
      )}

      <section className="wide home-leagues">
        <Reveal className="label-mono">{dict.home.byLeague}</Reveal>
        <div className="league-grid">
          {cards.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.08}>
              <Link className="league-card" href={`${prefix}/${season.id}/${c.id}`}>
                <span className="name">{c.label}</span>
                <span className="meta">
                  {c.has ? (
                    <span className="data">{dict.home.mwProgress(c.mwNo ?? 0, c.played, c.total)}</span>
                  ) : (
                    <Tag variant="pending">{dict.home.noData}</Tag>
                  )}
                  <span className="arrow" aria-hidden="true">→</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
