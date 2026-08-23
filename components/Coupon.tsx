import type { Sign } from "@/lib/schema";

const SIGNS: Sign[] = ["1", "X", "2"];

/**
 * The signature element: a 1 X 2 coupon strip.
 *
 * Two independent facts are shown at once, and deliberately encoded differently:
 *   marks   what we predicted  -> filled square, coloured by outcome
 *   result  what happened      -> underline, form only
 * Where they coincide, the row reads as a hit without colour saying "good".
 */
export function Coupon({
  marks,
  result,
  size = "md",
}: {
  marks?: Sign[] | null;
  result?: Sign | null;
  size?: "md" | "sm";
}) {
  const label = marks?.length
    ? `Marked ${marks.join(", ")}${result ? `; result ${result}` : ""}`
    : result
      ? `No forecast; result ${result}`
      : "No forecast";

  return (
    <div className={`coupon${size === "sm" ? " sm" : ""}`} role="img" aria-label={label}>
      {SIGNS.map((s) => {
        const on = marks?.includes(s) ?? false;
        const hit = result === s;
        const cls = ["cell", on ? "on" : "", hit ? "hit" : ""].filter(Boolean).join(" ");
        // An unmarked true result still needs its underline to read as the
        // outcome colour, otherwise a no-forecast row loses its result entirely.
        const style = !on && hit ? { color: `var(--${s === "1" ? "home" : s === "X" ? "draw" : "away"})` } : undefined;
        return (
          <div key={s} className={cls} data-sign={s} style={style}>
            {s}
          </div>
        );
      })}
    </div>
  );
}
