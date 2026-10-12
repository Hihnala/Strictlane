import type { Metadata } from "next";
import { Ambient } from "@/components/Ambient";
import { Rise } from "@/components/motion/Rise";
import { Reveal } from "@/components/motion/Reveal";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";

export function renderMethodMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return baseMetadata(locale, "/method", dict.method.metaTitle);
}

export function renderMethodPage(locale: Locale) {
  const m = getDictionary(locale).method;
  const sections = [
    { n: "01", h: m.forecastH2, ps: [m.forecastP] },
    { n: "02", h: m.rpsH2, ps: [m.rpsP1, m.rpsP2] },
    { n: "03", h: m.drawWatchH2, ps: [m.drawWatchP] },
  ];

  return (
    <>
      <Ambient variant="left" />
      <section className="wide page-head">
        <Rise i={0} className="label-mono">{m.label}</Rise>
        <Rise
          i={1}
          as="h1"
          className="h1-sealed"
          style={{ fontSize: "clamp(44px, 5.6vw, 80px)", lineHeight: 1, maxWidth: "16ch", textWrap: "balance" }}
        >
          {m.h1}
        </Rise>
        <Rise i={2} as="p" className="page-lede" style={{ maxWidth: "56ch" }}>{m.lede}</Rise>
      </section>

      <section className="wide method-body">
        {sections.map((s) => (
          <Reveal key={s.n} className="method-sec">
            <div>
              <div className="method-n">{s.n}</div>
              <h2>{s.h}</h2>
            </div>
            <div className="method-ps">
              {s.ps.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
            </div>
          </Reveal>
        ))}
        <Reveal className="card wont">
          <div className="method-n">04</div>
          <h2>{m.wontH2}</h2>
          <div className="wont-grid">
            {m.wontItems.map((w) => (
              <div key={w} className="wont-item" data-row="">
                <span className="wont-x" aria-hidden="true">✕</span>
                <span className="txt">{w}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </>
  );
}
