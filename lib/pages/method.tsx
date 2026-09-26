import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getDictionary, baseMetadata } from "@/lib/i18n";

export function renderMethodMetadata(locale: Locale): Metadata {
  const dict = getDictionary(locale);
  return baseMetadata(locale, "/method", dict.method.metaTitle);
}

export function renderMethodPage(locale: Locale) {
  const dict = getDictionary(locale);
  return (
    <div className="wrap">
      <section className="section">
        <div className="sec-label">{dict.method.label}</div>
        <h1>{dict.method.h1}</h1>
        <p className="lede">{dict.method.lede}</p>
      </section>

      <section className="section prose">
        <h2>{dict.method.forecastH2}</h2>
        <p>{dict.method.forecastP}</p>

        <h2>{dict.method.rpsH2}</h2>
        <p>{dict.method.rpsP1}</p>
        <p>{dict.method.rpsP2}</p>

        <h2>{dict.method.drawWatchH2}</h2>
        <p>{dict.method.drawWatchP}</p>

        <h2>{dict.method.wontH2}</h2>
        <ul>
          {dict.method.wontItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
