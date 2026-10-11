#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — results & fixtures sync from ballprediction.com
 *
 *   npx tsx scripts/fetch-results.ts --raw     print what the site says, write nothing
 *   npx tsx scripts/fetch-results.ts --dry     print the planned changes, write nothing
 *   npx tsx scripts/fetch-results.ts           write data/{season}/{league}/mw-NN.json
 *
 * Options:
 *   --days N          fixture horizon: add every round whose matches mostly fall
 *                     within the next N days (default 8)
 *   --summary FILE    also write the report as Markdown, e.g. for a PR body
 *   --cache DIR       read pages from DIR when present, save fetched pages there
 *
 * Reads two public pages per league — /results (full-time + half-time scores)
 * and /fixtures (the whole season: round, date, UTC kickoff or "Postp.") — and
 * reconciles them with the current season's matchweek files:
 *
 *   pending/postponed + result on the site   → played, score, halfTime
 *   played without halfTime                  → halfTime added (scores must agree)
 *   pending with a different site kickoff    → kickoff corrected
 *   postponed with a new site kickoff        → pending, rescheduled
 *   pending marked "Postp." on the site      → postponed
 *   fixture missing from a round we track,
 *   or in a round inside the horizon         → added (forecast: null)
 *
 * It never touches `forecast` or `pool`, and never overwrites a result. Anything
 * that disagrees — a different score, a round mismatch, home/away swapped, a
 * kickoff that would land before a forecast's capturedAt — is listed under
 * "Needs a human" and left exactly as it is. An unknown team name or a page
 * whose markup no longer parses aborts the run with nothing written.
 *
 * robots.txt asks for a 10-second crawl delay; six pages take about a minute.
 * ------------------------------------------------------------------------- */

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Matchweek, TeamsFile, type LeagueId, type Score, type Team } from "../lib/schema";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const SITE = "https://ballprediction.com";
const CRAWL_DELAY_MS = 10_000;
/** Same convention as the hand-entered files: matchday date, 14:00 UTC, when the real time is unknown. */
const PLACEHOLDER_TIME = "T14:00:00.000Z";

const LEAGUES: Array<{ id: LeagueId; label: string; page: string; idCode: string; teams: number }> = [
  { id: "premier-league", label: "Premier League", page: "epl", idCode: "e0", teams: 20 },
  { id: "championship", label: "Championship", page: "efl", idCode: "e1", teams: 24 },
  { id: "league-one", label: "League One", page: "elo", idCode: "e2", teams: 24 },
];

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const RAW = args.includes("--raw");
const DRY = args.includes("--dry");
const DAYS = Number(opt("--days") ?? 8);
const CACHE = opt("--cache");
const SUMMARY = opt("--summary");

const log = (s: string) => process.stdout.write(s);

class Abort extends Error {}

/* ------------------------------------------------------------------ http --- */

let lastRequest = 0;

async function getPage(url: string, cacheName: string): Promise<string> {
  const cached = CACHE ? path.join(CACHE, cacheName) : null;
  if (cached && existsSync(cached)) return readFile(cached, "utf8");

  const wait = lastRequest + CRAWL_DELAY_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();

  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": "strictlane-results/1.0 (+https://strictlane.com)" },
  });
  if (!res.ok) throw new Abort(`${res.status} ${res.statusText} — ${url}`);
  const html = await res.text();
  if (cached) {
    await mkdir(CACHE!, { recursive: true });
    await writeFile(cached, html);
  }
  return html;
}

/* --------------------------------------------------------------- parsing --- */

interface SiteResult {
  round: number;
  home: string;
  away: string;
  ft: Score;
  ht: Score;
}

type SiteState =
  | { kind: "played"; ft: Score }
  | { kind: "scheduled"; kickoff: string }
  | { kind: "postponed" };

interface SiteFixture {
  round: number;
  date: string; // YYYY-MM-DD, from the round header
  home: string;
  away: string;
  state: SiteState;
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

/** Tag-stripped, entity-decoded, whitespace-collapsed text. */
function text(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/g, (whole, e: string) =>
      e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : (ENTITIES[e] ?? whole)
    )
    .replace(/\s+/g, " ")
    .trim();
}

