import Link from "next/link";

/**
 * Three rows (TECH-SHEET.md §4):
 *   1. the section links the top bar no longer carries
 *   2. the site's own description — a personal ledger, forecasts scored
 *      against the market, hits and misses both on the record
 *   3. build credit + copyright
 *
 * No betting-advice disclaimer and no gambling-helpline link: Peluuri is run
 * by the state betting company and Markku isn't affiliated with it
 * (TECH-SHEET.md §14). Plain Server Component — no client JS.
 */
const LINKS = [
  { href: "/", label: "Latest" },
  { href: "/rounds", label: "Rounds" },
  { href: "/calibration", label: "Calibration" },
  { href: "/method", label: "Method" },
];

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <nav className="footer-nav" aria-label="Footer">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="footer-statement">
          Strictlane is a personal ledger &mdash; football forecasts made before kickoff for the
          Premier League, Championship, and League One, scored against the closing betting market.
          Hits and misses both stay on the record.
        </p>
        <div className="footer-credit">
          Built by Markku Hihnala &middot; &copy; 2026 Strictlane/Markku Hihnala. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
