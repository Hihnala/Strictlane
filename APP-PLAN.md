# Strictlane app — initial plan (draft)

Status: **draft v0.1, 2026-09-26**. It needs answers to the open questions
in §9 before any code is written. iPhone first, Android second, both built
from one codebase.

---

## 1. What the app is (and isn't)

The app is the Strictlane ledger in your pocket: the same forecasts, rounds,
results and scoring as strictlane.com, in the same flat, honest voice. It is
**not** a tipping app, a betting companion or a place to play Vakio.

Product principles carry over unchanged (PRODUCT.md):

| Site principle | What it means in the app |
| --- | --- |
| Honesty over performance | A miss looks as calm as a hit. No streak banners, no "🔥 5 in a row". |
| Two voices, one wall | Commentary renders as prose; numbers render from data. Commentary never touches a figure. |
| Nothing derived is stored | The app never computes its own RPS or hit rate. It shows the figures the site build computed (see §3), so the app and the site can't disagree. |
| The record includes what wasn't called | "No forecast" rows stay visible. Pending fixtures never show a placeholder score. |
| Small and honest | No accounts, no ads, no analytics SDKs, no tracking. Nothing links to or deep-links into Veikkaus. |
| Colour encodes outcome | Rasti tokens only: 1/X/2 colours, hit/miss shown by form (✓/✕, underline). No crests, no league colours. |

---

## 2. Recommended approach: Expo (React Native) + a static data feed

### Options considered

| Option | iPhone | Android | Reuses existing TS (`schema.ts`, zod) | Cost / effort | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A. Expo / React Native** | Native app | Same codebase | Yes, directly | Medium | **Recommended** |
| B. PWA ("Add to Home Screen") | Web app with an icon, web push since iOS 16.4 | Works | Yes, it *is* the site | Low | Worth doing anyway as a cheap step 0, but it isn't an App Store app |
| C. Native Swift + Kotlin | Best iOS feel | Second full rewrite | No, the data contract gets duplicated twice | High | Two codebases for a one-person project breaks "small and honest" |
| D. Capacitor wrapper around the site | Web view in a shell | Same | Yes | Low | Apple often rejects thin website wrappers (Guideline 4.2) |

**Why Expo:** it's TypeScript and React, which the site already uses. The zod
data contract (`lib/schema.ts`) can be shared rather than rewritten. EAS
Build compiles the iOS app in the cloud, so **no Mac is needed**. The same
code ships to Android later, mostly as QA and store work instead of a
rewrite.

### Repository shape

I recommend keeping everything in this repo, so the data contract and the app
change in the same commit:

```
app/ components/ lib/ ...   the website, unchanged
lib/schema.ts               shared: imported by the site, the feed builder and the app
mobile/                     new: Expo app (own package.json, via npm workspaces)
  app/                      expo-router screens
  components/               RN versions of MatchRow, Coupon, StatCell, CalBar, Tag…
  theme/rasti.ts            Rasti tokens ported from app/tokens.css
```

Watch-outs:
- TypeScript stays on `^5.7`. Expo's SDKs are on 5.x, so this is compatible,
  but the pin has to hold in both workspaces.
- `lib/content.ts` uses `node:fs` and must **not** be imported by the app.
  Only `schema.ts` (and types) cross the boundary.

---

## 3. Data: a static, versioned JSON feed from the existing build

The site has no API, and the app shouldn't need a server either. The plan
is for the existing Vercel build to also emit a read-only JSON feed. It's
still static files, still published by `git push`:

```
https://strictlane.com/feed/v1/index.json            seasons, current round ids, latest-per-league pointers, feed version, builtAt
https://strictlane.com/feed/v1/teams.json
https://strictlane.com/feed/v1/rounds/{id}.json      round + located matches + summary + outlook + review markdown
https://strictlane.com/feed/v1/{season}/{league}.json  matchweeks, matches, standings, per-mw summaries, commentary markdown
https://strictlane.com/feed/v1/{season}/calibration.json
https://strictlane.com/feed/v1/pages/{slug}.json      method, statistics
```

- Implemented as Next static route handlers (`app/feed/v1/.../route.ts`,
  `dynamic = "force-static"` + `generateStaticParams`) that call the same
  `lib/content.ts` + `lib/scoring.ts` the pages already call. There's no
  second implementation of any figure.