function markupChanged(where: string, snippet: string): Abort {
  return new Abort(
    `${where}: markup no longer matches the parser — nothing written.\n` +
      `  Inspect with --raw / --cache and update parseResults() or parseFixtures().\n` +
      `  Near: ${text(snippet).slice(0, 160)}`
  );
}

/** Both pages carry the season in their <h1>; a mismatch means the site has rolled over. */
function checkHeading(html: string, where: string, league: string, seasonLabel: string) {
  const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  if (!h1.toUpperCase().includes(league.toUpperCase()) || !h1.includes(seasonLabel)) {
    throw new Abort(`${where}: heading is "${h1}", expected ${league} ${seasonLabel} — wrong page or season.`);
  }
}

const TEAM_NAME = /<span style="overflow-wrap:anywhere;[^"]*">([\s\S]*?)<\/span>/g;

/**
 * /results: each played match is a `<div class="match">` row holding the two
 * team names, then full-time and half-time scores as four <div>s, under a
 * "Sat 10 Oct - Round 6" date header.
 */
function parseResults(html: string, where: string): SiteResult[] {
  const out: SiteResult[] = [];
  let round: number | null = null;
  const re = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2} [A-Z][a-z]{2} - Round (\d+)|<div class="match">([\s\S]*?)<\/tr>/g;
  for (const m of html.matchAll(re)) {
    if (m[1]) {
      round = Number(m[1]);
      continue;
    }
    const body = m[2];
    const names = [...body.matchAll(TEAM_NAME)].map((x) => text(x[1]));
    const goals = [...body.matchAll(/<div>\s*(?:<strong>)?\s*(\d+)\s*(?:<\/strong>)?\s*<\/div>/g)].map((x) => Number(x[1]));
    if (round === null || names.length !== 2 || goals.length !== 4) throw markupChanged(where, body);
    out.push({
      round,
      home: names[0],
      away: names[1],
      ft: { home: goals[0], away: goals[1] },
      ht: { home: goals[2], away: goals[3] },
    });
  }
  if (!out.length) throw markupChanged(where, html.slice(0, 400));
  return out;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "Saturday 10 October - Round 6" → round + date. The header has no year, so it
 * comes from the season: July onwards is the start year, January–June the next.
 * The weekday is then checked against the computed date — if they disagree the
 * year guess is wrong and every date on the page would be too.
 */
function parseRoundHeader(h: string, startYear: number, where: string) {
  const m = h.trim().match(/^(\w+day) (\d{1,2}) ([A-Z][a-z]+) - Round (\d+)$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[3]);
  if (month === -1) throw markupChanged(where, h);
  const year = month >= 6 ? startYear : startYear + 1;
  const d = new Date(Date.UTC(year, month, Number(m[2])));
  if (WEEKDAYS[d.getUTCDay()] !== m[1]) {
    throw new Abort(`${where}: "${h}" — ${d.toISOString().slice(0, 10)} is not a ${m[1]}; season year inference is off.`);
  }
  return { round: Number(m[4]), date: d.toISOString().slice(0, 10) };
}

/**
 * /fixtures: the whole season as tables headed "Saturday 10 October - Round 6".
 * The middle cell of each row is the full-time score, a `data-iso` UTC kickoff,
 * or a red "Postp.". Played rows carry no kickoff time.
 */
function parseFixtures(html: string, where: string, startYear: number): SiteFixture[] {
  const out: SiteFixture[] = [];
  let header: { round: number; date: string } | null = null;
  const re = /<th class="tbc">([^<]*)<\/th>|<td class="team-name-cell"[^>]*>([\s\S]*?)<\/td>/g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) {
      header = parseRoundHeader(text(m[1]), startYear, where);
      continue;
    }
    const body = m[2];
    const names = [...body.matchAll(TEAM_NAME)].map((x) => text(x[1]));
    const mid = body.match(/<span style="flex:0 0 20%; text-align:center;">([\s\S]*?)<\/span>\s*<span style="flex:0 0 40%/)?.[1];
    if (!header || names.length !== 2 || mid === undefined) throw markupChanged(where, body);

    let state: SiteState;
    const iso = mid.match(/data-iso="([^"]+)"/)?.[1];
    const score = text(mid).match(/^(\d+)\s*[–-]\s*(\d+)$/);
    if (iso) {
      const t = Date.parse(iso);
      if (Number.isNaN(t)) throw markupChanged(where, body);
      state = { kind: "scheduled", kickoff: new Date(t).toISOString() };
    } else if (score) {
      state = { kind: "played", ft: { home: Number(score[1]), away: Number(score[2]) } };
    } else if (/postp/i.test(text(mid))) {
      state = { kind: "postponed" };
    } else {
      throw markupChanged(where, body);
    }
    out.push({ ...header, home: names[0], away: names[1], state });
  }
  if (!out.length) throw markupChanged(where, html.slice(0, 400));
  return out;
}

