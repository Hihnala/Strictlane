import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { listRounds, getRound, getRoundMatches, getTeams, getRoundCommentary, roundNeighbours } from "@/lib/content";
import { summarise, coverage, couponOutlook, drawWatch } from "@/lib/scoring";
import { CouponRows } from "@/components/MatchRow";
import { StatCell } from "@/components/StatCell";
import { Prose } from "@/components/Prose";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata, localePrefix } from "@/lib/i18n";

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

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">{dict.roundPage.label(id)}</div>
        <h1>{round.name}</h1>
        {round.system && (
          <p className="lede">
            {dict.roundPage.system(round.system.type, round.system.singles, round.system.doubles, round.system.triples ?? 0, round.system.rows)}
          </p>
        )}

        {/* The coupon in coupon order — the order is data, not presentation. */}
        <div style={{ marginTop: "var(--s4)" }}>
          <CouponRows located={located} teams={teams} locale={locale} />
        </div>
      </section>

      <section className="section">
        <div className="sec-label">{dict.matchweekPage.scoring}</div>
        <div className="stat-grid">
          <StatCell value={`${s.hits}/${s.scored}`} label={dict.common.correct}
            sub={outlook ? dict.roundPage.expectedSub(outlook.expectedCovered.toFixed(2)) : undefined} />
          <StatCell value={s.meanRps ? s.meanRps.toFixed(4) : dict.common.dash} label={dict.common.meanRps} />
          <StatCell value={`${draws.actual}/${draws.expected.toFixed(1)}`} label={dict.common.drawsActExp}
            sub={draws.z !== null ? `${dict.common.z} ${draws.z.toFixed(2)}` : undefined} />
        </div>

        {outlook && (
          <table className="table" style={{ marginTop: "var(--s4)" }}>
            <thead>
              <tr><th>{dict.roundPage.outcome}</th><th className="num">{dict.roundPage.probability}</th><th className="num">{dict.roundPage.odds}</th></tr>
            </thead>
            <tbody>
              {[matches.length, matches.length - 1, matches.length - 2, matches.length - 3]
                .filter((k) => k > 0)
                .map((k) => {
                  const p = k === matches.length ? outlook.pAll : outlook.distribution[k];
                  return (
                    <tr key={k}>
                      <td>{k === matches.length ? dict.roundPage.allCovered(k) : dict.roundPage.exactly(k)}</td>
                      <td className="num data">{(p * 100).toFixed(2)}%</td>
                      <td className="num data">{p > 0 ? dict.roundPage.oneIn(Math.round(1 / p)) : dict.common.dash}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </section>

      {commentary && (
        <section className="section">
          <div className="sec-label">{dict.roundPage.review}</div>
          {!commentary.translated && (
            <p className="muted" style={{ fontSize: 13, marginBottom: "var(--s3)" }}>
              {dict.roundPage.translationPending}
            </p>
          )}
          <Prose html={commentary.html} />
        </section>
      )}

      {/* Walk the archive without going back to the index each time. */}
      <nav className="roundnav" aria-label={dict.roundPage.otherRoundsAria}>
        {older ? <Link href={`${prefix}/rounds/${older}`}>&larr; {older}</Link> : <span />}
        <span className="spacer" />
        <Link href={`${prefix}/rounds`} style={{ border: "none" }}>{dict.roundPage.allRounds}</Link>
        <span className="spacer" />
        {newer ? <Link href={`${prefix}/rounds/${newer}`}>{newer} &rarr;</Link> : <span />}
      </nav>
    </div>
  );
}
