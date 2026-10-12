import type { Metadata } from "next";
import { getRoundSummaries } from "@/lib/content";
import { summarise } from "@/lib/scoring";
import { RoundRow } from "@/components/RoundRow";
import { StatCard } from "@/components/StatCard";
import { Ambient } from "@/components/Ambient";
import { Rise } from "@/components/motion/Rise";
import { Reveal } from "@/components/motion/Reveal";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";
import { fmtDec } from "@/lib/format";

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
  const s = summarise(settled.flatMap((r) => r.located.map((l) => l.match)));

  return (
    <>
      <Ambient variant="right" />
      <section className="wide page-head">
        <Rise i={0} className="label-mono">{dict.roundsIndex.archive}</Rise>
        <Rise i={1} as="h1" className="h1-sealed">{dict.roundsIndex.title}</Rise>
        <Rise i={2} as="p" className="page-lede">{dict.roundsIndex.lede}</Rise>

        {settled.length > 0 && (
          <Rise i={3} className="stat-row" style={{ marginTop: 40 }}>
            <StatCard
              className="compact"
              label={dict.roundsIndex.roundsSettled}
              figure={settled.length}
              sub={rounds.length > settled.length ? dict.roundsIndex.open(rounds.length - settled.length) : undefined}
            />
            <StatCard
              className="compact"
              label={dict.common.correct}
              figure={
                <>
                  {s.hits}<span className="of">/{s.scored}</span>{" "}
                  {s.hitRate !== null && <span className="pct-inline">{Math.round(s.hitRate * 100)}%</span>}
                </>
              }
            />
            <StatCard
              className="compact"
              label={dict.common.meanRps}
              figure={s.meanRps !== null ? fmtDec(s.meanRps, 4, locale) : dict.common.dash}
            />
          </Rise>
        )}
      </section>

      <section className="wide round-list">
        {rounds.length === 0 && <div className="empty">{dict.roundsIndex.noRoundsYet}</div>}
        {rounds.map((r) => (
          <Reveal key={r.id}>
            <RoundRow r={r} locale={locale} />
          </Reveal>
        ))}
      </section>
    </>
  );
}
