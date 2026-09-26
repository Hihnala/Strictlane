import type { Metadata } from "next";
import { currentSeason, getPage } from "@/lib/content";
import { Prose } from "@/components/Prose";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";

export function renderStatsMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return baseMetadata(locale, "/stats", dict.stats.metaTitle);
}

export async function renderStatsPage(locale: Locale) {
  const dict = getDictionary(locale);
  const season = await currentSeason();
  const page = await getPage("statistics", locale);

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">{dict.stats.seasonToDate(season.label)}</div>
        <h1>{dict.stats.title}</h1>
        <p className="lede">{dict.stats.lede}</p>
      </section>

      {page ? (
        <section className="section prose">
          {!page.translated && (
            <p className="muted" style={{ fontSize: 13, marginBottom: "var(--s3)" }}>
              {dict.matchweekPage.translationPending}
            </p>
          )}
          <Prose html={page.html} />
        </section>
      ) : (
        <div className="empty">{dict.stats.noStatsYet}</div>
      )}
    </div>
  );
}
