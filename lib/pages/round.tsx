import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { listRounds, getRound, getRoundMatches, getTeams, getRoundCommentary, roundNeighbours } from "@/lib/content";
import { summarise, coverage, couponOutlook, drawWatch } from "@/lib/scoring";
import { CouponList } from "@/components/CouponList";
import { StatCard } from "@/components/StatCard";
import { Prose } from "@/components/Prose";
import { Ambient } from "@/components/Ambient";
import { Rise } from "@/components/motion/Rise";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata, localePrefix } from "@/lib/i18n";
import { fmtDec } from "@/lib/format";

export async function roundStaticParams() {
  return (await listRounds()).map((id) => ({ id }));
}

export async function renderRoundMetadata(locale: Locale, id: string): Promise<Metadata> {
  const r = await getRound(id);
  return baseMetadata(locale, `/rounds/${id}`, r?.name ?? id);
}

export async function renderRoundPage(locale: Locale, id: string) {
  const dict = getDictionary(locale);
  const prefix = localePrefix(locale);
  const fi = locale === "fi";
  const round = await getRound(id);
  if (!round) notFound();

  const located = await getRoundMatches(id);
  const matches = located.map((l) => l.match);
  const teams = await getTeams();
  const commentary = await getRoundCommentary(id, locale);
  const { newer, older } = await roundNeighbours(id);
  const s = summarise(matches);
  const draws = drawWatch(matches);

  const cov = matches.filter((m) => m.forecast).map((m) => coverage(m.forecast!.probs, m.forecast!.marks));
  const outlook = cov.length ? couponOutlook(cov) : null;

  const outlookRows = outlook
    ? [matches.length, matches.length - 1, matches.length - 2, matches.length - 3]
        .filter((k) => k > 0)
        .map((k) => ({ k, p: k === matches.length ? outlook.pAll : outlook.distribution[k] }))
    : [];
  const maxP = Math.max(...outlookRows.map((o) => o.p), 0);

  return (
    <>
      <Ambient variant="left" />
      <section className="wide page-head round-head">
        <Rise i={0} className="label-mono">{dict.roundPage.label(id)}</Rise>
        <div className="head-row">
          <Rise i={1} as="h1" className="h1-sealed">{round.name}</Rise>
          {round.system && (
            <Rise i={2} as="p" className="head-system">
              {dict.roundPage.system(round.system.type, round.system.singles, round.system.doubles, round.system.triples ?? 0, round.system.rows)}
            </Rise>
          )}
        </div>
        {/* The coupon in coupon order — the order is data, not presentation. */}
        <Rise i={3}>
          <CouponList located={located} teams={teams} locale={locale} />
        </Rise>
      </section>

      <section className="wide sec">
        <Reveal className="label-mono">{dict.matchweekPage.scoring}</Reveal>
        <div className="stat-row">
          <Reveal delay={0}>
            <StatCard
              label={dict.common.correct}
              figure={<><CountUp value={s.hits} /><span className="of">/{s.scored}</span></>}
              sub={outlook ? dict.roundPage.expectedSub(fmtDec(outlook.expectedCovered, 2, locale)) : undefined}
            />
          </Reveal>
          <Reveal delay={0.08}>
            <StatCard
              label={dict.common.meanRps}
              figure={s.meanRps !== null ? <CountUp value={s.meanRps} decimals={4} comma={fi} /> : dict.common.dash}
            />
          </Reveal>
          <Reveal delay={0.16}>
            <StatCard
              label={dict.common.drawsActExp}
              figure={<>{draws.actual}<span className="of">/{fmtDec(draws.expected, 1, locale)}</span></>}
              sub={draws.z !== null ? `${dict.common.z} ${fmtDec(draws.z, 2, locale)}` : undefined}
            />
          </Reveal>
        </div>

        {outlook && (
          <Reveal className="card outlook">
            <div className="outlook-row gt-head">
              <span>{dict.roundPage.outcome}</span>
              <span />
              <span className="r">{dict.roundPage.probability}</span>
              <span className="r">{dict.roundPage.odds}</span>
            </div>
            {outlookRows.map(({ k, p }) => (
              <div key={k} className="outlook-row" data-row="">
                <span className="lbl">{k === matches.length ? dict.roundPage.allCovered(k) : dict.roundPage.exactly(k)}</span>
                <div className="bar-track">
                  <div className="bar-fill" data-grow="" style={{ width: `${maxP ? (p / maxP) * 100 : 0}%` }} />
                </div>
                <span className="num">{fmtDec(p * 100, 2, locale)}%</span>
                <span className="num dim">{p > 0 ? dict.roundPage.oneIn(Math.round(1 / p)) : dict.common.dash}</span>
              </div>
            ))}
          </Reveal>
        )}
      </section>

      {commentary && (
        <section className="prose-col">
          <Reveal className="label-mono">{dict.roundPage.review}</Reveal>
          {!commentary.translated && <p className="translation-note">{dict.roundPage.translationPending}</p>}
          <Reveal>
            <Prose html={commentary.html} className="sealed-prose review" />
          </Reveal>
        </section>
      )}

      {/* Walk the archive without going back to the index each time. */}
      <nav className="round-nav" aria-label={dict.roundPage.otherRoundsAria}>
        {older ? (
          <Link className="nb older" href={`${prefix}/rounds/${older}`}>
            <span className="arr">←</span><span className="id">{older}</span>
          </Link>
        ) : <span />}
        <Link className="all" href={`${prefix}/rounds`}>{dict.roundPage.allRounds}</Link>
        {newer ? (
          <Link className="nb newer" href={`${prefix}/rounds/${newer}`}>
            <span className="arr">→</span><span className="id">{newer}</span>
          </Link>
        ) : <span />}
      </nav>
    </>
  );
}
