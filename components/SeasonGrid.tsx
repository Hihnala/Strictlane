import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";

export interface GridCell {
  matchweek: number;
  state: "forecast" | "logged" | "upcoming";
}

export function SeasonGrid({
  season,
  league,
  cells,
  current,
  locale = "en",
}: {
  season: string;
  league: string;
  cells: GridCell[];
  current: number;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const prefix = localePrefix(locale);
  return (
    <div className="seasongrid">
      {cells.map((c) => (
        <Link
          key={c.matchweek}
          className={`gridcell ${c.state}${c.matchweek === current ? " on" : ""}`}
          href={`${prefix}/${season}/${league}/mw-${String(c.matchweek).padStart(2, "0")}`}
          title={dict.common.matchweekTitle(c.matchweek)}
        >
          {c.matchweek}
        </Link>
      ))}
    </div>
  );
}
