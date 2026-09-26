import type { Team } from "@/lib/schema";
import type { StandingRow } from "@/lib/standings";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";

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
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>{dict.team}</th>
            <th className="num">{dict.p}</th>
            <th className="num">{dict.w}</th>
            <th className="num">{dict.d}</th>
            <th className="num">{dict.l}</th>
            <th className="num">{dict.gd}</th>
            <th className="num">{dict.pts}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team}>
              <td className="num data">{i + 1}</td>
              <td>{teams.get(r.team)?.name ?? r.team}</td>
              <td className="num data">{r.played}</td>
              <td className="num data">{r.won}</td>
              <td className="num data">{r.drawn}</td>
              <td className="num data">{r.lost}</td>
              <td className="num data">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="num data" style={{ fontWeight: 600, color: "var(--ink)" }}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
