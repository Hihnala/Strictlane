import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";

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

/** Applied before paint so a dark-theme visitor never sees a white flash. */
const noFlash = `(function(){try{var t=localStorage.getItem('rasti-theme');if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Roboto+Mono:wght@400;500;600&family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