/* ----------------------------------------------------------------- teams --- */

async function loadTeams() {
  const parsed = TeamsFile.parse(JSON.parse(await readFile(path.join(DATA, "teams.json"), "utf8")));
  const byKey = new Map<string, Team>();
  for (const t of parsed.teams) {
    for (const key of [t.id, t.name, t.short, ...t.aliases]) byKey.set(key.toLowerCase().trim(), t);
  }
  return { byKey, byId: new Map(parsed.teams.map((t) => [t.id, t])), all: parsed.teams };
}

/** Only ever suggests — the paste into teams.json stays manual so a wrong mapping can't slip through. */
function suggest(raw: string, teams: Team[]) {
  const first = raw.toLowerCase().split(" ")[0];
  const hits = teams.filter((t) => [t.name, ...t.aliases].some((n) => n.toLowerCase().startsWith(first)));
  return hits.length
    ? `    "${raw}"  →  probably an alias of ${hits.map((t) => `"${t.id}"`).join(" or ")}`
    : `    "${raw}"  →  no likely match; new club? add it to teams.json`;
}

/* ------------------------------------------------------------- repo data --- */

interface RawMatch {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  status: "played" | "pending" | "postponed";
  score: Score | null;
  halfTime?: Score | null;
  forecast: { capturedAt: string } | null;
  [key: string]: unknown;
}

interface RawWeek {
  season: string;
  league: LeagueId;
  matchweek: number;
  source: string;
  matches: RawMatch[];
  [key: string]: unknown;
}

interface WeekFile {
  rel: string;
  data: RawWeek;
  changed: boolean;
  created: boolean;
}

const mwFile = (season: string, league: LeagueId, n: number) =>
  `data/${season}/${league}/mw-${String(n).padStart(2, "0")}.json`;

/** Raw JSON (not the zod output) so fields the schema doesn't know survive the rewrite. */
async function loadWeeks(season: string, league: LeagueId): Promise<Map<number, WeekFile>> {
  const dir = path.join(DATA, season, league);
  const weeks = new Map<number, WeekFile>();
  if (!existsSync(dir)) return weeks;
  for (const f of (await readdir(dir)).filter((f) => /^mw-\d{2}\.json$/.test(f)).sort()) {
    const rel = `data/${season}/${league}/${f}`;
    const data = JSON.parse(await readFile(path.join(ROOT, rel), "utf8")) as RawWeek;
    const check = Matchweek.safeParse(data);
    if (!check.success) throw new Abort(`${rel} fails the schema — run \`npm run validate\` and fix it first.`);
    weeks.set(data.matchweek, { rel, data, changed: false, created: false });
  }
  return weeks;
}

const SOURCE_NOTE = "results, half-time scores, kickoff times and fixtures synced from ballprediction.com";
const SOURCE_RE = new RegExp(`(?:; )?${SOURCE_NOTE.replace(/\./g, "\\.")} \\(fetched \\d{4}-\\d{2}-\\d{2}\\)$`);

/** One provenance clause per file, refreshed in place rather than appended every run. */
function stampSource(source: string, today: string) {
  const base = source.replace(SOURCE_RE, "");
  return `${base}${base ? "; " : ""}${SOURCE_NOTE} (fetched ${today})`;
}

/** Re-key so halfTime sits right after score, keeping the files readable. */
function withHalfTime(m: RawMatch, ht: Score): RawMatch {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (k === "halfTime") continue;
    out[k] = v;
    if (k === "score") out.halfTime = ht;
  }
  if (!("halfTime" in out)) out.halfTime = ht;
  return out as RawMatch;
}

