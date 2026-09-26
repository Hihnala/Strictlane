import type { Metadata } from "next";
import { roundStaticParams, renderRoundMetadata, renderRoundPage } from "@/lib/pages/round";

export const generateStaticParams = roundStaticParams;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return renderRoundMetadata("fi", id);
}

export default async function RoundPageFi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderRoundPage("fi", id);
}
