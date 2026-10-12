"use client";

import { useEffect, useRef } from "react";
import { animate, inView } from "motion";
import { motionAllowed, whenVisible } from "./entrance";

type Props = {
  value: number;
  decimals?: number;
  /** Finnish decimals use a comma. */
  comma?: boolean;
};

const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;

/**
 * Counts up to `value` when scrolled into view (1.3s, ease-out cubic). The
 * server renders the exact final string, and the animation always ends on it.
 */
export function CountUp({ value, decimals = 0, comma = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) => {
    const s = v.toFixed(decimals);
    return comma ? s.replace(".", ",") : s;
  };
  const final = fmt(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !motionAllowed()) return;
    return whenVisible(() => {
      el.textContent = fmt(0);
      let stopAnim = () => {};
      const stopView = inView(
        el,
        () => {
          stopView();
          const a = animate(0, value, {
            duration: 1.3,
            ease: EASE_OUT_CUBIC,
            onUpdate: (v) => { el.textContent = fmt(v); },
            onComplete: () => { el.textContent = final; },
          });
          stopAnim = () => a.stop();
        },
        { amount: 0.15 },
      );
      return () => {
        stopView();
        stopAnim();
        el.textContent = final;
      };
    });
    // fmt/final derive from these three props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, comma]);

  return <span ref={ref}>{final}</span>;
}