/* -------------------------------------------------------------- reconcile --- */

type ChangeKind = "result" | "halfTime" | "kickoff" | "rescheduled" | "postponed" | "added";

interface Change {
  kind: ChangeKind;
  league: LeagueId;
  file: string;
  id: string;
  line: string;
}

interface SiteMatch {
  round: number;
  date: string;
  home: string; // team id
  away: string;
  state: SiteState;
  ht: Score | null;
}

const pair = (home: string, away: string) => `${home}|${away}`;
const fmt = (s: Score) => `${s.home}–${s.away}`;
const day = (iso: string) => iso.slice(0, 10);

interface LeagueRun {
  league: (typeof LEAGUES)[number];
  urls: string[];
  changes: Change[];
  review: string[];
  htCount: number;
}

async function syncLeague(
  league: (typeof LEAGUES)[number],
  season: string,
  startYear: number,
  teams: Awaited<ReturnType<typeof loadTeams>>,
  allIds: Set<string>,
  now: number
): Promise<{ run: LeagueRun; weeks: Map<number, WeekFile> } | { raw: unknown }> {
  const seasonLabel = `${startYear}-${startYear + 1}`;
  const resultsUrl = `${SITE}/${league.page}/results`;
  const fixturesUrl = `${SITE}/${league.page}/fixtures`;

  const resultsHtml = await getPage(resultsUrl, `${league.page}-results.html`);
  checkHeading(resultsHtml, resultsUrl, league.label, seasonLabel);
  const results = parseResults(resultsHtml, resultsUrl);

  const fixturesHtml = await getPage(fixturesUrl, `${league.page}-fixtures.html`);
  checkHeading(fixturesHtml, fixturesUrl, league.label, seasonLabel);
  const fixtures = parseFixtures(fixturesHtml, fixturesUrl, startYear);

  if (RAW) return { raw: { results, fixtures } };

  const review: string[] = [];
  const changes: Change[] = [];
  const name = (id: string) => teams.byId.get(id)?.name ?? id;
  const label = (h: string, a: string) => `${name(h)} v ${name(a)}`;

  // -- resolve names; any unknown aborts the whole run before anything is written
  const unknown = new Set<string>();
  const resolve = (raw: string) => {
    const t = teams.byKey.get(raw.toLowerCase().trim());
    if (!t) unknown.add(raw);
    return t?.id ?? "";
  };
  const res = results.map((r) => ({ ...r, home: resolve(r.home), away: resolve(r.away) }));
  const fix = fixtures.map((f) => ({ ...f, home: resolve(f.home), away: resolve(f.away) }));
  if (unknown.size) {
    throw new Abort(
      `${league.label}: ${unknown.size} unmapped team name(s) — nothing written.\n` +
        `  Add the site's spelling to that club's "aliases" in data/teams.json:\n\n` +
        [...unknown].sort().map((n) => suggest(n, teams.all)).join("\n")
    );
  }

  // -- merge the two pages; a pair the site contradicts itself on is skipped
  const site = new Map<string, SiteMatch>();
  for (const f of fix) {
    const k = pair(f.home, f.away);
    if (site.has(k)) throw new Abort(`${fixturesUrl}: ${label(f.home, f.away)} listed twice.`);
    site.set(k, { ...f, ht: null });
  }
  for (const r of res) {
    const k = pair(r.home, r.away);
    const s = site.get(k);
    if (!s || s.state.kind !== "played" || fmt(s.state.ft) !== fmt(r.ft) || s.round !== r.round) {
      review.push(`${label(r.home, r.away)}: the site's results page (${fmt(r.ft)}, round ${r.round}) and fixtures page disagree — skipped`);
      site.delete(k);
      continue;
    }
    if (r.ht.home > r.ft.home || r.ht.away > r.ft.away) {
      review.push(`${label(r.home, r.away)}: site half-time ${fmt(r.ht)} exceeds full-time ${fmt(r.ft)} — skipped`);
      site.delete(k);
      continue;
    }
    s.ht = r.ht;
  }
  for (const [k, s] of site) {
    if (s.state.kind === "played" && !s.ht) {
      review.push(`${label(s.home, s.away)}: shown as ${fmt(s.state.ft)} on fixtures but missing from results — skipped`);
      site.delete(k);
    }
  }

  // -- repo side
  const weeks = await loadWeeks(season, league.id);
  const repo = new Map<string, { week: WeekFile; index: number }>();
  for (const week of weeks.values()) {
    week.data.matches.forEach((m, index) => repo.set(pair(m.home, m.away), { week, index }));
  }

  // -- the horizon: every round whose median fixture date falls within DAYS,
  //    plus every round we already track (to fill gaps). Using the median means
  //    one match brought forward from a far round doesn't open that whole round.
  const byRound = new Map<number, string[]>();
  for (const s of site.values()) byRound.set(s.round, [...(byRound.get(s.round) ?? []), s.date]);
  const horizon = new Date(now + DAYS * 86_400_000).toISOString().slice(0, 10);
  let frontier = Math.max(0, ...weeks.keys());
  for (const [round, dates] of byRound) {
    const sorted = [...dates].sort();
    if (sorted[Math.floor(sorted.length / 2)] <= horizon) frontier = Math.max(frontier, round);
  }

  const note = (kind: ChangeKind, week: WeekFile, id: string, line: string) => {
    week.changed = true;
    changes.push({ kind, league: league.id, file: week.rel, id, line: `MW${week.data.matchweek} ${line}` });
  };

  /** A kickoff may move only if any forecast still predates it. */
  const kickoffBlocked = (m: RawMatch, kickoff: string) =>
    m.forecast && !(Date.parse(m.forecast.capturedAt) < Date.parse(kickoff))
      ? `${label(m.home, m.away)}: site kickoff ${kickoff} is not after the forecast's capturedAt ${m.forecast.capturedAt} — left at ${m.kickoff}`
      : null;

  let htCount = 0;
  const seen = new Set<string>();
  const ordered = [...site.values()].sort((a, b) => a.round - b.round || a.date.localeCompare(b.date));

  for (const s of ordered) {
    const k = pair(s.home, s.away);
    const hit = repo.get(k);
    seen.add(k);

    if (hit) {
      const { week, index } = hit;
      const m = week.data.matches[index];
      const what = label(m.home, m.away);
      if (week.data.matchweek !== s.round) {
        review.push(`${what}: MW${week.data.matchweek} here, round ${s.round} (${s.date}) on the site — left as is`);
        continue;
      }
      const st = s.state;

      if (st.kind === "played") {
        if (m.status === "played") {
          if (fmt(m.score!) !== fmt(st.ft)) {
            review.push(`${what}: ${fmt(m.score!)} here, ${fmt(st.ft)} on the site — left as is`);
          } else if (!m.halfTime) {
            week.data.matches[index] = withHalfTime(m, s.ht!);
            week.changed = true;
            htCount++;
          } else if (fmt(m.halfTime) !== fmt(s.ht!)) {
            review.push(`${what}: half-time ${fmt(m.halfTime)} here, ${fmt(s.ht!)} on the site — left as is`);
          }
          continue;
        }
        let next: RawMatch = { ...m, status: "played", score: st.ft };
        let moved = "";
        if (day(m.kickoff) !== s.date) {
          // played on a different day than recorded (a postponement caught up with)
          const kickoff = `${s.date}${PLACEHOLDER_TIME}`;
          const blocked = kickoffBlocked(m, kickoff);
          if (blocked) review.push(blocked);
          else {
            next.kickoff = kickoff;
            moved = `, played ${s.date}`;
          }
        }
        next = withHalfTime(next, s.ht!);
        week.data.matches[index] = next;
        note("result", week, m.id, `${name(m.home)} ${fmt(st.ft)} ${name(m.away)} (HT ${fmt(s.ht!)})${moved}`);
      } else if (st.kind === "scheduled") {
        if (m.status === "played") {
          review.push(`${what}: played (${fmt(m.score!)}) here, scheduled ${st.kickoff} on the site — left as is`);
          continue;
        }
        if (m.status === "pending" && m.kickoff === st.kickoff) continue;
        const blocked = kickoffBlocked(m, st.kickoff);
        if (blocked) {
          review.push(blocked);
          continue;
        }
        week.data.matches[index] = { ...m, status: "pending", kickoff: st.kickoff };
        if (m.status === "postponed") note("rescheduled", week, m.id, `${what}: rescheduled to ${st.kickoff}`);
        else note("kickoff", week, m.id, `${what}: kickoff ${m.kickoff} → ${st.kickoff}`);
      } else {
        if (m.status === "played") review.push(`${what}: played here, "Postp." on the site — left as is`);
        else if (m.status === "pending") {
          week.data.matches[index] = { ...m, status: "postponed" };
          note("postponed", week, m.id, `${what}: postponed`);
        }
      }
      continue;
    }

    // -- not in the repo. Same pair reversed in the same round is almost
    //    certainly a home/away mix-up on our side, not a missing fixture.
    const reversed = repo.get(pair(s.away, s.home));
    if (reversed && reversed.week.data.matchweek === s.round) {
      review.push(
        `${label(s.home, s.away)}: round ${s.round} on the site, but MW${s.round} here has ` +
          `${label(s.away, s.home)} (${reversed.week.data.matches[reversed.index].id}) — home/away swapped? not added`
      );
      continue;
    }
    if (s.round > frontier) continue;

    let week = weeks.get(s.round);
    if (!week) {
      week = {
        rel: mwFile(season, league.id, s.round),
        data: {
          season,
          league: league.id,
          matchweek: s.round,
          matchweekDerived: false,
          source: "",
          importedAt: new Date(now).toISOString(),
          matches: [],
        },
        changed: false,
        created: true,
      };
      weeks.set(s.round, week);
    }
    const id = `${season}-${league.idCode}-${String(s.round).padStart(2, "0")}-${s.home}-${s.away}`;
    const clash = week.data.matches.find((m) => [m.home, m.away].some((t) => t === s.home || t === s.away));
    if (allIds.has(id) || clash || week.data.matches.length >= league.teams / 2) {
      review.push(`${label(s.home, s.away)}: can't add to MW${s.round} — ${clash ? `clashes with ${clash.id}` : allIds.has(id) ? `id ${id} already exists` : "round already full"}`);
      continue;
    }
    allIds.add(id);

    const st = s.state;
    const added: RawMatch = {
      id,
      home: s.home,
      away: s.away,
      kickoff: st.kind === "scheduled" ? st.kickoff : `${s.date}${PLACEHOLDER_TIME}`,
      status: st.kind === "scheduled" ? "pending" : st.kind,
      score: st.kind === "played" ? st.ft : null,
      ...(st.kind === "played" ? { halfTime: s.ht! } : {}),
      market: null,
      pool: null,
      forecast: null,
    };
    week.data.matches.push(added);
    repo.set(k, { week, index: week.data.matches.length - 1 });
    const detail =
      st.kind === "played" ? `${fmt(st.ft)} (HT ${fmt(s.ht!)}), ${s.date}` : st.kind === "scheduled" ? st.kickoff : `postponed (${s.date})`;
    note("added", week, id, `${label(s.home, s.away)}: ${detail}`);
  }

  const listed = new Set(fix.map((f) => pair(f.home, f.away)));
  for (const [k, { week, index }] of repo) {
    if (seen.has(k) || listed.has(k)) continue;
    const m = week.data.matches[index];
    review.push(`${label(m.home, m.away)} (MW${week.data.matchweek}): not on the site's fixture list`);
  }

  return { run: { league, urls: [resultsUrl, fixturesUrl], changes, review, htCount }, weeks };
}

