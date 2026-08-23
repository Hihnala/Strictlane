---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Homepage (`app/page.tsx`)

**Scope & mode:** Read — visitor arrives to understand whether the latest
round's forecast (and the market) held up, not to complete a task or convert.

**Audience & job:** Returning/first-time readers of the author's personal
football-forecast ledger. Job: see the latest coupon round's result and
score at a glance, then orient into the site's two axes (record vs. round
history).

**Structure (confirmed, comp built):**
1. First-time-visitor intro — one short paragraph, flat/neutral interface
   voice (not commentary voice), linking to `/method`. No dismiss control,
   no added client JS (theme toggle stays the app's only client script).
2. Latest round — section label + round id, round name, system line, match
   list (`MatchList`/`MatchRow`/`Coupon`/`CalBar`), 3-up stat grid (Correct,
   Mean RPS vs market, delta), "Full round →" link. Matches the reference
   `docs/files/page.tsx` structure exactly.
3. By league — one card per league to its latest matchweek (MW + played/
   total), or a "No data" tag where a league has nothing yet.

**Visual world:** Inherited Rasti, unchanged (Montserrat/Roboto/Roboto Mono,
outcome-color axis, square coupon marks, restrained palette). No new tokens,
no new components beyond the intro block's plain paragraph + link.

**Comp:** `docs/comps/homepage.html` — approved. Built with real figures
where documented (round stats; West Ham 70%; Forest–Leeds 41/30/29; Swansea
draw-raised) and clearly flagged illustrative placeholders elsewhere.

**Unresolved before production:**
- The real 13-match roster + marks/odds for a launch round isn't assembled
  as `data/rounds/{id}.json` yet.
- Top nav (5 fixed items) is out of this brief's scope — owned by `Nav.tsx`.
- Whether to scaffold the actual Next.js app now or seed data first.
