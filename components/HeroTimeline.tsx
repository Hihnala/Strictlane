"use client";

import { useEffect, useState } from "react";

type Step = { label: string; date: string; at: number };

type Props = {
  /** Build-time clock, so the server HTML and first client render agree. */
  buildNow: number;
  settledAt: number;
  fetchAt: number;
  kickoffAt: number;
  steps: [Step, Step, Step];
  labels: { toKickoff: string; now: string; unitD: string; unitH: string; unitM: string; passed: string };
};

/**
 * Between-coupons hero: countdown to the next kickoff and the three-step
 * track (Settled → Coupon published → Sealed before kickoff) with a "Now"
 * marker. Re-reads the clock every 20s; everything else is static.
 */
export function HeroTimeline({ buildNow, settledAt, fetchAt, kickoffAt, steps, labels }: Props) {
  const [now, setNow] = useState(buildNow);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  const pct = (t: number) => Math.min(100, Math.max(0, ((t - settledAt) / (kickoffAt - settledAt)) * 100));
  const nowPct = `${pct(now).toFixed(1)}%`;
  const left = Math.max(0, kickoffAt - now);
  const d = Math.floor(left / 864e5);
  const h = Math.floor((left % 864e5) / 36e5);
  const m = Math.floor((left % 36e5) / 6e4);
  const countdown = left
    ? `${d} ${labels.unitD} ${h} ${labels.unitH} ${String(m).padStart(2, "0")} ${labels.unitM}`
    : labels.passed;

  const positions = ["0%", `${pct(fetchAt).toFixed(1)}%`, "100%"];
  const aligns = ["left", "center", "right"] as const;

  return (
    <div style={{ marginTop: 44, maxWidth: 520 }}>
      <div className="countdown">
        <span className="hero-fig">{countdown}</span>
        <span className="countdown-label">{labels.toKickoff}</span>
      </div>
      <div className="track">
        <div className="track-fill" style={{ width: nowPct }} />
        <div className="track-now" style={{ left: nowPct }}>{labels.now}</div>
        {steps.map((s, i) => (
          <div
            key={i}
            className="track-dot"
            style={{ left: positions[i], background: now >= s.at ? "var(--ink)" : "var(--page)" }}
          />
        ))}
      </div>
      <div className="track-labels">
        {steps.map((s, i) => {
          const align = aligns[i];
          return (
            <div
              key={i}
              className="track-label"
              style={{
                left: positions[i],
                top: align === "center" ? 44 : 0,
                textAlign: align,
                transform: align === "left" ? "none" : align === "right" ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              <div className="k" style={{ color: now >= s.at ? "var(--ink)" : "var(--ink-muted)" }}>{s.label}</div>
              <div className="d">{s.date}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
