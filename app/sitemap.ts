import type { MetadataRoute } from "next";
import { LEAGUES, getSeasons, listMatchweeks, listRounds } from "@/lib/content";

const BASE = "https://strictlane.com";

/** Every entry is duplicated for the /fi tree (I18N-PLAN.md §2), each pointing
 *  at its counterpart via `alternates.languages` so the two aren't read as
 *  duplicate content. */
function pair(
  pathPart: string,
  opts: { changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }
): MetadataRoute.Sitemap {
  const clean = pathPart === "/" ? "" : pathPart;
  const en = `${BASE}${clean}`;
  const fi = `${BASE}/fi${clean}`;
  const languages = { en, fi };
  return [
    { url: en, ...opts, alternates: { languages } },
    { url: fi, ...opts, alternates: { languages } },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    ...pair("/", { changeFrequency: "daily", priority: 1 }),
    ...pair("/method", { changeFrequency: "monthly", priority: 0.5 }),
    ...pair("/stats", { changeFrequency: "weekly", priority: 0.5 }),
    ...pair("/rounds", { changeFrequency: "weekly", priority: 0.7 }),
    ...pair("/calibration", { changeFrequency: "weekly", priority: 0.7 }),
  ];

  const seasons = await getSeasons();
  for (const season of seasons) {
    for (const league of LEAGUES) {
      const weeks = await listMatchweeks(season.id, league.id);
      for (const w of weeks) {
        entries.push(
          ...pair(`/${season.id}/${league.id}/mw-${String(w).padStart(2, "0")}`, {
            changeFrequency: "weekly",
            priority: season.status === "current" ? 0.8 : 0.3,
          })
        );
      }
    }
  }

  const roundIds = await listRounds();
  for (const id of roundIds) {
    entries.push(...pair(`/rounds/${id}`, { changeFrequency: "weekly", priority: 0.6 }));
  }

  return entries;
}