/* ---------------------------------------------------------------- report --- */

const HEADINGS: Record<ChangeKind, string> = {
  result: "Results",
  added: "Fixtures added",
  rescheduled: "Rescheduled",
  postponed: "Postponed",
  kickoff: "Kickoff times corrected",
  halfTime: "Half-time scores added",
};

function report(runs: LeagueRun[], today: string, created: string[]) {
  const out: string[] = [`## Results sync — ${today}`, ""];
  out.push(`Source: ${runs.flatMap((r) => r.urls).map((u) => `<${u}>`).join(", ")}`, "");
  for (const run of runs) {
    out.push(`### ${run.league.label}`, "");
    let any = false;
    for (const kind of Object.keys(HEADINGS) as ChangeKind[]) {
      const items = run.changes.filter((c) => c.kind === kind);
      if (!items.length) continue;
      any = true;
      out.push(`**${HEADINGS[kind]} (${items.length})**`, ...items.map((c) => `- ${c.line}`), "");
    }
    if (run.htCount) {
      any = true;
      out.push(`**${HEADINGS.halfTime}:** ${run.htCount} already-played match(es)`, "");
    }
    if (!any) out.push("No changes.", "");
  }
  if (created.length) out.push("**New matchweek files**", ...created.map((f) => `- \`${f}\``), "");

  const review = runs.flatMap((r) => r.review.map((x) => `${r.league.label} — ${x}`));
  out.push(`### Needs a human (${review.length})`, "");
  out.push(...(review.length ? review.map((x) => `- ${x}`) : ["Nothing — the site and the data agree everywhere else."]), "");
  out.push(
    "Forecasts and pool data were not touched. Commentary in `content/` is still yours to write.",
    ""
  );
  return out.join("\n");
}

