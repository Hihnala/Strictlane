import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";

export function MatchweekRail({
  season,
  league,
  weeks,
  current,
  locale = "en",
}: {
  season: string;
  league: string;
  weeks: number[];
  current: number;
  locale?: Locale;
}) {
  if (weeks.length <= 1) return null;
  const dict = getDictionary(locale);
  const prefix = localePrefix(locale);
  return (
    <div className="rail" role="navigation" aria-label={dict.common.matchweeksAria}>
      {weeks.map((w) => (
        <Link
          key={w}
          className={`rail-item${w === current ? " on" : ""}`}
          href={`${prefix}/${season}/${league}/mw-${String(w).padStart(2, "0")}`}
          aria-current={w === current ? "page" : undefined}
        >
          {w}
        </Link>
      ))}
    </div>
  );
}
