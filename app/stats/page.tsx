import type { Metadata } from "next";
import { currentSeason, getPage } from "@/lib/content";
import { Prose } from "@/components/Prose";

export const metadata: Metadata = { title: "Statistics" };

export default async function StatsPage() {
  const season = await currentSeason();
  const page = await getPage("statistics");

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">Season to date &middot; {season.label}</div>
        <h1>Statistics</h1>
        <p className="lede">
          League-wide scoring patterns across the Premier League, Championship, and League One
          &mdash; not tied to any single coupon, and updated as the season goes on.
        </p>
      </section>

      {page ? (
        <section className="section prose">
          <Prose html={page.html} />
        </section>
      ) : (
        <div className="empty">No statistics logged yet.</div>
      )}
    </div>
  );
}
