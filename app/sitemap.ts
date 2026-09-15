import type { MetadataRoute } from "next";
import { LEAGUES, getSeasons, listMatchweeks, listRounds } from "@/lib/content";

const BASE = "https://strictlane.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/method`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/stats`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/rounds`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/calibration`, changeFrequency: "weekly", priority: 0.7 },
  ];

  const seasons = await getSeasons();
  for (const season of seasons) {
    for (const league of LEAGUES) {
      const weeks = await listMatchweeks(season.id, league.id);
      for (const w of weeks) {
        entries.push({
          url: `${BASE}/${season.id}/${league.id}/mw-${String(w).padStart(2, "0")}`,
          changeFrequency: "weekly",
          priority: season.status === "current" ? 0.8 : 0.3,
        });
      }
    }
  }

  const roundIds = await listRounds();
  for (const id of roundIds) {
    entries.push({
      url: `${BASE}/rounds/${id}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
