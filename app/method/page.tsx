import type { Metadata } from "next";
import { renderMethodPage, renderMethodMetadata } from "@/lib/pages/method";

export const metadata: Metadata = renderMethodMetadata("en");

export default function MethodPage() {
  return renderMethodPage("en");
}
