import type { Metadata } from "next";
import { renderCalibrationPage, renderCalibrationMetadata } from "@/lib/pages/calibration";

export const metadata: Metadata = renderCalibrationMetadata("fi");

export default async function CalibrationPageFi() {
  return renderCalibrationPage("fi");
}