- Derived figures (RPS, hit rate, coverage, standings, calibration bins) are
  computed **at build time and shipped in the feed**, as they are in the
  HTML. The app only displays them. An old app version therefore can't show
  different numbers from the site.
- Each feed file is described by a zod schema in a new `lib/feed-schema.ts`.
  The build validates its own output, and the app validates what it downloads.
  A breaking change means `/feed/v2/`, and v1 keeps serving until old app
  versions age out.
- Commentary ships as **raw Markdown** and the app renders it natively. This
  avoids web views and keeps text selectable and accessible.
- **Offline:** the app caches the last good feed on-device, shows it with an
  "Updated <time>" stamp and revalidates on open or pull-to-refresh
  (ETag/`If-None-Match`, which Vercel supports for static files).
- The feed is a public URL, so it gets the same data-licence question as the
  site (see §7).

---

## 4. iPhone MVP: screens

Navigation is a bottom tab bar, the mobile equivalent of the site's fixed
nav:

| Tab | Content | Site equivalent |
| --- | --- | --- |
| **This week** | Open coupon (13 rows, marks, probabilities, system, expected covered) and the last settled round with its summary | `/` |
| **Rounds** | Round list → round detail (coupon, results, ✓/✕, review commentary), prev/next swipe | `/rounds`, `/rounds/[id]` |
| **Leagues** | Segmented PL / Champ / L1 → standings + matchweek rail → matchweek (matches + commentary) | `/[season]/[league]`, `/[season]/[league]/[mw]` |
| **Record** | Season RPS, hit rate, calibration bars, draw watch, sign mix | `/calibration`, `/stats` |
| **About** (or in a menu) | Method, bias declaration, "analysis, not betting advice", GambleAware link, credits | `/method`, footer |

Cross-links work as they do on the site: a coupon row opens its match in its
league/matchweek, and a matchweek match that belonged to a round links back to
that round. The app also opens the site's URLs directly (universal links), so
`strictlane.com/rounds/2026-09-19` opens in the app when it's installed.

Design adaptation: Rasti is desktop-first with a 720px column, so the phone
layout is new work. That means 44pt tap targets, Dynamic Type support,
VoiceOver labels on 1/X/2 cells ("Home win, 48 percent, marked") and
dark-only (`userInterfaceStyle: "dark"`). Fonts are Montserrat, Roboto and
Roboto Mono, bundled with the app instead of loaded from Google Fonts.

**Not in the MVP:** notifications, widgets, authoring, search, per-team
pages (not built on the site either).

---

## 5. Phases

| # | Phase | Output | Rough size* |
| --- | --- | --- | --- |
| 0 | Decisions + groundwork | Answers to §9; Apple Developer account; Veikkaus licence read; app name/icon | days (mostly waiting) |
| 1 | Data feed | `lib/feed-schema.ts`, `app/feed/v1/**`, feed validated in `npm run validate`/build, deployed on strictlane.com | 2–4 evenings |
| 2 | App skeleton | `mobile/` Expo app, npm workspaces, Rasti theme, tab bar, feed client + offline cache, EAS Build profile | 2–3 evenings |
| 3 | iPhone MVP screens | The screens in §4, universal links, accessibility pass | 1–2 weeks of evenings |
| 4 | iPhone release | TestFlight (you + a few testers) → App Store submission (privacy label "Data Not Collected", age rating questionnaire, review notes explaining "analysis, not betting") | 1 week incl. review |
| 5 | Android | Same code: Android back behaviour, edge-to-edge, Play Console closed test, then production | ~1 week + Play's testing window |
| 6 | Optional extras | Notifications, home-screen widget ("this week's coupon"), authoring (see §6) | per feature |

\*A one-person, evenings-and-weekends estimate, not a commitment.

Every phase ships on its own. Phase 1 on its own is harmless to the site: it
adds static files and changes no pages.

---

## 6. Optional features that change the architecture (need your call)

These are the features that move the project away from "no server, no
accounts". I haven't planned them in yet.

