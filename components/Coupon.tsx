import type { Sign } from "@/lib/schema";
import type { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n";

const SIGNS: Sign[] = ["1", "X", "2"];

/**
 * The signature element: a 1 X 2 coupon strip.
 *
 * Two independent facts are shown at once, and deliberately encoded differently:
 *   marks   what we predicted  -> filled square, coloured by outcome
 *   result  what happened      -> underline, form only
 * Where they coincide, the row reads as a hit without colour saying "good".
 *
 * The 1/X/2 signs themselves are not translated — they're the pools notation
 * (Veikkaus Vakio), unchanged in Finnish. Only the surrounding aria-label
 * text is locale-aware.
 */
export function Coupon({
  marks,
  result,
  size = "md",
  locale = "en",
}: {
  marks?: Sign[] | null;
  result?: Sign | null;
  size?: "md" | "sm";
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const marked = locale === "fi" ? "Merkitty" : "Marked";
  const resultWord = locale === "fi" ? "tulos" : "result";
  const label = marks?.length
    ? `${marked} ${marks.join(", ")}${result ? `; ${resultWord} ${result}` : ""}`
    : result
      ? `${dict.common.noForecast}; ${resultWord} ${result}`
      : dict.common.noForecast;

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
