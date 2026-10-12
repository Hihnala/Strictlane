"use client";

import { useEffect, useRef } from "react";
import { playReveal } from "./entrance";

type Props = {
  /** Extra delay in seconds, for staggering sibling cards (design: 80ms steps). */
  delay?: number;
  as?: "div" | "section" | "p" | "h2" | "nav" | "span";
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/** Fade-up when scrolled into view, once. Renders its final state on the server. */
export function Reveal({ delay = 0, as: Tag = "div", className, style, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => (ref.current ? playReveal(ref.current, delay) : undefined), [delay]);
  return (
    <Tag ref={ref as React.Ref<never>} className={className} style={style}>
      {children}
    </Tag>
  );
}
