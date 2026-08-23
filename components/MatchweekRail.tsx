import Link from "next/link";

export function MatchweekRail({
  season,
  league,
  weeks,
  current,
}: {
  season: string;
  league: string;
  weeks: number[];
  current: number;
}) {
  if (weeks.length <= 1) return null;
  return (
    <div className="rail" role="navigation" aria-label="Matchweeks">
      {weeks.map((w) => (
        <Link
          key={w}
          className={`rail-item${w === current ? " on" : ""}`}
          href={`/${season}/${league}/mw-${String(w).padStart(2, "0")}`}
          aria-current={w === current ? "page" : undefined}
        >
          {w}
        </Link>
      ))}
    </div>
  );
}
