import type { Metadata } from "next";
import { renderRoundsIndex, renderRoundsMetadata } from "@/lib/pages/roundsIndex";

export const metadata: Metadata = renderRoundsMetadata("en");

export default async function RoundsIndex() {
  return renderRoundsIndex("en");
}
