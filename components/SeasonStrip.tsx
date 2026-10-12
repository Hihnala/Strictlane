import Link from "next/link";

export type SeasonColumn = {
  id: string;
  href: string;
  label: string;
  hits: number;
  scored: number;
  rps: string;
};

/**
 * The latest rounds as columns of blocks, one per match: filled = hit,
 * outline = miss, stacked from the bottom. Date and mean RPS under each.
 * Blocks carry data-pop with a per-block delay so a <Reveal> builds each
 * column bottom-up, left to right.
 */
export function SeasonStrip({ columns }: { columns: SeasonColumn[] }) {
  return (
    <div className="season-cols">
      {columns.map((c, col) => (
        <Link key={c.id} href={c.href} className="season-col">
          <span className="season-hits">
            {c.hits}
            <span className="of">/{c.scored}</span>
          </span>
          <div className="season-dots" aria-hidden="true">
            {Array.from({ length: c.scored }, (_, i) => {
              const fromBottom = c.scored - 1 - i;
              const hit = fromBottom < c.hits;
              return (
                <div
                  key={i}
                  className={`season-dot${hit ? " hit" : ""}`}
                  data-pop=""
                  data-delay={(0.3 + col * 0.12 + fromBottom * 0.035).toFixed(3)}
                />
              );
            })}
          </div>
          <span className="season-date">{c.label}</span>
          <span className="season-rps">{c.rps}</span>
        </Link>
      ))}
    </div>
  );
}
