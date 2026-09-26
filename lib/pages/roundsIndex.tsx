import type { Metadata } from "next";
import { getRoundSummaries } from "@/lib/content";
import { summarise } from "@/lib/scoring";
import { RoundCard } from "@/components/RoundCard";
import { StatCell } from "@/components/StatCell";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";

export function renderRoundsMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return baseMetadata(locale, "/rounds", dict.roundsIndex.metaTitle);
}

/** The archive. Every Lauantaivakio played, newest first, permanently. */
export async function renderRoundsIndex(locale: Locale) {
  const dict = getDictionary(locale);
  const rounds = await getRoundSummaries();
  const settled = rounds.filter((r) => r.status === "settled");

  // Season totals computed across every settled round.
  const allMatches = settled.flatMap((r) => r.located.map((l) => l.match));
  const s = summarise(allMatches);

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">{dict.roundsIndex.archive}</div>
        <h1>{dict.roundsIndex.title}</h1>
        <p className="lede">{dict.roundsIndex.lede}</p>

        {settled.length > 0 && (
          <div className="stat-grid" style={{ marginTop: "var(--s5)" }}>
            <StatCell
              value={String(settled.length)}
              label={dict.roundsIndex.roundsSettled}
              sub={rounds.length > settled.length ? dict.roundsIndex.open(rounds.length - settled.length) : undefined}
            />
            <StatCell value={`${s.hits}/${s.scored}`} label={dict.common.correct}
              sub={s.hitRate !== null ? `${(s.hitRate * 100).toFixed(0)}%` : undefined} />
            <StatCell value={s.meanRps !== null ? s.meanRps.toFixed(4) : dict.common.dash} label={dict.common.meanRps} />
          </div>
        )}
      </section>

      <section className="section">
        {rounds.length === 0 && <div className="empty">{dict.roundsIndex.noRoundsYet}</div>}
        {rounds.map((r) => (
          <RoundCard key={r.id} r={r} locale={locale} />
        ))}
      </section>
    </div>
  );
}
