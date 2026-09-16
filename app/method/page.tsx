import type { Metadata } from "next";

export const metadata: Metadata = { title: "Method" };

export default function MethodPage() {
  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">Method</div>
        <h1>How forecasts are made and scored</h1>
        <p className="lede">
          Strictlane is a ledger, not a tipping service. This page explains
          the mechanism so the numbers elsewhere on the site can be checked,
          not just trusted.
        </p>
      </section>

      <section className="section prose">
        <h2>The forecast</h2>
        <p>
          Before each coupon round, a probability triple — 1 / X / 2 — is
          recorded for every match on the coupon, along with which signs are
          actually marked. That timestamp must precede kickoff; a forecast
          recorded after the fact is not a forecast, and the build fails if
          one ever is.
        </p>

        <h2>Ranked Probability Score</h2>
        <p>
          RPS is the headline metric, not raw accuracy. Accuracy rewards
          always backing the favourite and depends entirely on which
          fixtures happened to be on that week&apos;s coupon — it is close to
          meaningless on a small sample. RPS instead scores the full
          probability triple against what actually happened, and — because
          the outcomes 1 / X / 2 have a real order — it punishes a confident
          home call that finished as an away win harder than one that
          finished a draw. That is the right behaviour for football.
        </p>
        <p>
          There is no external benchmark folded into this figure. RPS is
          tracked as a self-measure of forecast quality over time — this
          season against last month, not this site against the betting
          market.
        </p>

        <h2>Draw watch</h2>
        <p>
          Tracked on its own because it is a failure this project has
          already made in production: a coupon that excluded the draw on
          several soft favourites, in a round that went on to produce five
          draws. The expected draw count is the sum of predicted draw
          probabilities; a result within two standard deviations of that
          expectation is noise, not a bias worth correcting for.
        </p>

        <h2>What this site will not do</h2>
        <ul>
          <li>Present a forecast as betting advice.</li>
          <li>Backfill a prediction after a match has kicked off.</li>
          <li>Hide a match that was never forecast, or fake a pending score.</li>
          <li>Store a derived figure — every number here is computed at
            build time from the underlying match data, so it cannot drift
            out of sync with what produced it.</li>
        </ul>
      </section>
    </div>
  );
}
