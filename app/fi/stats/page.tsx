import type { Metadata } from "next";
import { renderStatsPage, renderStatsMetadata } from "@/lib/pages/stats";

export const metadata: Metadata = renderStatsMetadata("fi");

export default async function StatsPageFi() {
  return renderStatsPage("fi");
}
