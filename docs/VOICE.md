# Voice — writing the commentary

Governs everything in `content/`. Does **not** govern the interface: labels,
stat cells, tags, empty states and the method page stay flat and neutral. See
§"The wall" below — it's the most important part of this document.

---

## The register

Opinionated. Sharp. Occasionally very funny. This is a personal project, not a
wire service, and commentary that reads like an automated match report is worse
than no commentary at all.

Be brutal about decisions — selections, substitutions, tactical setups, transfer
policy, a defence that gave up on a set piece. Be equally generous about
excellence, and mean it: a team that was genuinely good should be told so
without a hedge attached.

The tone to aim for is a smart friend who watched the game and has thoughts,
not a pundit performing outrage. Contempt is cheap. Precision is what makes
criticism land.

**Good:**
> Southampton spent the summer insisting the points deduction was the only thing
> standing between them and promotion, then went to Watford and defended a
> corner like eleven strangers who'd been introduced at half-time.

**Bad — vague and shouty:**
> Absolutely SHOCKING from Southampton. Disgraceful. Someone needs to be sacked.

**Bad — automated:**
> Southampton were defeated 2-1 at Watford in a disappointing result for the
> visitors.

---

## Funny is allowed, when the match earns it

Don't reach for jokes. When a match hands you one, take it.

> West Ham were the shortest-priced title favourite in the division and lost at
> home to a Charlton side missing six players. At some point during the second
> half you could see them working out that the Championship is not, in fact, a
> formality with worse floodlights.

> QPR 0-0 Bolton was ninety minutes of two teams politely declining to attack
> each other, and it went in the coupon as a single. That's on me.

Self-deprecation about our own forecasts is fair game and probably the funniest
seam available. The site's whole premise is being wrong in public.

---

## The wall: opinion never touches the numbers

This is not a style preference. It's the thing that keeps the site honest.

| Where | Voice |
|---|---|
| `content/**/*.md` — commentary, round reviews | Opinionated, brutal, funny |
| Forecast `probs` and `marks` in `data/` | Neutral. Nothing else. |
| Stat cells, RPS figures, calibration page | Neutral. Nothing else. |
| Nav, tags, empty states, method page | Flat and plain |

A forecast is a claim about the world made before kickoff. If the probabilities
start bending toward the team you want to win, every number downstream — RPS,
calibration, the market delta — becomes decoration. The commentary is where the
opinions go **precisely so** the forecasts can stay clean.

Practical test: if a sentence would change a number, it doesn't belong in
commentary. If it only changes how the number reads, it does.

---

## Declared bias

**Arsenal.** Favourite team. **Ipswich Town.** Soft spot.

These are stated here rather than hidden, because a reader who works it out
themselves will assume it's been hidden everywhere else.

The rule for both: **hold them to the same standard, and skip the excuses.** The
tell of a homer isn't praise — it's mitigation. "Arsenal were unlucky", "the
referee didn't help", "Ipswich were always going to find this hard". Cut all of
it. If Arsenal are poor, say they were poor and say why. If Ipswich get beaten
by a better side, that's the sentence.

Affection is fine, and it's more readable than fake neutrality:

> Ipswich beat Sunderland with an Angulo free kick that a 6'9" goalkeeper had no
> business missing, and it is entirely possible I watched it more than once.

Excuses are not:

> ~~Arsenal never really got going, though in fairness the pitch was poor and
> the schedule has been brutal.~~

Never let it near a forecast. If an Arsenal match is on a coupon and the number
feels generous, it probably is.

---

## Structure

Matchweek commentary is short — four or five short blocks, not an essay. Useful
recurring headings, none mandatory:

- **Biggest surprise** — and *why* it was surprising, in market terms where possible
- **Best comeback** / **Statement result**
- **Worst decision** — a selection, a substitution, a tactic
- **What I got wrong** — where our own forecast missed, and whether it was bad
  reasoning or ordinary variance
- **Note for the model** — anything that should change how we forecast next time

Round reviews (`content/rounds/`) lean harder on the last two.

Front-matter:

```yaml
---
title: Championship MW2
summary: One line, plain. Shown in listings, so no jokes that need context.
---
```

---

## Rules

1. **Criticise decisions and performances, never persons.** "That substitution
   was cowardly" is fine. Speculation about someone's private life, health, or
   character is not, and it isn't funny either.
2. **No punching down at fans, cities, or accents.** Punch at millionaires and
   the people who pick the team.
3. **Every strong claim needs a specific.** A scoreline, an xG figure, a minute,
   a named decision. "Terrible defending" is nothing; "three men watching the
   near post while Charlton's centre-half strolled to the back" is something.
4. **Past tense, active voice.** "Wolves tore them open", not "Preston were
   opened up".
5. **Say when it was luck.** A 1-0 built on one deflection and a save is not a
   masterclass, and calling it one costs credibility for nothing.
6. **Admit our misses in the same breath as the team's.** A commentary that
   savages Southampton and stays quiet about a blown single reads as cowardice.

---

## Worked example

The 22 Aug 2026 round, three ways.

**Automated (useless):**
> West Ham United suffered a 1-2 home defeat to Charlton Athletic in a
> disappointing result. Elsewhere, Brentford beat Tottenham 3-0.

**Overcooked (also useless):**
> ABSOLUTE CARNAGE at the London Stadium as West Ham's season implodes before it
> starts! Meanwhile Spurs are, once again, a total shambles!!

**Right:**
> **Biggest surprise.** West Ham 1-2 Charlton, and it isn't close. A 70% home
> favourite lost to a side missing six first-teamers, and the London Stadium
> spent the last twenty minutes discovering what "no divine right" sounds like.
>
> **Statement result.** Brentford 3-0 Tottenham. Spurs turned up without Van de
> Ven, Porro and Sarr and set up as though nobody had mentioned it. Brentford
> were three up before the hour and could have had more.
>
> **What I got wrong.** Five draws in thirteen, three of them on matches where
> I'd excluded X to fit an 8+0 system. Derby and QPR were both 27% draws and both
> drew. The West Ham single was the loud mistake; the draw coverage was the
> expensive one.

---

## Length

150–350 words per matchweek. Round reviews can run to 500 when there's something
to say. If it's a quiet week, write four sentences and stop — padding is how
commentary starts sounding automated again.
