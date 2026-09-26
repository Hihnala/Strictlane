import type { Metadata } from "next";
import { currentSeason, getForecastMatches } from "@/lib/content";
import { summarise, calibration, drawWatch, signMix } from "@/lib/scoring";
import { StatCell } from "@/components/StatCell";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";

export function renderCalibrationMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return baseMetadata(locale, "/calibration", dict.calibration.metaTitle);
}

/** The honest page: how the forecasts are actually doing, season to date. */
export async function renderCalibrationPage(locale: Locale) {
  const dict = getDictionary(locale);
  const season = await currentSeason();
  const forecast = await getForecastMatches(season.id);
  const s = summarise(forecast);
  const bins = calibration(forecast, 5).filter((b) => b.n > 0);
  const draws = drawWatch(forecast);
  const mix = signMix(forecast);

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">{dict.calibration.seasonToDate(season.label)}</div>
        <h1>{dict.calibration.title}</h1>
        <p className="lede">{dict.calibration.lede}</p>

        <div className="stat-grid" style={{ marginTop: "var(--s4)" }}>
          <StatCell value={`${s.hits}/${s.scored}`} label={dict.common.correct}
            sub={s.hitRate !== null ? `${(s.hitRate * 100).toFixed(0)}%` : undefined} />
          <StatCell value={s.meanRps ? s.meanRps.toFixed(4) : dict.common.dash} label={dict.common.meanRps}
            sub={dict.common.scoredSuffix(s.scored)} />
        </div>

        {s.scored > 0 && s.scored < 50 && (
          <p className="muted" style={{ marginTop: "var(--s3)", fontSize: 13.5 }}>
            {dict.calibration.smallSample(s.scored)}
          </p>
        )}
      </section>

      <section className="section">
        <div className="sec-label">{dict.calibration.reliability}</div>
        <h2>{dict.calibration.reliabilityH2}</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>{dict.calibration.reliabilityLede}</p>
        {bins.length ? (
          <table className="table">
            <thead>
              <tr><th>{dict.calibration.band}</th><th className="num">{dict.calibration.n}</th><th className="num">{dict.calibration.predicted}</th><th className="num">{dict.calibration.observed}</th></tr>
            </thead>
            <tbody>
              {bins.map((b) => (
                <tr key={b.lo}>
                  <td className="data">{b.lo}&ndash;{b.hi}%</td>
                  <td className="num data">{b.n}</td>
                  <td className="num data">{b.meanPredicted!.toFixed(1)}%</td>
                  <td className="num data">{b.observed!.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">{dict.calibration.noScoredYet}</div>
        )}
      </section>

      <section className="section">
        <div className="sec-label">{dict.calibration.drawWatch}</div>
        <h2>{dict.calibration.drawWatchH2}</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>{dict.calibration.drawWatchLede}</p>
        <div className="stat-grid">
          <StatCell value={draws.expected.toFixed(1)} label={dict.common.expected} sub={dict.calibration.overNMatches(draws.n)} />
          <StatCell value={String(draws.actual)} label={dict.common.actual} />
          <StatCell value={draws.z !== null ? draws.z.toFixed(2) : dict.common.dash} label={dict.common.z}
            sub={draws.z !== null && Math.abs(draws.z) < 2 ? dict.common.withinNoise : dict.common.outsideNoise} />
        </div>
      </section>

      <section className="section">
        <div className="sec-label">{dict.calibration.baseRates}</div>
        <h2>{dict.calibration.outcomeMix}</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>{dict.calibration.outcomeMixLede}</p>
        <div className="stat-grid">
          <StatCell value={mix.share ? `${(mix.share["1"] * 100).toFixed(0)}%` : dict.common.dash} label={dict.calibration.homeWins} />
          <StatCell value={mix.share ? `${(mix.share.X * 100).toFixed(0)}%` : dict.common.dash} label={dict.calibration.draws} />
          <StatCell value={mix.share ? `${(mix.share["2"] * 100).toFixed(0)}%` : dict.common.dash} label={dict.calibration.awayWins} />
        </div>
      </section>
    </div>
  );
}
