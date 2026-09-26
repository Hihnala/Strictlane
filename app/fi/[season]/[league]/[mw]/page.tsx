import type { Metadata } from "next";
import {
  matchweekStaticParams,
  renderMatchweekMetadata,
  renderMatchweekPage,
} from "@/lib/pages/matchweek";

export const generateStaticParams = matchweekStaticParams;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ season: string; league: string; mw: string }>;
}): Promise<Metadata> {
  const { season, league, mw } = await params;
  return renderMatchweekMetadata("fi", season, league, mw);
}

export default async function MatchweekPageFi({
  params,
}: {
  params: Promise<{ season: string; league: string; mw: string }>;
}) {
  const { season, league, mw } = await params;
  return renderMatchweekPage("fi", season, league, mw);
}
