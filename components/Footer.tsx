"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary } from "@/lib/i18n";

/**
 * Three rows (TECH-SHEET.md §4):
 *   1. the section links the top bar no longer carries
 *   2. the site's own description — a personal ledger, forecasts tracked
 *      over time, hits and misses both on the record
 *   3. build credit + copyright
 *
 * No betting-advice disclaimer and no gambling-helpline link: Peluuri is run
 * by the state betting company and Markku isn't affiliated with it
 * (TECH-SHEET.md §14).
 *
 * Locale: same reasoning as Nav.tsx — no `[locale]` route param, so this
 * derives the locale from the pathname. That's why it's a client component
 * rather than the plain Server Component it used to be; the footer text is
 * static per request either way, so the cost is a few bytes of client JS,
 * not a rendering-model change.
 */
export function Footer() {
  const pathname = usePathname();
  const isFi = pathname.split("/").filter(Boolean)[0] === "fi";
  const dict = getDictionary(isFi ? "fi" : "en");
  const prefix = isFi ? "/fi" : "";

  const links = [
    { href: `${prefix}/`, label: dict.footer.links.latest },
    { href: `${prefix}/stats`, label: dict.footer.links.stats },
    { href: `${prefix}/rounds`, label: dict.footer.links.rounds },
    { href: `${prefix}/calibration`, label: dict.footer.links.calibration },
    { href: `${prefix}/method`, label: dict.footer.links.method },
  ];

  return (
    <footer className="foot">
      <div className="wrap">
        <nav className="footer-nav" aria-label="Footer">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="footer-statement">{dict.footer.statement}</p>
        <div className="footer-credit">{dict.footer.credit}</div>
      </div>
    </footer>
  );
}
