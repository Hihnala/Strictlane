import type { LeagueId, Team } from "@/lib/schema";
import { zoneFor, zonesOf, type StandingRow } from "@/lib/standings";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";

/**
 * League table as grid rows; scrolls horizontally on phones. Promotion,
 * relegation and European places get a thin coloured bar at the row's left
 * edge, a screen-reader label, and a key under the table.
 */
export function StandingsTable({
  rows,
  teams,
  league,
  locale = "en",
}: {
  rows: StandingRow[];
  teams: Map<string, Team>;
  league: LeagueId;
  locale?: Locale;
}) {
  const dict = getDictionary(locale).standings;
  return (
    <div className="card standings" role="table">
      <div className="st-row gt-head" role="row">
        <span role="columnheader">#</span>
        <span role="columnheader">{dict.team}</span>
        <span role="columnheader">{dict.p}</span>
        <span role="columnheader">{dict.w}</span>
        <span role="columnheader">{dict.d}</span>
        <span role="columnheader">{dict.l}</span>
        <span role="columnheader">{dict.gd}</span>
        <span role="columnheader">{dict.pts}</span>
      </div>
      {rows.map((r, i) => {
        const zone = zoneFor(league, i + 1);
        return (
          <div key={r.team} className="st-row" role="row" data-row="" data-zone={zone ?? undefined}>
            <span className="pos" role="cell">{i + 1}</span>
            <span className="team" role="cell">
              {teams.get(r.team)?.name ?? r.team}
              {zone && <span className="sr-only">, {dict.zones[zone]}</span>}
            </span>
            <span role="cell">{r.played}</span>
            <span role="cell">{r.won}</span>
            <span role="cell">{r.drawn}</span>
            <span role="cell">{r.lost}</span>
            <span role="cell">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
            <span className="pts" role="cell">{r.points}</span>
          </div>
        );
      })}
      <ul className="st-key" aria-label={dict.zoneKey}>
        {zonesOf(league).map((z) => (
          <li key={z} data-zone={z}>{dict.zones[z]}</li>
        ))}
      </ul>
    </div>
  );
}
