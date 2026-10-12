import type { Metadata } from "next";
import { LEAGUES, currentSeason, getPage, getSeasonMatches } from "@/lib/content";
import { computeLeagueStats } from "@/lib/leagueStats";
import { Prose } from "@/components/Prose";
import { Ambient } from "@/components/Ambient";
import { Rise } from "@/components/motion/Rise";
import { Reveal } from "@/components/motion/Reveal";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";

export function renderStatsMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return baseMetadata(locale, "/stats", dict.stats.metaTitle);
}

export async function renderStatsPage(locale: Locale) {
  const dict = getDictionary(locale);
  const t = dict.stats;
  const season = await currentSeason();
  // Optional commentary; the figures themselves are computed below, never typed in.
  const page = await getPage("statistics", locale);

  const blocks = [];
  for (const league of LEAGUES) {
    const stats = computeLeagueStats(await getSeasonMatches(season.id, league.id));
    if (stats) blocks.push({ league, stats });
  }

  return (
    <>
      <Ambient variant="right" />
      <section className="wide page-head">
        <Rise i={0} className="label-mono">{t.seasonToDate(season.label)}</Rise>
        <Rise i={1} as="h1" className="h1-sealed">{t.title}</Rise>
        <Rise i={2} as="p" className="page-lede">{t.lede}</Rise>
      </section>

      <section className="wide league-stats">
        {blocks.length === 0 && <div className="empty">{t.noStatsYet}</div>}
        {blocks.map(({ league, stats: s }) => {
          const halves = s.firstHalf !== null && s.secondHalf !== null && s.firstHalf + s.secondHalf > 0;
          return (
            <Reveal key={league.id} className="card ls-card">
              <h2>{t.leagueHeading[league.id]}</h2>
              <div className="ls-figs">
                <div className="ls-fig">
                  <div className="v">{t.pct(s.homeWinPct)}</div>
                  <div className="k">{t.homeWins}</div>
                </div>
                <div className="ls-fig">
                  <div className="v">{t.pct(s.drawPct)}</div>
                  <div className="k">{t.draws} <span className="data">· {t.nilNilDraws} {t.pct(s.nilNilPct)}</span></div>
                </div>
                <div className="ls-fig">
                  <div className="v">{t.num(s.goalsPerGame)}</div>
                  <div className="k">{t.goalsPerGame}</div>
                  {halves && (
                    <>
                      <div className="half-bar">
                        <span data-grow="" style={{ width: `${(s.firstHalf! / (s.firstHalf! + s.secondHalf!)) * 100}%`, background: "var(--ink-muted)" }} />
                        <span data-grow="" style={{ width: `${(s.secondHalf! / (s.firstHalf! + s.secondHalf!)) * 100}%`, background: "var(--ink)" }} />
                      </div>
                      <div className="half-legend">
                        <span>{t.firstHalf} {t.num(s.firstHalf!)}</span>
                        <span>{t.secondHalf} {t.num(s.secondHalf!)}</span>
                      </div>
                      {s.halfTimeBasis < s.played && <div className="half-basis">{t.halfTimeBasis(s.halfTimeBasis, s.played)}</div>}
                    </>
                  )}
                </div>
              </div>
              <div className="ls-bars">
                {[{ k: t.over25, v: s.over25Pct }, { k: t.btts, v: s.bttsPct }].map((b) => (
                  <div key={b.k} className="ls-bar" data-row="">
                    <span className="k">{b.k}</span>
                    <div className="bar-track"><div className="bar-fill" data-grow="" style={{ width: `${b.v}%` }} /></div>
                    <span className="v">{t.pct(b.v)}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          );
        })}
      </section>

      {page && page.html.trim() && (
        <section className="prose-col">
          {!page.translated && <p className="translation-note">{dict.matchweekPage.translationPending}</p>}
          <Reveal>
            <Prose html={page.html} className="sealed-prose" />
          </Reveal>
        </section>
      )}
    </>
  );
}
