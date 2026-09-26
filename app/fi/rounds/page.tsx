import type { Metadata } from "next";
import { renderRoundsIndex, renderRoundsMetadata } from "@/lib/pages/roundsIndex";

export const metadata: Metadata = renderRoundsMetadata("fi");

export default async function RoundsIndexFi() {
  return renderRoundsIndex("fi");
}
