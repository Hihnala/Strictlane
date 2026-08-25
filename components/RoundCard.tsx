import Link from "next/link";
import type { RoundSummary } from "@/lib/content";
import { summarise, resultSign, verdict } from "@/lib/scoring";
import { Coupon } from "./Coupon";
import { Tag } from "./Tag";

/**
 * One round, as an archive entry.
 *
 * The thirteen coupon strips are rendered small and in coupon order, so a round
 * is recognisable at a glance from its shape — where the singles fell, which
 * marks hit — without opening it.
 */
export function RoundCard({ r }: { r: RoundSummary }) {
  const matches = r.located.map((l) => l.match);
  const s = summarise(matches);
  const sys = r.round.system;

  return (
    <Link className="roundcard" href={`/rounds/${r.id}`}>
      <div className="top">
        <strong>{r.round.name}</strong>
        <span className="data" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{r.id}</span>
      </div>

      <div className="roundcard-strips">
        {r.located.map(({ match: m }) => (
          <Coupon key={m.id} size="sm" marks={m.forecast?.marks} result={resultSign(m)} />
        ))}
      </div>

      <div className="roundcard-foot">
        {r.status === "settled" ? (
          <>
            <span className="data"><b>{s.hits}/{s.scored}</b> correct</span>
            {s.meanRps !== null && (
              <span className="data" style={{ color: "var(--ink-muted)" }}>
                RPS {s.meanRps.toFixed(4)}
                {s.meanMarketRps !== null && ` vs ${s.meanMarketRps.toFixed(4)}`}
              </span>
            )}
          </>
        ) : (
          <>
            <Tag variant="pending">{r.status === "open" ? "Awaiting results" : `${r.played}/${r.total} played`}</Tag>
            <span className="data" style={{ color: "var(--ink-faint)" }}>
              {sys ? `${sys.type} · ${sys.rows} rows` : ""}
            </span>
          </>
        )}
        {r.status === "settled" && sys && (
          <span className="data" style={{ color: "var(--ink-faint)", marginLeft: "auto" }}>
            {sys.type} · {sys.rows} rows
          </span>
        )}
      </div>
    </Link>
  );
}

export { verdict };
