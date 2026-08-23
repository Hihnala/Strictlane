import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  LEAGUES, getSeasons, getTeams, getMatchweek, listMatchweeks,
  getCommentary, leagueMeta, latestPlayedMatchweek,
} from "@/lib/content";
import type { LeagueId } from "@/lib/schema";
import { summarise, drawWatch } from "@/lib/scoring";
import { MatchList } from "@/components/MatchRow";
import { MatchweekRail } from "@/components/MatchweekRail";
import { SeasonGrid, type GridCell } from "@/components/SeasonGrid";
import { StatCell } from "@/components/StatCell";
import { Prose } from "@/components/Prose";

export async function generateStaticParams() {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; league: string; mw: string }>;
}): Promise<Metadata> {
  const { season, league, mw } = await params;
  const n = parseMw(mw);
  if (!n || !LEAGUES.some((l) => l.id === league)) return {};
  return { title: `${leagueMeta(league as LeagueId).label} MW${n} · ${season}` };
}

export default async function MatchweekPage({
  params,
}: {
  params: Promise<{ season: string; league: string; mw: string }>;
}) {
  const { season, league, mw } = await params;
  const n = parseMw(mw);
  if (!n || !LEAGUES.some((l) => l.id === league)) notFound();
  const lid = league as LeagueId;

  const data = await getMatchweek(season, lid, n);
  if (!data) notFound();

  const teams = await getTeams();
  const weeks = await listMatchweeks(season, lid);
  const commentary = await getCommentary(season, lid, n);
  const s = summarise(data.matches);
  const draws = drawWatch(data.matches);
  const latestPlayed = (await latestPlayedMatchweek(season, lid)) ?? 0;

  // Season grid state per week, without re-reading every file twice.
  const cells: GridCell[] = [];
  for (const w of weeks) {
    const week = await getMatchweek(season, lid, w);
    const played = week?.matches.some((m) => m.status === "played") ?? false;
    const forecast = week?.matches.some((m) => m.forecast) ?? false;
    cells.push({ matchweek: w, state: forecast ? "forecast" : played ? "logged" : "upcoming" });
  }

  const played = data.matches.filter((m) => m.status === "played").length;
  const meta = leagueMeta(lid);

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">
          {meta.label} \u00b7 {season}
          {data.matchweekDerived && " \u00b7 matchweek inferred"}
        </div>
        <h1>Matchweek {n}</h1>
        <MatchweekRail season={season} league={league} weeks={weeks} current={n} />

        <p className="muted data" style={{ fontSize: 13 }}>
          {played}/{data.matches.length} played
          {n === latestPlayed ? " \u00b7 latest" : ""}
        </p>

        <MatchList matches={data.matches} teams={teams} />
      </section>

      {s.scored > 0 && (
        <section className="section">
          <div className="sec-label">Scoring</div>
          <div className="stat-grid">
            <StatCell value={`${s.hits}/${s.scored}`} label="Correct" />
            <StatCell
              value={s.meanRps ? s.meanRps.toFixed(4) : "\u2014"}
              label="Mean RPS"
              sub={s.meanMarketRps ? `market ${s.meanMarketRps.toFixed(4)}` : "no market data"}
            />
            <StatCell
              value={`${draws.actual}/${draws.expected.toFixed(1)}`}
              label="Draws act/exp"
              sub={draws.z !== null ? `z ${draws.z.toFixed(2)}` : undefined}
            />
          </div>
        </section>
      )}

      {commentary && (
        <section className="section">
          <div className="sec-label">Notes</div>
          <Prose html={commentary.html} />
        </section>
      )}

      <section className="section">
        <div className="sec-label">Season</div>
        <SeasonGrid season={season} league={league} cells={cells} current={n} />
      </section>
    </div>
  );
}
