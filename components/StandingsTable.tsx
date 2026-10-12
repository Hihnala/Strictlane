import type { Team } from "@/lib/schema";
import type { StandingRow } from "@/lib/standings";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";

/** League table as grid rows; scrolls horizontally on phones. */
export function StandingsTable({
  rows,
  teams,
  locale = "en",
}: {
  rows: StandingRow[];
  teams: Map<string, Team>;
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
      {rows.map((r, i) => (
        <div key={r.team} className="st-row" role="row" data-row="">
          <span className="pos" role="cell">{i + 1}</span>
          <span className="team" role="cell">{teams.get(r.team)?.name ?? r.team}</span>
          <span role="cell">{r.played}</span>
          <span role="cell">{r.won}</span>
          <span role="cell">{r.drawn}</span>
          <span role="cell">{r.lost}</span>
          <span role="cell">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
          <span className="pts" role="cell">{r.points}</span>
        </div>
      ))}
    </div>
  );
}
