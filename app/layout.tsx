import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

// Instrument Sans for display + body, JetBrains Mono for every numeral.
// Variable fonts cover the 400–700 / 400–600 weight ranges the design uses.
const instrument = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-instrument", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-jetbrains", display: "swap" });

const PREPAINT =
  "try{if(!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches)" +
  "document.documentElement.classList.add('sl-js')}catch(e){}";

const description =
  "Results, forecasts and calibration for the Premier League, Championship and League One.";

export const metadata: Metadata = {
  title: { default: "Strictlane", template: "%s · Strictlane" },
  description,
  metadataBase: new URL("https://strictlane.com"),
  openGraph: {
    title: "Strictlane",
    description,
    url: "https://strictlane.com",
    siteName: "Strictlane",
    images: [{ url: "/og-image.jpeg", width: 1200, height: 670, alt: "Strictlane" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Strictlane",
    description,
    images: ["/og-image.jpeg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* Dark-only — no toggle, nothing stored, nothing to flash.
            The meta tag keeps form controls and scrollbars dark too. */}
        <meta name="color-scheme" content="dark" />
        {/* Pre-paint: hide intro elements ([data-rise]) before first paint so
            they don't flash and then vanish when motion takes over. A CSS
            failsafe in tokens.css shows them after 1.5s if JS never runs. */}
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>
        <div className="page">
          <Nav />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
