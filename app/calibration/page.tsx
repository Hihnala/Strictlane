import type { Metadata } from "next";
import { renderCalibrationPage, renderCalibrationMetadata } from "@/lib/pages/calibration";

export const metadata: Metadata = renderCalibrationMetadata("en");

export default async function CalibrationPage() {
  return renderCalibrationPage("en");
}
