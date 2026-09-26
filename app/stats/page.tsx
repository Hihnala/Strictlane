import type { Metadata } from "next";
import { renderStatsPage, renderStatsMetadata } from "@/lib/pages/stats";

export const metadata: Metadata = renderStatsMetadata("en");

export default async function StatsPage() {
  return renderStatsPage("en");
}
