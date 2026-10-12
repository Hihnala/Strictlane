"use client";

import { useLayoutEffect, useRef } from "react";
import { playRise } from "./entrance";

type Props = {
  /** Stagger position: 0, 1, 2… → delay of i × 120ms. */
  i?: number;
  as?: "div" | "section" | "p" | "h1" | "h2" | "nav" | "span";
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

/** Intro fade-up on load. Renders its final state on the server. */
export function Rise({ i = 0, as: Tag = "div", className, style, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  // Layout effect: hide before paint, so client-side navigation doesn't flash.
  useLayoutEffect(() => (ref.current ? playRise(ref.current, i) : undefined), [i]);
  return (
    <Tag ref={ref as React.Ref<never>} data-rise={i} className={className} style={style}>
      {children}
    </Tag>
  );
}
