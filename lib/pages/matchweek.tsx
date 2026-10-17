import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  LEAGUES, getSeasons, getTeams, getMatchweek, listMatchweeks,
  getCommentary, latestPlayedMatchweek,
} from "@/lib/content";
import type { LeagueId } from "@/lib/schema";
import { summarise, drawWatch } from "@/lib/scoring";
import { computeStandings } from "@/lib/standings";
import { MatchList } from "@/components/MatchRow";
import { MatchweekRail } from "@/components/MatchweekRail";
import { SeasonGrid, type GridCell } from "@/components/SeasonGrid";
import { StandingsTable } from "@/components/StandingsTable";
import { Prose } from "@/components/Prose";
import { Ambient } from "@/components/Ambient";
import { Rise } from "@/components/motion/Rise";
import { Reveal } from "@/components/motion/Reveal";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";
import { fmtDec } from "@/lib/format";

export async function matchweekStaticParams() {
  const seasons = await getSeasons();
  const out: Array<{ season: string; league: string; mw: string }> = [];
  for (const s of seasons) {
    for (const l of LEAGUES) {
      for (const w of await listMatchweeks(s.id, l.id)) {
        out.push({ season: s.id, league: l.id, mw: `mw-${String(w).padStart(2, "0")}` });
      }
    }
  }
  return out;
}

function parseMw(mw: string) {
  const m = /^mw-(\d{2})$/.exec(mw);
  return m ? Number(m[1]) : null;
}

export async function renderMatchweekMetadata(
  locale: Locale,
  season: string,
  league: string,
  mw: string
): Promise<Metadata> {
  const n = parseMw(mw);
  if (!n || !LEAGUES.some((l) => l.id === league)) return {};
  const title = `${getDictionary(locale).leagues[league as LeagueId].label} MW${n} · ${season}`;
  return baseMetadata(locale, `/${season}/${league}/${mw}`, title);
}

export async function renderMatchweekPage(locale: Locale, season: string, league: string, mw: string) {
  const dict = getDictionary(locale);
  const n = parseMw(mw);
  if (!n || !LEAGUES.some((l) => l.id === league)) notFound();
  const lid = league as LeagueId;

  const data = await getMatchweek(season, lid, n);
  if (!data) notFound();

  const teams = await getTeams();
  const weeks = await listMatchweeks(season, lid);
  const commentary = await getCommentary(season, lid, n, locale);
  const s = summarise(data.matches);
  const draws = drawWatch(data.matches);
  const latestPlayed = (await latestPlayedMatchweek(season, lid)) ?? 0;

  // Season grid state per week, and the table through this matchweek, without
  // re-reading every file twice.
  const cells: GridCell[] = [];
  const throughMatches = [];
  for (const w of weeks) {
    const week = await getMatchweek(season, lid, w);
    const played = week?.matches.some((m) => m.status === "played") ?? false;
    const forecast = week?.matches.some((m) => m.forecast) ?? false;
    cells.push({ matchweek: w, state: forecast ? "forecast" : played ? "logged" : "upcoming" });
    if (week && w <= n) throughMatches.push(...week.matches);
  }
  const standings = computeStandings(throughMatches);

  const played = data.matches.filter((m) => m.status === "played").length;

  const stats = [
    { k: dict.common.correct, v: `${s.hits}/${s.scored}`, s: "" },
    { k: dict.common.meanRps, v: s.meanRps !== null ? fmtDec(s.meanRps, 4, locale) : dict.common.dash, s: "" },
    {
      k: dict.common.drawsActExp,
      v: `${draws.actual}/${fmtDec(draws.expected, 1, locale)}`,
      s: draws.z !== null ? `${dict.common.z} ${fmtDec(draws.z, 2, locale)}` : "",
    },
  ];

  return (
    <>
      <Ambient variant="left" />
      <section className="wide page-head mw-head">
        <Rise i={0} className="label-mono">{dict.leagues[lid].label} · {season}</Rise>
        <div className="head-row">
          <Rise i={1} as="h1" className="h1-sealed">{dict.common.matchweekHeading(n)}</Rise>
          <Rise i={2} style={{ maxWidth: "100%" }}>
            <MatchweekRail season={season} league={league} weeks={weeks} current={n} locale={locale} />
          </Rise>
        </div>
        <Rise i={2} as="p" className="mw-played">
          {dict.common.playedOf(played, data.matches.length)}
          {n === latestPlayed ? dict.common.latestSuffix : ""}
        </Rise>
        <Rise i={3}>
          <MatchList matches={data.matches} teams={teams} locale={locale} />
        </Rise>
      </section>

      <section className="wide sec mw-split">
        {s.scored > 0 && (
          <Reveal>
            <div className="label-mono">{dict.matchweekPage.scoring}</div>
            <div className="mini-stats">
              {stats.map((x) => (
                <div key={x.k} className="mini">
                  <div className="k">{x.k}</div>
                  <div>
                    <div className="v">{x.v}</div>
                    <div className="s">{x.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        )}
        <Reveal>
          <div className="label-mono">{dict.matchweekPage.season}</div>
          <div className="sgrid-card">
            <SeasonGrid season={season} league={league} cells={cells} current={n} locale={locale} />
          </div>
        </Reveal>
      </section>

      {commentary && (
        <section className="prose-col">
          <Reveal className="label-mono">{dict.matchweekPage.notes}</Reveal>
          {!commentary.translated && <p className="translation-note">{dict.matchweekPage.translationPending}</p>}
          <Reveal>
            <Prose html={commentary.html} className="sealed-prose notes" />
          </Reveal>
        </section>
      )}

      {standings.length > 0 && (
        <section className="wide sec-lg">
          <Reveal className="label-mono">{dict.matchweekPage.tableThrough(n)}</Reveal>
          <Reveal>
            <StandingsTable rows={standings} teams={teams} league={lid} locale={locale} />
          </Reveal>
        </section>
      )}
    </>
  );
}
