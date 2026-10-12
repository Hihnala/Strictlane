import Link from "next/link";
import type { RoundSummary } from "@/lib/content";
import { summarise, resultSign } from "@/lib/scoring";
import type { Locale } from "@/lib/i18n";
import { getDictionary, localePrefix } from "@/lib/i18n";
import { fmtDec } from "@/lib/format";
import { Coupon } from "./Coupon";
import { Tag } from "./Tag";

/**
 * One round, as an archive entry: name and date, the thirteen coupon strips
 * small and in coupon order (so a round is recognisable from its shape —
 * where the singles fell, which marks hit — without opening it), and the score.
 * Strips carry data-row so a surrounding <Reveal> cascades them in.
 */
export function RoundRow({ r, locale = "en" }: { r: RoundSummary; locale?: Locale }) {
  const dict = getDictionary(locale);
  const prefix = localePrefix(locale);
  const s = summarise(r.located.map((l) => l.match));
  const sys = r.round.system;

  return (
    <Link className="round-row" href={`${prefix}/rounds/${r.id}`}>
      <div>
        <div className="name">{r.round.name}</div>
        <div className="id">{r.id}</div>
      </div>
      <div className="round-strips">
        {r.located.map(({ match: m }) => (
          <div key={m.id} data-row="">
            <Coupon size="xs" marks={m.forecast?.marks} result={resultSign(m)} locale={locale} />
          </div>
        ))}
      </div>
      <div className="round-score">
        {r.status === "settled" ? (
          <>
            <span className="big">
              {s.hits}<span className="of">/{s.scored}</span> <span className="lbl">{dict.roundCard.correct}</span>
            </span>
            {s.meanRps !== null && <span className="rps">RPS {fmtDec(s.meanRps, 4, locale)}</span>}
          </>
        ) : (
          <Tag variant="pending">
            {r.status === "open" ? dict.roundCard.awaitingResults : dict.roundCard.playedOf(r.played, r.total)}
          </Tag>
        )}
        {sys && <span className="sys">{sys.type} · {dict.common.rowsCount(sys.rows)}</span>}
      </div>
    </Link>
  );
}
