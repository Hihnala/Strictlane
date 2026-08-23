import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Five fixed items for the life of the site (TECH-SHEET.md §10) — growth
 * lives in the matchweek rail and season grid, never here. Short hrefs rely
 * on the redirects in next.config.mjs so canonical URLs can still carry the
 * season without lengthening the nav.
 */
const ITEMS = [
  { href: "/", label: "Latest" },
  { href: "/premier-league", label: "Premier League" },
  { href: "/championship", label: "Championship" },
  { href: "/league-one", label: "League One" },
  { href: "/calibration", label: "Calibration" },
];

export function Nav() {
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <Link className="wordmark" href="/">
            <span className="glyph">S</span>Strictlane
          </Link>
          <ThemeToggle />
        </div>
      </div>
      <nav className="leaguenav" aria-label="Primary">
        {ITEMS.map((item) => (
          <Link key={item.href} className="leaguenav-item" href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
