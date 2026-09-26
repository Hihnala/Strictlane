/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pages are statically generated via generateStaticParams (TECH-SHEET.md
  // §2); Vercel serves the result as static output. `output: "export"` is
  // deliberately NOT set — it disables next.config.mjs redirects, which the
  // season-rollover convention below depends on.
  async redirects() {
    // Nav links stay short; canonical URLs always carry the season. Update
    // these six when the season rolls over — three for English, three for
    // the mirrored /fi tree (I18N-PLAN.md §2) — the one annual maintenance
    // task (see TECH-SHEET.md §12).
    return [
      { source: "/premier-league", destination: "/2026-27/premier-league", permanent: false },
      { source: "/championship", destination: "/2026-27/championship", permanent: false },
      { source: "/league-one", destination: "/2026-27/league-one", permanent: false },
      { source: "/fi/premier-league", destination: "/fi/2026-27/premier-league", permanent: false },
      { source: "/fi/championship", destination: "/fi/2026-27/championship", permanent: false },
      { source: "/fi/league-one", destination: "/fi/2026-27/league-one", permanent: false },
    ];
  },
};
export default nextConfig;
