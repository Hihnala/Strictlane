import { redirect, notFound } from "next/navigation";
import { LEAGUES, getSeasons, listMatchweeks, latestPlayedMatchweek } from "@/lib/content";
import type { LeagueId } from "@/lib/schema";

export async function generateStaticParams() {
  const seasons = await getSeasons();
  const out: Array<{ season: string; league: string }> = [];
  for (const s of seasons) {
    for (const l of LEAGUES) out.push({ season: s.id, league: l.id });
  }
  return out;
}

/** No page of its own — redirects to the latest matchweek, or the first if none is played yet. */
export default async function LeagueRedirect({
  params,
}: {
  params: Promise<{ season: string; league: string }>;
}) {
  const { season, league } = await params;
  if (!LEAGUES.some((l) => l.id === league)) notFound();
  const lid = league as LeagueId;

  const latest = await latestPlayedMatchweek(season, lid);
  if (latest) redirect(`/${season}/${league}/mw-${String(latest).padStart(2, "0")}`);

  const weeks = await listMatchweeks(season, lid);
  if (weeks.length) redirect(`/${season}/${league}/mw-${String(weeks[0]).padStart(2, "0")}`);

  notFound();
}
