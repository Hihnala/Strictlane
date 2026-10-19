"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { animate } from "motion";
import type { Sign } from "@/lib/schema";
import type { Locale } from "@/lib/i18n";
import { Coupon } from "./Coupon";
import { EASE, motionAllowed, whenVisible } from "./motion/entrance";

export type SlipRow = {
  n: number;
  home: string;
  away: string;
  marks?: Sign[] | null;
  result?: Sign | null;
  /** settled rows only */
  score?: string;
  verdict?: "hit" | "miss" | "none";
};

type Props = {
  title: React.ReactNode;
  meta?: React.ReactNode;
  replayLabel: string;
  rows: SlipRow[];
  seal: { variant: "upcoming" | "open" | "settled"; label: string; value: string };
  locale: Locale;
};

const OVERSHOOT = [0.3, 1.5, 0.5, 1] as const;

/**
 * The glass hero slip. Sequence (HANDOFF "Motion"):
 *   1. marked cells stamp in — scale 1.8→1 with overshoot, 120ms per row
 *   2. settled slips: score, ✓/✕ and the true-result underline fade in, 90ms per row
 *   3. the seal strip wipes in left to right
 * Clicking the slip (or Replay) re-runs it. Hit and miss animate identically.
 */
export function CouponCard({ title, meta, replayLabel, rows, seal, locale }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const stops = useRef<Array<() => void>>([]);

  const play = useCallback((base: number) => {
    const root = ref.current;
    if (!root || !motionAllowed()) return;
    stops.current.forEach((s) => s());
    stops.current = [];
    const run = (el: Element, kf: Parameters<typeof animate>[1], opts: Parameters<typeof animate>[2]) => {
      const a = animate(el as HTMLElement, kf as never, opts as never);
      stops.current.push(() => a.stop());
    };

    const rowEls = Array.from(root.querySelectorAll<HTMLElement>("[data-slip-row]"));
    const sealEl = root.querySelector<HTMLElement>("[data-seal]");

    rowEls.forEach((row, i) => {
      row.querySelectorAll<HTMLElement>(".cell.on").forEach((c) => {
        c.style.opacity = "0";
        c.style.transform = "scale(1.8)";
        const delay = base + i * 0.12;
        run(c, { opacity: [0, 1] }, { duration: 0.3, delay, ease: "easeOut" });
        run(c, { transform: ["scale(1.8)", "scale(1)"] }, { duration: 0.5, delay, ease: OVERSHOOT });
      });
    });

    const resBase = base + rowEls.length * 0.12 + 0.25;
    let hasRes = false;
    rowEls.forEach((row, i) => {
      row.querySelectorAll<HTMLElement>("[data-res], .cell.hit:not(.on)").forEach((el) => {
        hasRes = true;
        el.style.opacity = "0";
        el.style.transform = "translateY(4px)";
        run(
          el,
          { opacity: [0, 1], transform: ["translateY(4px)", "translateY(0px)"] },
          { duration: 0.4, delay: resBase + i * 0.09, ease: EASE },
        );
      });
    });

    if (sealEl) {
      const delay = (hasRes ? resBase + rowEls.length * 0.09 : base + rowEls.length * 0.12) + 0.2;
      sealEl.style.clipPath = "inset(0 100% 0 0)";
      run(sealEl, { clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"] }, { duration: 1, delay, ease: EASE });
    }
  }, []);

  useLayoutEffect(() => {
    if (!motionAllowed()) return;
    const cancel = whenVisible(() => play(0.7));
    return () => {
      cancel();
      stops.current.forEach((s) => s());
    };
  }, [play]);

  const settled = seal.variant === "settled";

  return (
    <div ref={ref} className="slip" onClick={() => play(0)} title={replayLabel}>
      <div className="slip-head">
        <span className="slip-title">{title}</span>
        <span className="slip-meta">
          {meta}
          <button
            type="button"
            className="replay"
            onClick={(e) => {
              e.stopPropagation();
              play(0);
            }}
          >
            ↻ {replayLabel}
          </button>
        </span>
      </div>
      <div className="slip-rows">
        {rows.map((r) => (
          <div key={r.n} className={`slip-row${settled ? " settled" : ""}`} data-slip-row="">
            <span className="slip-n">{r.n}</span>
            <span className="slip-teams">
              {r.home} – {r.away}
            </span>
            <Coupon marks={r.marks} result={r.result} locale={locale} glow />
            {settled && (
              <>
                <span className="slip-res" data-res="">{r.score}</span>
                <span className={`slip-res${r.verdict === "miss" ? " miss" : ""}`} data-res="">
                  {r.verdict === "hit" ? "✓" : r.verdict === "miss" ? "✕" : "—"}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className={`seal ${seal.variant}`} data-seal="">
        <span className="seal-k">{seal.label}</span>
        <span className="seal-v">{seal.value}</span>
      </div>
    </div>
  );
}
