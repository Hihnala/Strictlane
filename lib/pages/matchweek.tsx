import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  LEAGUES, getSeasons, getTeams, getMatchweek, listMatchweeks,
  getCommentary, leagueMeta, latestPlayedMatchweek,
} from "@/lib/content";
import type { LeagueId } from "@/lib/schema";
import { summarise, drawWatch } from "@/lib/scoring";
import { computeStandings } from "@/lib/standings";
import { MatchList } from "@/components/MatchRow";
import { MatchweekRail } from "@/components/MatchweekRail";
import { SeasonGrid, type GridCell } from "@/components/SeasonGrid";
import { StandingsTable } from "@/components/StandingsTable";
import { StatCell } from "@/components/StatCell";
import { Prose } from "@/components/Prose";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";

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
  const title = `${leagueMeta(league as LeagueId).label} MW${n} · ${season}`;
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
  const meta = leagueMeta(lid);

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">
          {meta.label} &middot; {season}
        </div>
        <h1>{dict.common.matchweekHeading(n)}</h1>
        <MatchweekRail season={season} league={league} weeks={weeks} current={n} locale={locale} />

        <p className="muted data" style={{ fontSize: 13 }}>
          {dict.common.playedOf(played, data.matches.length)}
          {n === latestPlayed ? dict.common.latestSuffix : ""}
        </p>

        <MatchList matches={data.matches} teams={teams} locale={locale} />
      </section>

      {s.scored > 0 && (
        <section className="section">
          <div className="sec-label">{dict.matchweekPage.scoring}</div>
          <div className="stat-grid">
            <StatCell value={`${s.hits}/${s.scored}`} label={dict.common.correct} />
            <StatCell value={s.meanRps ? s.meanRps.toFixed(4) : dict.common.dash} label={dict.common.meanRps} />
            <StatCell
              value={`${draws.actual}/${draws.expected.toFixed(1)}`}
              label={dict.common.drawsActExp}
              sub={draws.z !== null ? `${dict.common.z} ${draws.z.toFixed(2)}` : undefined}
            />
          </div>
        </section>
      )}

      {commentary && (
        <section className="section">
          <div className="sec-label">{dict.matchweekPage.notes}</div>
          {!commentary.translated && (
            <p className="muted" style={{ fontSize: 13, marginBottom: "var(--s3)" }}>
              {dict.matchweekPage.translationPending}
            </p>
          )}
          <Prose html={commentary.html} />
        </section>
      )}

      <section className="section">
        <div className="sec-label">{dict.matchweekPage.season}</div>
        <SeasonGrid season={season} league={league} cells={cells} current={n} locale={locale} />
      </section>

      {standings.length > 0 && (
        <section className="section">
          <div className="sec-label">{dict.matchweekPage.tableThrough(n)}</div>
          <StandingsTable rows={standings} teams={teams} locale={locale} />
        </section>
      )}
    </div>
  );
}
