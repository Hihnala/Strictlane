import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";

/** Segmented pill of matchweeks; scrolls horizontally when it doesn't fit. */
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
    <nav className="mw-rail" aria-label={dict.common.matchweeksAria}>
      {weeks.map((w) => (
        <Link
          key={w}
          className={w === current ? "on" : undefined}
          href={`${prefix}/${season}/${league}/mw-${String(w).padStart(2, "0")}`}
          aria-current={w === current ? "page" : undefined}
        >
          {w}
        </Link>
      ))}
    </nav>
  );
}
