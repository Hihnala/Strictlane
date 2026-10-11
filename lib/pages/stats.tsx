import type { Metadata } from "next";
import { LEAGUES, currentSeason, getPage, getSeasonMatches } from "@/lib/content";
import { computeLeagueStats } from "@/lib/leagueStats";
import { Prose } from "@/components/Prose";
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
    <div className="wrap">
      <section className="section">
        <div className="sec-label">{t.seasonToDate(season.label)}</div>
        <h1>{t.title}</h1>
        <p className="lede">{t.lede}</p>
      </section>

      {blocks.length ? (
        <section className="section prose">
          {blocks.map(({ league, stats: s }) => (
            <div key={league.id}>
              <h3>{t.leagueHeading[league.id]}</h3>
              <ul>
                <li>
                  {t.homeWins}: <strong>{t.pct(s.homeWinPct)}</strong>
                </li>
                <li>
                  {t.draws}: <strong>{t.pct(s.drawPct)}</strong>, {t.nilNilDraws}: <strong>{t.pct(s.nilNilPct)}</strong>
                </li>
                <li>
                  {t.goalsPerGame}: <strong>{t.num(s.goalsPerGame)}</strong>
                  {s.firstHalf !== null && s.secondHalf !== null && (
                    <>
                      {" "}
                      ({t.firstHalf}: <strong>{t.num(s.firstHalf)}</strong>, {t.secondHalf}:{" "}
                      <strong>{t.num(s.secondHalf)}</strong>
                      {s.halfTimeBasis < s.played && <>; {t.halfTimeBasis(s.halfTimeBasis, s.played)}</>})
                    </>
                  )}
                </li>
                <li>
                  {t.over25}: <strong>{t.pct(s.over25Pct)}</strong>
                </li>
                <li>
                  {t.btts}: <strong>{t.pct(s.bttsPct)}</strong>
                </li>
              </ul>
            </div>
          ))}
        </section>
      ) : (
        <div className="empty">{t.noStatsYet}</div>
      )}

      {page && page.html.trim() && (
        <section className="section prose">
          {!page.translated && (
            <p className="muted" style={{ fontSize: 13, marginBottom: "var(--s3)" }}>
              {dict.matchweekPage.translationPending}
            </p>
          )}
          <Prose html={page.html} />
        </section>
      )}
    </div>
  );
}