/* ------------------------------------------------------------------ main --- */

async function main() {
  const seasons = JSON.parse(await readFile(path.join(DATA, "seasons.json"), "utf8")) as {
    seasons: Array<{ id: string; status: string }>;
  };
  const season = seasons.seasons.find((s) => s.status === "current")?.id;
  if (!season) throw new Abort("no current season in data/seasons.json");
  const startYear = Number(season.slice(0, 4));

  const teams = await loadTeams();
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);

  // Every match id in the repo, so an added fixture can never collide with one.
  const allIds = new Set<string>();
  for (const s of seasons.seasons) {
    for (const l of LEAGUES) for (const w of (await loadWeeks(s.id, l.id)).values()) w.data.matches.forEach((m) => allIds.add(m.id));
  }

  const runs: LeagueRun[] = [];
  const weekSets: Array<Map<number, WeekFile>> = [];
  const raw: Record<string, unknown> = {};
  for (const league of LEAGUES) {
    log(`${league.label}: reading ${SITE}/${league.page}/results and /fixtures…\n`);
    const r = await syncLeague(league, season, startYear, teams, allIds, now);
    if ("raw" in r) raw[league.id] = r.raw;
    else {
      runs.push(r.run);
      weekSets.push(r.weeks);
    }
  }

  if (RAW) {
    log(JSON.stringify(raw, null, 2) + "\n");
    return;
  }

  const touched = weekSets.flatMap((w) => [...w.values()]).filter((w) => w.changed);
  const created = touched.filter((w) => w.created).map((w) => w.rel);
  const summary = report(runs, today, created);
  log("\n" + summary);

  if (SUMMARY) await writeFile(path.resolve(SUMMARY), summary);

  if (!touched.length) {
    log("Nothing to write.\n");
    return;
  }
  if (DRY) {
    log(`--dry: ${touched.length} file(s) would change, nothing written.\n`);
    return;
  }

  for (const w of touched) {
    w.data.source = stampSource(w.data.source, today);
    if (w.created) w.data.matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));
    const file = path.join(ROOT, w.rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(w.data, null, 2) + "\n");
  }

  // Provenance: what changed, from which pages, when. The site keeps changing
  // under the same URLs, so this is the record of what it said at the time.
  const logFile = path.join(DATA, "results", `${today}.json`);
  const previous = existsSync(logFile) ? JSON.parse(await readFile(logFile, "utf8")) : { runs: [] };
  previous.runs.push({
    fetchedAt: new Date(now).toISOString(),
    sources: runs.flatMap((r) => r.urls),
    changes: runs.flatMap((r) => r.changes),
    halfTimesAdded: Object.fromEntries(runs.map((r) => [r.league.id, r.htCount])),
    needsReview: runs.flatMap((r) => r.review.map((x) => `${r.league.label} — ${x}`)),
  });
  await mkdir(path.dirname(logFile), { recursive: true });
  await writeFile(logFile, JSON.stringify(previous, null, 2) + "\n");

  log(`Wrote ${touched.length} matchweek file(s) and data/results/${today}.json. Run \`npm run validate\` next.\n`);
}

main().catch((e) => {
  if (e instanceof Abort) {
    process.stderr.write(`\n✗ ${e.message}\n`);
    process.exit(1);
  }
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(1);
});