1. **Push notifications** ("Coupon is up", "Results are in", "Review
   published"). They need something to send to APNs/FCM. The lightest option
   fits the existing pipeline: a GitHub Action on push to `main` diffs the
   feed and calls Expo's push service. That needs an Expo push token store,
   which is a small backend or a hosted KV. **Alternative with zero
   infrastructure:** iOS/Android background fetch that checks `index.json`
   and raises a local notification. It's free, but timing isn't guaranteed.
2. **Authoring on the phone** (entering forecasts/marks before kickoff).
   This could be the most useful feature for *you*, and it's also the most
   sensitive one:
   - Integrity: `capturedAt` must precede kickoff. A phone clock can be
     wrong or set back, so the app should **not** be trusted for the
     timestamp. The server-side commit time (a commit pushed via the
     GitHub API to the coupon PR branch) stays the independent provenance,
     as the Vakio pipeline already intends.
   - It needs GitHub auth on the device (OAuth device flow or a
     fine-grained token in the iOS Keychain), limited to this repo.
   - It turns a public reader app into a private tool. It could be a
     separate "editor" build that is never published, or a hidden mode.
3. **Home-screen widget** showing this week's coupon or the last round's
   verdict. On iOS this needs a small SwiftUI WidgetKit extension; Expo
   supports it via a config plugin. It's nice to have but it's native work.

---

## 7. Store, legal and cost checklist

- **Apple Developer Program:** US$99/year, needed for TestFlight and the App
  Store. Personal (individual) enrollment shows your name as the seller.
- **Google Play Console:** US$25 one-off. New *personal* accounts currently
  have to run a closed test with a minimum number of testers for a
  continuous period (12 testers for 14 days at the time of writing; check
  the current rule) before production access.
- **Gambling-adjacent content:** the app offers no real-money play,
  purchases or links to operators, so the real-money gambling rules (App
  Store 5.3, Play's gambling policy) shouldn't apply. Still, expect a
  mature age rating from the age-rating questionnaire. Put "analysis, not
  betting advice" in the store description and in App Review notes.
- **Veikkaus data licence:** PRODUCT.md already flags this as unresolved
  for the site. An app store listing plus a public JSON feed is a more
  visible form of republishing coupon data, so it should be settled
  **before phase 4**. Finnish gambling-marketing rules are part of the same
  read. A cautious fallback is to leave `poolPopularity` (pure Veikkaus
  data) out of the feed.
- **Privacy:** no accounts, no analytics and no third-party SDKs that
  collect data give an App Store privacy label of "Data Not Collected" and a
  simple Play Data Safety form. You still need a privacy policy URL; a short
  `/privacy` page on the site is enough.
- **Trademark:** check that "Strictlane" is available as an app name on
  both stores.
- **Running cost** after release: the Apple fee, plus Expo EAS's free tier
  (enough for occasional builds). Vercel serving the feed costs nothing
  extra at this scale.

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Site and app drift apart | One schema file, figures computed only in the site build, feed validated on both ends |
| Feed breaking change strands old app versions | Versioned `/feed/vN/`, the app shows "Please update" when `index.json` says its version is retired |
| App Review rejects it as "just a website" (4.2) | Native screens, offline cache, universal links, widget later: real app behaviour, not a web view |
| Gambling/licence scrutiny | Settle the Veikkaus question first; no operator links; clear review notes |
| Maintenance load on a one-person project | No backend in the MVP, the same `git push` workflow, and app releases only needed for UI changes (data updates arrive via the feed) |

---

## 9. Open questions

1. **Audience:** is the app just for you (TestFlight only, never public), or
   a public App Store / Play release? This decides how much of §7 matters.
2. **Read-only or authoring:** is the MVP a reader for the ledger, or do you
   also want to enter forecasts from your phone (§6.2)? If authoring
   matters, it may be worth building *first*, as a private tool.
3. **Notifications:** do you want push notifications at all? If so, which
   events, and is a small hosted component acceptable, or should it stay
   zero-infrastructure (§6.1)?
4. **Approach:** are you happy with Expo/React Native (one TS codebase, no
   Mac needed)? Or do you prefer native Swift for iPhone, accepting a
   separate Android build later? Do you have a Mac, and do you already have
   an Apple Developer account?
5. **Same repo?** Is it OK to add `mobile/` to this repo (npm workspaces)
   and a public `/feed/v1/` to strictlane.com, or should the app live in a
   separate repo?
6. **Veikkaus licence:** has the licence question from PRODUCT.md been
   resolved since, and are you comfortable with coupon data in a public
   feed and an app store listing?
7. **Scope:** anything from the site you'd drop from the app (e.g.
   standings, calibration), or anything the app should have that the site
   doesn't (e.g. a widget)?
