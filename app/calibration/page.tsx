import type { Metadata } from "next";
import { currentSeason, getForecastMatches } from "@/lib/content";
import { summarise, calibration, drawWatch, signMix } from "@/lib/scoring";
import { StatCell } from "@/components/StatCell";

export const metadata: Metadata = { title: "Calibration" };

/** The honest page: how the forecasts are actually doing, season to date. */
export default async function CalibrationPage() {
  const season = await currentSeason();
  const forecast = await getForecastMatches(season.id);
  const s = summarise(forecast);
  const bins = calibration(forecast, 5).filter((b) => b.n > 0);
  const draws = drawWatch(forecast);
  const mix = signMix(forecast);

  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">Season to date &middot; {season.label}</div>
        <h1>Calibration</h1>
        <p className="lede">
          Raw accuracy is close to meaningless: it depends on which fixtures happened to be on the
          coupon, and it rewards always backing the favourite. The number that matters is Ranked
          Probability Score, tracked over time as a self-measure of forecast quality.
        </p>

        <div className="stat-grid" style={{ marginTop: "var(--s4)" }}>
          <StatCell value={`${s.hits}/${s.scored}`} label="Correct"
            sub={s.hitRate !== null ? `${(s.hitRate * 100).toFixed(0)}%` : undefined} />
          <StatCell value={s.meanRps ? s.meanRps.toFixed(4) : "\u2014"} label="Mean RPS"
            sub={`${s.scored} scored`} />
        </div>

        {s.scored > 0 && s.scored < 50 && (
          <p className="muted" style={{ marginTop: "var(--s3)", fontSize: 13.5 }}>
            {s.scored} matches is far too small a sample to read much into the mean. A season-long
            log is what settles whether the forecasting is any good.
          </p>
        )}
      </section>

      <section className="section">
        <div className="sec-label">Reliability</div>
        <h2>Do the percentages mean anything?</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>
          Every forecast contributes three points, one per sign. If we are calibrated, predicted and
          observed should track each other down the table.
        </p>
        {bins.length ? (
          <table className="table">
            <thead>
              <tr><th>Band</th><th className="num">n</th><th className="num">Predicted</th><th className="num">Observed</th></tr>
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
          <div className="empty">No scored forecasts yet.</div>
        )}
      </section>

      <section className="section">
        <div className="sec-label">Draw watch</div>
        <h2>Predicted draws vs actual</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>
          Tracked separately because it is the failure this project has already walked into: a
          coupon that excluded X on four soft favourites in a round that produced five draws. A
          z-score inside &plusmn;2 is noise, not a bias worth correcting.
        </p>
        <div className="stat-grid">
          <StatCell value={draws.expected.toFixed(1)} label="Expected" sub={`over ${draws.n} matches`} />
          <StatCell value={String(draws.actual)} label="Actual" />
          <StatCell value={draws.z !== null ? draws.z.toFixed(2) : "\u2014"} label="z"
            sub={draws.z !== null && Math.abs(draws.z) < 2 ? "within noise" : "outside noise"} />
        </div>
      </section>

      <section className="section">
        <div className="sec-label">Base rates</div>
        <h2>Outcome mix</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>
          How the forecast matches actually resolved this season &mdash; the base rate any single
          call is competing against.
        </p>
        <div className="stat-grid">
          <StatCell value={mix.share ? `${(mix.share["1"] * 100).toFixed(0)}%` : "\u2014"} label="Home wins" />
          <StatCell value={mix.share ? `${(mix.share.X * 100).toFixed(0)}%` : "\u2014"} label="Draws" />
          <StatCell value={mix.share ? `${(mix.share["2"] * 100).toFixed(0)}%` : "\u2014"} label="Away wins" />
        </div>
      </section>
    </div>
  );
}
