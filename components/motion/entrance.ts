import { animate, inView } from "motion";

/* ---------------------------------------------------------------------------
 * Shared entrance motion for the client islands in this folder.
 *
 * The rules (docs: HANDOFF "Motion"):
 *   - Server HTML is the final state. Nothing is hidden until after hydration,
 *     so a page without JS — or with a failed bundle — reads normally.
 *   - prefers-reduced-motion: render the final state, no transforms.
 *   - A background tab doesn't play anything; motion waits until it's visible.
 *   - Hit and miss animate identically. Nothing here knows about verdicts.
 *
 * Descendants of a <Rise> or <Reveal> can opt in with plain data attributes,
 * so the rows themselves stay in Server Components:
 *   data-row    cascades in, 40ms per row
 *   data-grow   bar grows from scaleX(0), groups of three offset by 45ms
 *   data-pop    block pops in (opacity, scaleX .3→1); its own data-delay (s)
 * ------------------------------------------------------------------------- */

export const EASE = [0.2, 0.8, 0.2, 1] as const;

export function motionAllowed(): boolean {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Run `fn` now if the tab is visible, otherwise on first visibility. */
export function whenVisible(fn: () => (() => void) | void): () => void {
  let cleanup: (() => void) | void;
  if (!document.hidden) {
    cleanup = fn();
    return () => cleanup?.();
  }
  const onVis = () => {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", onVis);
    cleanup = fn();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    cleanup?.();
  };
}

type Stop = () => void;

function hideRise(el: HTMLElement, y: number) {
  el.style.opacity = "0";
  el.style.transform = `translateY(${y}px)`;
}

function rise(el: HTMLElement, y: number, duration: number, delay: number): Stop {
  const a = animate(
    el,
    { opacity: [0, 1], transform: [`translateY(${y}px)`, "translateY(0px)"] },
    { duration, delay, ease: EASE },
  );
  return () => a.stop();
}

function grows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-grow]"));
}
function rows(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-row]"));
}

function hideGrow(el: HTMLElement) {
  el.style.transformOrigin = "left center";
  el.style.transform = "scaleX(0)";
}

function grow(els: HTMLElement[], base: number): Stop[] {
  return els.map((g, i) => {
    const a = animate(
      g,
      { transform: ["scaleX(0)", "scaleX(1)"] },
      { duration: 1.1, delay: base + Math.floor(i / 3) * 0.045, ease: EASE },
    );
    return () => a.stop();
  });
}

/** Lifts the pre-paint hide (tokens.css) once inline styles have taken over. */
export function markReady() {
  document.documentElement.classList.add("sl-ready");
}

/** Intro rise on load: opacity 0→1, y 28→0, 1s, staggered 120ms by `index`. */
export function playRise(el: HTMLElement, index: number): Stop {
  if (!motionAllowed()) return () => {};
  return whenVisible(() => {
    const bars = grows(el);
    hideRise(el, 28);
    bars.forEach(hideGrow);
    markReady();
    const stops = [rise(el, 28, 1, index * 0.12), ...grow(bars, 0.5)];
    return () => stops.forEach((s) => s());
  });
}

/** Reveal on scroll: same curve, y 24, once, at 15% visibility. */
export function playReveal(el: HTMLElement, delay: number): Stop {
  if (!motionAllowed()) return () => {};
  return whenVisible(() => {
    const bars = grows(el);
    const cascade = rows(el);
    const pops = Array.from(el.querySelectorAll<HTMLElement>("[data-pop]"));
    hideRise(el, 24);
    cascade.forEach((r) => hideRise(r, 8));
    bars.forEach(hideGrow);
    pops.forEach((p) => { p.style.opacity = "0"; p.style.transform = "scaleX(0.3)"; });
    let stops: Stop[] = [];
    const stopView = inView(
      el,
      () => {
        stopView();
        stops = [
          rise(el, 24, 1, delay),
          ...cascade.map((r, i) => rise(r, 8, 0.6, delay + i * 0.04)),
          ...grow(bars, delay + 0.2),
          ...pops.map((p) => {
            const a = animate(
              p,
              { opacity: [0, 1], transform: ["scaleX(0.3)", "scaleX(1)"] },
              { duration: 0.5, delay: delay + Number(p.dataset.delay ?? 0), ease: EASE },
            );
            return () => a.stop();
          }),
        ];
      },
      { amount: 0.15 },
    );
    return () => {
      stopView();
      stops.forEach((s) => s());
    };
  });
}
