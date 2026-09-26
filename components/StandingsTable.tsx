import type { Team } from "@/lib/schema";
import type { StandingRow } from "@/lib/standings";

export function StandingsTable({
  rows,
  teams,
}: {
  rows: StandingRow[];
  teams: Map<string, Team>;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Team</th>
            <th className="num">P</th>
            <th className="num">W</th>
            <th className="num">D</th>
            <th className="num">L</th>
            <th className="num">GD</th>
            <th className="num">Pts</th>
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
