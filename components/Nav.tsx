"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getDictionary } from "@/lib/i18n";

/**
 * Floating glass header: the wordmark plus the three league quick-links,
 * nothing else (TECH-SHEET.md §9/§10). Every other destination — Latest,
 * Rounds, Calibration, Method — lives in the footer. No hamburger: if the
 * links ever overflow they scroll horizontally, same idiom as the matchweek
 * rail.
 *
 * Short hrefs rely on the redirects in next.config.mjs, so the canonical URL
 * still carries the season. The active check therefore matches the league id
 * as a path segment — after the redirect the browser is on
 * `/2026-27/premier-league`, not `/premier-league`.
 *
 * Locale (I18N-PLAN.md): Finnish lives under `/fi/...`, English at the root.
 * There's no `[locale]` route param, so this client component derives locale
 * straight from the pathname (`isFi`) rather than a prop, and is also where
 * `<html lang>` gets corrected after hydration — the one disclosed shortcut
 * of the Phase 1 build: the root layout is shared by both trees and can't
 * itself know which one it's rendering without middleware, which would force
 * every page into dynamic rendering (see I18N-PLAN.md §1). Search engines get
 * the correct signal from `alternates.languages` regardless.
 */
const LEAGUES = ["premier-league", "championship", "league-one"] as const;

export function Nav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isFi = segments[0] === "fi";
  const dict = getDictionary(isFi ? "fi" : "en");

  useEffect(() => {
    document.documentElement.lang = isFi ? "fi" : "en";
  }, [isFi]);

  const rest = isFi ? segments.slice(1) : segments;
  const switchHref = isFi ? `/${rest.join("/")}` : `/fi${pathname === "/" ? "" : pathname}`;

  return (
    <header className="topbar">
      <Link className="wordmark" href={isFi ? "/fi" : "/"}>
        <span className="glyph">S</span>Strictlane
      </Link>
      <nav className="league-switch" aria-label={dict.nav.leagueGroup}>
        {LEAGUES.map((slug) => {
          const l = { slug, ...dict.leagues[slug] };
          const active = segments.includes(l.slug);
          const href = isFi ? `/fi/${l.slug}` : `/${l.slug}`;
          return (
            <Link
              key={l.slug}
              className={active ? "is-active" : undefined}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={l.label}
            >
              <span className="lg-full">{l.label}</span>
              <span className="lg-short" aria-hidden="true">{l.short}</span>
            </Link>
          );
        })}
      </nav>
      <Link className="lang-switch" href={switchHref}>
        {dict.nav.switchTo}
      </Link>
    </header>
  );
}
