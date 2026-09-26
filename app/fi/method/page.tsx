import type { Metadata } from "next";
import { renderMethodPage, renderMethodMetadata } from "@/lib/pages/method";

export const metadata: Metadata = renderMethodMetadata("fi");

export default function MethodPageFi() {
  return renderMethodPage("fi");
}
