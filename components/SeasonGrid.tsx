import Link from "next/link";

export interface GridCell {
  matchweek: number;
  state: "forecast" | "logged" | "upcoming";
}

export function SeasonGrid({
  season,
  league,
  cells,
  current,
}: {
  season: string;
  league: string;
  cells: GridCell[];
  current: number;
}) {
  return (
    <div className="seasongrid">
      {cells.map((c) => (
        <Link
          key={c.matchweek}
          className={`gridcell ${c.state}${c.matchweek === current ? " on" : ""}`}
          href={`/${season}/${league}/mw-${String(c.matchweek).padStart(2, "0")}`}
          title={`Matchweek ${c.matchweek}`}
        >
          {c.matchweek}
        </Link>
      ))}
    </div>
  );
}
