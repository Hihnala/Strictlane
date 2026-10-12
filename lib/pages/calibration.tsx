import type { Metadata } from "next";
import { currentSeason, getForecastMatches } from "@/lib/content";
import { summarise, calibration, drawWatch, signMix } from "@/lib/scoring";
import { StatCard } from "@/components/StatCard";
import { Ambient } from "@/components/Ambient";
import { Rise } from "@/components/motion/Rise";
import { Reveal } from "@/components/motion/Reveal";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";
import { fmtDec } from "@/lib/format";

export function renderCalibrationMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return baseMetadata(locale, "/calibration", dict.calibration.metaTitle);
}

/** The honest page: how the forecasts are actually doing, season to date. */
export async function renderCalibrationPage(locale: Locale) {
  const dict = getDictionary(locale);
  const c = dict.calibration;
  const season = await currentSeason();
  const forecast = await getForecastMatches(season.id);
  const s = summarise(forecast);
  const bins = calibration(forecast, 5).filter((b) => b.n > 0);
  const draws = drawWatch(forecast);
  const mix = signMix(forecast);
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <>
      <Ambient variant="left" />
      <section className="wide page-head">
        <Rise i={0} className="label-mono">{c.seasonToDate(season.label)}</Rise>
        <Rise i={1} as="h1" className="h1-sealed">{c.title}</Rise>
        <Rise i={2} as="p" className="page-lede" style={{ maxWidth: "60ch" }}>{c.lede}</Rise>
        <Rise i={3} className="stat-row" style={{ marginTop: 40, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          <StatCard
            label={dict.common.correct}
            figure={<>{s.hits}<span className="of">/{s.scored}</span></>}
            sub={s.hitRate !== null ? pct(s.hitRate) : undefined}
          />
          <StatCard
            label={dict.common.meanRps}
            figure={s.meanRps !== null ? fmtDec(s.meanRps, 4, locale) : dict.common.dash}
            sub={dict.common.scoredSuffix(s.scored)}
          />
        </Rise>
        {s.scored > 0 && s.scored < 50 && <p className="note-small">{c.smallSample(s.scored)}</p>}
      </section>

      <section className="wide sec-lg two-col">
        <Reveal>
          <div className="label-mono">{c.reliability}</div>
          <h2 className="h2-sealed" style={{ marginTop: 12 }}>{c.reliabilityH2}</h2>
          <p className="sec-lede" style={{ maxWidth: "48ch" }}>{c.reliabilityLede}</p>
          {bins.length ? (
            <div className="card bins">
              <div className="bin-row gt-head">
                <span>{c.band}</span><span>{c.n}</span><span>{c.predicted}</span><span>{c.observed}</span>
              </div>
              {bins.map((b) => (
                <div key={b.lo} className="bin-row" data-row="">
                  <span>{b.lo}–{b.hi}%</span>
                  <span className="n">{b.n}</span>
                  <span>{fmtDec(b.meanPredicted!, 1, locale)}%</span>
                  <span>{fmtDec(b.observed!, 1, locale)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 28 }}>{c.noScoredYet}</div>
          )}
        </Reveal>
        {bins.length > 0 && (
          <Reveal className="card plot-card">
            {/* Dot per band, area ∝ √n; the diagonal is perfect calibration. */}
            <div className="plot" role="img" aria-label={c.reliabilityH2}>
              <div className="axes" />
              {["25%", "50%", "75%", "100%"].map((g) => <div key={g} className="gl" style={{ bottom: g }} />)}
              <div className="diag" />
              {bins.map((b) => {
                const sz = Math.max(10, Math.min(36, Math.sqrt(b.n) * 3));
                return (
                  <div
                    key={b.lo}
                    className="dot"
                    data-row=""
                    style={{
                      left: `calc(${b.meanPredicted}% - ${sz / 2}px)`,
                      bottom: `calc(${b.observed}% - ${sz / 2}px)`,
                      width: sz,
                      height: sz,
                    }}
                  >
                    <span style={{ left: sz + 6 }}>n {b.n}</span>
                  </div>
                );
              })}
              <span className="ax x0">0</span>
              <span className="ax x1">100% {c.predicted}</span>
              <span className="ax y">{c.observed}</span>
            </div>
          </Reveal>
        )}
      </section>

      <section className="wide sec-lg">
        <Reveal className="label-mono">{c.drawWatch}</Reveal>
        <Reveal as="h2" className="h2-sealed" style={{ marginTop: 12 }}>{c.drawWatchH2}</Reveal>
        <Reveal as="p" className="sec-lede">{c.drawWatchLede}</Reveal>
        <Reveal className="stat-row" style={{ marginTop: 28 }}>
          <StatCard className="mid" label={dict.common.expected} figure={fmtDec(draws.expected, 1, locale)} sub={c.overNMatches(draws.n)} />
          <StatCard className="mid" label={dict.common.actual} figure={draws.actual} sub="" />
          <StatCard
            className="mid"
            label={dict.common.z}
            figure={draws.z !== null ? fmtDec(draws.z, 2, locale) : dict.common.dash}
            sub={draws.z !== null ? (Math.abs(draws.z) < 2 ? dict.common.withinNoise : dict.common.outsideNoise) : ""}
          />
        </Reveal>
        {draws.z !== null && (
          <Reveal className="card zgauge">
            {/* ±2 is the noise band; the dot is this season's z, clamped to ±4. */}
            <div className="zg-track">
              <div className="zg-line" />
              <div className="zg-band" />
              <div className="zg-dot" data-row="" style={{ left: `${Math.max(0, Math.min(100, ((draws.z + 4) / 8) * 100))}%` }} />
            </div>
            <div className="zg-scale"><span>z −4</span><span>−2</span><span>0</span><span>+2</span><span>+4</span></div>
          </Reveal>
        )}
      </section>

      <section className="wide sec-lg">
        <Reveal className="label-mono">{c.baseRates}</Reveal>
        <Reveal as="h2" className="h2-sealed" style={{ marginTop: 12 }}>{c.outcomeMix}</Reveal>
        <Reveal as="p" className="sec-lede">{c.outcomeMixLede}</Reveal>
        <Reveal className="card mix-card">
          {mix.share && (
            <div className="mix-bar">
              <span data-grow="" style={{ width: pct(mix.share["1"]), background: "var(--home)" }} />
              <span data-grow="" style={{ width: pct(mix.share.X), background: "var(--draw)" }} />
              <span data-grow="" style={{ width: pct(mix.share["2"]), background: "var(--away)" }} />
            </div>
          )}
          <div className="mix-figs">
            <div><div className="v" style={{ color: "var(--home)" }}>{mix.share ? pct(mix.share["1"]) : dict.common.dash}</div><div className="k">{c.homeWins}</div></div>
            <div><div className="v" style={{ color: "var(--draw)" }}>{mix.share ? pct(mix.share.X) : dict.common.dash}</div><div className="k">{c.draws}</div></div>
            <div><div className="v" style={{ color: "var(--away)" }}>{mix.share ? pct(mix.share["2"]) : dict.common.dash}</div><div className="k">{c.awayWins}</div></div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
