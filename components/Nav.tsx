"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top bar: the wordmark plus the three league quick-links, nothing else
 * (TECH-SHEET.md §9/§10). Every other destination — Latest, Rounds,
 * Calibration, Method — lives in the footer. No hamburger: if the tags ever
 * overflow they scroll horizontally, same idiom as the matchweek rail
 * (Rasti rule 11).
 *
 * Short hrefs rely on the redirects in next.config.mjs, so the canonical URL
 * still carries the season. The active check therefore matches the league id
 * as a path segment — after the redirect the browser is on
 * `/2026-27/premier-league`, not `/premier-league`.
 */
const LEAGUES = [
  { slug: "premier-league", label: "Premier League" },
  { slug: "championship", label: "Championship" },
  { slug: "league-one", label: "League One" },
];

export function Nav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <Link className="wordmark" href="/">
          <span className="glyph">S</span>Strictlane
        </Link>
        <div className="nav-scroll">
          <div className="league-switch" role="group" aria-label="League">
            {LEAGUES.map((l) => {
              const active = segments.includes(l.slug);
              return (
                <Link
                  key={l.slug}
                  className={`tag league${active ? " is-active" : ""}`}
                  href={`/${l.slug}`}
                  aria-current={active ? "page" : undefined}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
