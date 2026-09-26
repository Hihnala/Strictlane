import { leagueRedirectStaticParams, renderLeagueRedirect } from "@/lib/pages/leagueRedirect";

export const generateStaticParams = leagueRedirectStaticParams;

export default async function LeagueRedirectFi({
  params,
}: {
  params: Promise<{ season: string; league: string }>;
}) {
  const { season, league } = await params;
  return renderLeagueRedirect("fi", season, league);
}
