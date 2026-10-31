#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — pre-fill a coupon's forecasts from bookmaker odds
 *
 *   npx tsx scripts/fetch-odds.ts 2026-10-17 --dry   print the pre-fill, write nothing
 *   npx tsx scripts/fetch-odds.ts 2026-10-17         write it into the matchweek files
 *
 * Options:
 *   --summary FILE   also write the review table as Markdown, e.g. for a PR comment
 *   --csv FILE       read a saved copy of fixtures.csv instead of downloading it
 *
 * Stage 2 of the coupon pipeline, run on Saturday morning against the draft
 * fetch-vakio.ts wrote. Each coupon match gets a *suggested* forecast on the PR
 * branch; reviewing and adjusting it before kickoff stays by hand.
 *
 *   probs  1X2 odds from football-data.co.uk's fixtures.csv, which carries the
 *          weekend's prices collected on Friday afternoon. Each of BOOKS is
 *          stripped of its margin by the power method, the books are averaged
 *          equally, and the result is rounded to whole percentages.
 *   marks  the 8+0 house rule, steered by Veikkaus pool popularity — see
 *          pickMarks() in scripts/lib/odds.ts.
 *   pool   that popularity, re-read at run time: by Saturday the copy in a
 *          draft fetched midweek is days old.
 *
 * A match that already has a forecast is never touched. One missing from the
 * CSV, without odds, or without a match record is listed under "Needs a human"
 * and left for you; the rest are still written. Nothing at all is written once
 * the coupon has closed, or while none of its matches are in the CSV yet.
 * ------------------------------------------------------------------------- */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Matchweek, TeamsFile, type LeagueId, type Sign, type Team } from "../lib/schema";
import { SIGNS, consensus, devigPower, pickMarks, toPercent, type Triple } from "./lib/odds";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");

const CSV_URL = "https://football-data.co.uk/fixtures.csv";
const POOL_URL = (drawId: string) =>
  `https://www.veikkaus.fi/api/sport-popularity/v1/games/SPORT/draws/${drawId}/popularity`;

/** football-data's division codes for the three leagues the site tracks. */
const DIVISIONS: Record<string, LeagueId> = { E0: "premier-league", E1: "championship", E2: "league-one" };

/**
 * The books averaged into the market probability, by football-data column
 * prefix ({code}H, {code}D, {code}A). Pinnacle would lead this list, but the
 * 2026-27 files carry no Pinnacle columns, so Betfair Exchange — the
 * lowest-margin price in the file — is the sharp anchor.
 */
const BOOKS = [
  { code: "BFE", name: "Betfair Exchange" },
  { code: "B365", name: "Bet365" },
  { code: "PP", name: "Paddy Power" },
  { code: "SKB", name: "Sky Bet" },
  { code: "BW", name: "bwin" },
];

/** validate.ts holds every 13-match coupon to 8+0: five singles, eight doubles. */
const SINGLES = 5;

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const DRY = args.includes("--dry");
const SUMMARY = opt("--summary");
const CSV_FILE = opt("--csv");
const ROUND_ID = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--summary" && args[i - 1] !== "--csv");

const log = (s: string) => process.stdout.write(s);

class Abort extends Error {}

/* ------------------------------------------------------------- repo data --- */

interface Draft {
  id: string;
  name: string;
  veikkaus?: { drawId?: string; closeTime?: string | null; capturedAt?: string };
  fixtures: Array<{
    eventId: number;
    homeRaw: string;
    awayRaw: string;
    home: string | null;
    away: string | null;
    poolPopularity?: Partial<Record<Sign, number>> | null;
  }>;
}

interface RawForecast {
  roundId: string | null;
  probs: Record<Sign, number>;
  marks: Sign[];
  capturedAt: string;
  note?: string;
}

interface RawMatch {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  status: "played" | "pending" | "postponed";
  pool?: unknown;
  forecast: RawForecast | null;
  [key: string]: unknown;
}

interface WeekFile {
  rel: string;
  league: LeagueId;
  data: { matches: RawMatch[]; [key: string]: unknown };
  changed: boolean;
}

/** Raw JSON (not the zod output) so fields the schema doesn't know survive the rewrite. */
async function loadSeason(season: string) {
  const weeks: WeekFile[] = [];
  const byPair = new Map<string, { week: WeekFile; index: number }>();
  for (const league of Object.values(DIVISIONS)) {
    const dir = path.join(DATA, season, league);
    if (!existsSync(dir)) continue;
    for (const f of (await readdir(dir)).filter((f) => /^mw-\d{2}\.json$/.test(f)).sort()) {
      const rel = `data/${season}/${league}/${f}`;
      const data = JSON.parse(await readFile(path.join(ROOT, rel), "utf8")) as WeekFile["data"];
      if (!Matchweek.safeParse(data).success) {
        throw new Abort(`${rel} fails the schema — run \`npm run validate\` and fix it first.`);
      }
      const week: WeekFile = { rel, league, data, changed: false };
      weeks.push(week);
      data.matches.forEach((m, index) => byPair.set(`${m.home}|${m.away}`, { week, index }));
    }
  }
  return { weeks, byPair };
}

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
    ? `"${raw}" is probably an alias of ${hits.map((t) => `"${t.id}"`).join(" or ")}`
    : `"${raw}" has no likely match in teams.json`;
}

/* ------------------------------------------------------------------ odds --- */

interface Csv {
  source: string;
  rows: Array<Record<string, string>>;
  columns: Set<string>;
  lastModified: string | null;
}

async function getCsv(): Promise<Csv> {
  let text: string;
  let lastModified: string | null = null;
  if (CSV_FILE) {
    text = await readFile(path.resolve(CSV_FILE), "utf8");
  } else {
    const res = await fetch(CSV_URL, {
      headers: { Accept: "text/csv", "User-Agent": "strictlane-odds/1.0 (+https://strictlane.com)" },
    });
    if (!res.ok) throw new Abort(`${res.status} ${res.statusText} — ${CSV_URL}`);
    text = await res.text();
    const lm = res.headers.get("last-modified");
    lastModified = lm ? new Date(lm).toISOString() : null;
  }
  const source = CSV_FILE ? path.basename(CSV_FILE) : CSV_URL;

  // football-data has never quoted a field. If it starts to, split(",") would
  // shift every column after the quote, so stop rather than misread prices.
  if (text.includes('"')) throw new Abort(`${source}: fields are now quoted — the reader needs updating. Nothing written.`);
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = (lines[0] ?? "").split(",").map((h) => h.trim());
  for (const col of ["Div", "Date", "HomeTeam", "AwayTeam"]) {
    if (!header.includes(col)) throw new Abort(`${source}: no "${col}" column — the format changed. Nothing written.`);
  }
  const rows = lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((v, i) => [header[i], v.trim()])));
  return { source, rows, columns: new Set(header), lastModified };
}

/** "17/10/2026" (or the older "17/10/26") → "2026-10-17". */
function csvDate(d: string): string | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  return m ? `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2]}-${m[1]}` : null;
}

/** football-data dates are UK dates; kickoffs are stored in UTC. */
const ukDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso)
  );

function bookOdds(row: Record<string, string>, code: string): Triple | null {
  const o = ["H", "D", "A"].map((s) => Number(row[`${code}${s}`]));
  return o.every((x) => Number.isFinite(x) && x > 1) ? (o as Triple) : null;
}

/* ------------------------------------------------------------------ pool --- */

interface PoolReply {
  timestamp?: number;
  resultPopularities?: Array<{ eventId: number; outcomes?: string[]; percentage: number }>;
}

interface Pool {
  /** percent by coupon position, as Veikkaus reports it */
  byEvent: Map<number, Record<Sign, number>>;
  capturedAt: string;
  source: string;
  reply: PoolReply | null;
}

const complete = (p: Partial<Record<Sign, number>> | null | undefined): p is Record<Sign, number> =>
  !!p && SIGNS.every((s) => typeof p[s] === "number");

/**
 * Live popularity first. If Veikkaus doesn't answer, the draft's own copy from
 * when the coupon was fetched is better than nothing — and it is said so.
 */
async function getPool(draft: Draft, draftRel: string): Promise<{ pool: Pool | null; note: string | null }> {
  const drawId = draft.veikkaus?.drawId;
  let failure = "the draft has no draw id";
  if (drawId) {
    try {
      const res = await fetch(POOL_URL(drawId), {
        headers: { Accept: "application/json", "X-ESA-API-Key": "ROBOT" },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const reply = (await res.json()) as PoolReply;
      const parts = new Map<number, Partial<Record<Sign, number>>>();
      for (const r of reply.resultPopularities ?? []) {
        const sign = r.outcomes?.[0] as Sign | undefined;
        if (!sign || !SIGNS.includes(sign)) continue;
        parts.set(r.eventId, { ...parts.get(r.eventId), [sign]: r.percentage / 100 }); // scaled ×100
      }
      const byEvent = new Map([...parts].filter((e): e is [number, Record<Sign, number>] => complete(e[1])));
      if (byEvent.size) {
        const capturedAt = new Date(reply.timestamp ?? Date.now()).toISOString();
        return { pool: { byEvent, capturedAt, source: POOL_URL(drawId), reply }, note: null };
      }
      failure = "the reply listed no popularity";
    } catch (e) {
      failure = (e as Error).message;
    }
  }

  const byEvent = new Map<number, Record<Sign, number>>();
  for (const f of draft.fixtures) if (complete(f.poolPopularity)) byEvent.set(f.eventId, f.poolPopularity);
  const at = draft.veikkaus?.capturedAt;
  if (byEvent.size && at) {
    return {
      pool: { byEvent, capturedAt: at, source: draftRel, reply: null },
      note: `Live pool popularity unavailable (${failure}); used the draft's copy from ${stamp(at)}.`,
    };
  }
  return { pool: null, note: `No pool popularity (${failure}); marks follow the market alone.` };
}

/* ---------------------------------------------------------------- report --- */

interface Line {
  position: number;
  label: string;
  state: "new" | "kept" | "skipped";
  /** the match record this row refers to; written into the comment for apply-review.ts */
  matchId?: string;
  /** exact market fractions, or the kept forecast's */
  p: Triple | null;
  probs: Record<Sign, number> | null;
  pool: Record<Sign, number> | null;
  value: Triple | null;
  marks: Sign[] | null;
  books: string[];
}

/** Match ids indexed by the table's row number (position), blank where a row has none. */
const byRow = (lines: Line[]) => {
  const ids: string[] = Array(Math.max(0, ...lines.map((l) => l.position + 1))).fill("");
  for (const l of lines) ids[l.position] = l.matchId ?? "";
  return ids;
};
const stamp = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const tri = (r: Record<Sign, number>, dp = 0) => SIGNS.map((s) => r[s].toFixed(dp)).join(" / ");

function report(o: {
  draft: Draft;
  csv: Csv;
  books: typeof BOOKS;
  pool: Pool | null;
  lines: Line[];
  notes: string[];
  review: string[];
}) {
  const { draft, csv, books, pool, lines, notes, review } = o;
  const out: string[] = [`## Odds pre-fill — ${draft.name} ${draft.id}`, ""];
  out.push(
    `Odds: ${csv.source.startsWith("http") ? `<${csv.source}>` : `\`${csv.source}\``}` +
      `${csv.lastModified ? ` (uploaded ${stamp(csv.lastModified)})` : ""} — ${books.map((b) => b.name).join(", ")}; ` +
      `each stripped of its margin by the power method, then averaged.`,
    `Pool: ${pool ? `Veikkaus popularity for draw ${draft.veikkaus?.drawId}, ${stamp(pool.capturedAt)}.` : "none."}`,
    ...notes,
    ""
  );

  out.push("| # | Match | Probs 1 / X / 2 | Pool 1 / X / 2 | Value 1 / X / 2 | Marks |", "|---:|---|---|---|---|---|");
  for (const l of lines) {
    const marks = l.marks ? `**${l.marks.join("")}**${l.state === "kept" ? " (kept)" : ""}` : "—";
    out.push(
      `| ${l.position + 1} | ${l.label} | ${l.probs ? tri(l.probs) : "—"} | ${l.pool ? tri(l.pool) : "—"} | ` +
        `${l.value ? l.value.map((v) => v.toFixed(2)).join(" / ") : "—"} | ${marks} |`
    );
  }
  out.push("");

  const marked = lines.filter((l) => l.marks);
  const n = (k: number) => marked.filter((l) => l.marks!.length === k).length;
  const rows = 2 ** n(2) * 3 ** n(3);
  out.push(
    marked.length === lines.length
      ? `System: ${n(1)} singles, ${n(2)} doubles${n(3) ? `, ${n(3)} triples` : ""} → ${rows} rows.`
      : `System so far: ${n(1)} singles, ${n(2)} doubles on ${marked.length} of ${lines.length} matches.`
  );
  if (lines.every((l) => l.p && l.marks)) {
    const all = lines.reduce((acc, l) => acc * l.marks!.reduce((a, s) => a + l.p![SIGNS.indexOf(s)], 0), 1);
    out.push(`Chance every match is covered, by the market's numbers: ${(all * 100).toFixed(1)}%.`);
  }
  out.push(
    "",
    "Probs are the books' margin-free average, rounded; a kept row shows the forecast already on file. " +
      "Value is market ÷ pool: above 1 the crowd underplays the sign. Doubles pair the favourite with the " +
      "better-value other sign; singles go to the safest favourites the pool doesn't overplay.",
    ""
  );

  out.push(`### Needs a human (${review.length})`, "");
  out.push(...(review.length ? review.map((x) => `- ${x}`) : ["Nothing — every coupon match has a forecast."]), "");

  out.push(
    "### Before merging",
    "",
    "- These are suggestions. To change one, **edit this comment**: change the Marks (or Probs) in the table above and save, keeping 5 singles and 8 doubles. " +
      "The Review table workflow writes your edit into the matchweek files, timestamped with the edit, and replies here.",
    "- **Wait for its ✅ reply before merging.** The *Review table* check stays red while the table and the files disagree.",
    "- Editing the matchweek files directly still works; then leave this table alone and set each changed `capturedAt` yourself, before kickoff.",
    ...(review.length
      ? [`- Fill in what's listed above, then \`npx tsx scripts/promote-round.ts ${draft.id}\` and \`npm run validate\`.`]
      : []),
    ""
  );
  // Invisible on GitHub; lets apply-review.ts map each row to its match even
  // before the round is promoted, and survives the comment being edited.
  out.push(`<!-- strictlane:review round=${draft.id} ids=${byRow(lines).join(",")} -->`, "");
  return out.join("\n");
}

/* ------------------------------------------------------------------ main --- */

async function main() {
  if (!ROUND_ID || !/^\d{4}-\d{2}-\d{2}$/.test(ROUND_ID)) {
    throw new Abort("usage: fetch-odds.ts <round-id> [--dry] [--summary FILE] [--csv FILE]");
  }
  const draftRel = `data/rounds/drafts/${ROUND_ID}.json`;
  if (!existsSync(path.join(ROOT, draftRel))) throw new Abort(`no draft at ${draftRel} — fetch the coupon first.`);
  const draft = JSON.parse(await readFile(path.join(ROOT, draftRel), "utf8")) as Draft;

  const now = Date.now();
  const closeTime = draft.veikkaus?.closeTime;
  if (closeTime && now >= Date.parse(closeTime)) {
    const msg = `The coupon closed at ${stamp(closeTime)}; a forecast written now would not be a coupon forecast.`;
    if (!DRY) throw new Abort(`${msg} Nothing written.`);
    log(`⚠ ${msg}\n`);
  }

  const seasons = JSON.parse(await readFile(path.join(DATA, "seasons.json"), "utf8")) as {
    seasons: Array<{ id: string; status: string }>;
  };
  const season = seasons.seasons.find((s) => s.status === "current")?.id;
  if (!season) throw new Abort("no current season in data/seasons.json");

  const teams = await loadTeams();
  const { weeks, byPair } = await loadSeason(season);
  const csv = await getCsv();

  const books = BOOKS.filter((b) => ["H", "D", "A"].every((s) => csv.columns.has(`${b.code}${s}`)));
  if (!books.length) {
    throw new Abort(`${csv.source} carries none of ${BOOKS.map((b) => b.code).join(", ")} — the format changed. Nothing written.`);
  }
  const notes = BOOKS.filter((b) => !books.includes(b)).map(
    (b) => `${csv.source} no longer has ${b.name} (${b.code}) columns; averaged without it.`
  );

  // Index the three leagues' rows by fixture pair. A name teams.json doesn't
  // know only matters if it hides a coupon match, so it's reported then.
  const unknown = new Map<LeagueId, Set<string>>();
  const rowsByPair = new Map<string, Array<Record<string, string>>>();
  for (const row of csv.rows) {
    const league = DIVISIONS[row.Div];
    if (!league) continue;
    const [home, away] = [row.HomeTeam ?? "", row.AwayTeam ?? ""].map((name) => {
      const team = teams.byKey.get(name.toLowerCase().trim());
      if (!team) unknown.set(league, (unknown.get(league) ?? new Set()).add(name));
      return team?.id;
    });
    if (!home || !away) continue;
    rowsByPair.set(`${home}|${away}`, [...(rowsByPair.get(`${home}|${away}`) ?? []), row]);
  }

  const { pool, note: poolNote } = await getPool(draft, draftRel);
  if (poolNote) notes.push(poolNote);

  const short = (id: string | null, raw: string) => (id ? (teams.byId.get(id)?.short ?? raw) : raw);
  const lines: Line[] = [];
  const review: string[] = [];
  const fresh: Array<{ line: Line; match: RawMatch; week: WeekFile; cells: Record<string, string> }> = [];
  const unknownShown = new Set<LeagueId>();
  let keptSingles = 0;
  let lookedUp = 0;
  let inCsv = 0;

  for (const f of draft.fixtures) {
    const label = `${short(f.home, f.homeRaw)} – ${short(f.away, f.awayRaw)}`;
    const popularity = pool?.byEvent.get(f.eventId) ?? null;
    const line: Line = {
      position: f.eventId, label, state: "skipped", p: null, probs: null, pool: popularity, value: null, marks: null, books: [],
    };
    lines.push(line);
    const skip = (why: string) => review.push(`${f.eventId + 1}. ${label}: ${why}`);

    if (!f.home || !f.away) {
      skip("a team isn't mapped in the draft — fix teams.json and the draft.");
      continue;
    }
    const hit = byPair.get(`${f.home}|${f.away}`);
    if (!hit) {
      skip("no match record in the matchweek files — add it (Fetch results does), then run this again.");
      continue;
    }
    const match = hit.week.data.matches[hit.index];
    line.matchId = match.id;

    if (match.forecast) {
      Object.assign(line, {
        state: "kept",
        probs: match.forecast.probs,
        marks: match.forecast.marks,
        p: SIGNS.map((s) => match.forecast!.probs[s] / 100) as Triple,
      });
      if (match.forecast.marks.length === 1) keptSingles++;
      if (match.forecast.roundId !== draft.id) skip(`already forecast for round ${match.forecast.roundId ?? "none"}; left as is.`);
      continue;
    }
    if (match.status !== "pending") {
      skip(`status is "${match.status}"; left for you.`);
      continue;
    }
    if (!(now < Date.parse(match.kickoff))) {
      skip(`kicked off at ${stamp(match.kickoff)}; too late for a forecast.`);
      continue;
    }

    lookedUp++;
    const rows = rowsByPair.get(`${f.home}|${f.away}`) ?? [];
    if (rows.length !== 1) {
      const names = unknown.get(hit.week.league);
      skip(
        rows.length
          ? `listed ${rows.length} times in ${csv.source}; left for you.`
          : `not in ${csv.source}.` +
              (names?.size && !unknownShown.has(hit.week.league)
                ? ` It also lists names teams.json doesn't know — ${[...names].map((n) => suggest(n, teams.all)).join("; ")}.`
                : "")
      );
      if (names?.size) unknownShown.add(hit.week.league);
      continue;
    }
    inCsv++;
    const row = rows[0];
    if (csvDate(row.Date ?? "") !== ukDate(match.kickoff)) {
      skip(`${csv.source} dates it ${row.Date}, the record ${stamp(match.kickoff)}; check for a postponement.`);
      continue;
    }

    const priced = books.flatMap((b) => {
      const odds = bookOdds(row, b.code);
      return odds ? [{ code: b.code, odds }] : [];
    });
    if (!priced.length) {
      skip(`no odds from ${books.map((b) => b.name).join(", ")} yet.`);
      continue;
    }
    const p = consensus(priced.map((b) => devigPower(b.odds)));
    Object.assign(line, { state: "new", p, probs: toPercent(p), books: priced.map((b) => b.code) });
    fresh.push({
      line,
      match,
      week: hit.week,
      cells: Object.fromEntries(Object.entries(row).filter(([, v]) => v !== "")),
    });
  }

  if (lookedUp && !inCsv) {
    throw new Abort(
      `None of the coupon's matches are in ${csv.source}` +
        `${csv.lastModified ? ` (uploaded ${stamp(csv.lastModified)})` : ""}. football-data uploads weekend ` +
        `odds on Friday afternoon — run this again once it has. Nothing written.`
    );
  }

  // Marks for the new forecasts, with the singles any kept forecasts already
  // use taken out of the five.
  const picks = pickMarks(
    fresh.map(({ line }) => {
      const q = line.pool ? (SIGNS.map((s) => line.pool![s]) as Triple) : null;
      const total = q ? q[0] + q[1] + q[2] : 0;
      return { p: line.p!, q: q && total > 0 ? (q.map((x) => x / total) as Triple) : null };
    }),
    SINGLES - keptSingles
  );
  fresh.forEach(({ line }, i) => Object.assign(line, { marks: picks[i].marks, value: line.pool ? picks[i].value : null }));

  const summary = report({ draft, csv, books, pool, lines, notes, review });
  log("\n" + summary);
  if (SUMMARY) await writeFile(path.resolve(SUMMARY), summary);

  if (!fresh.length) {
    log("Nothing to write.\n");
    return;
  }
  if (DRY) {
    log(`--dry: ${fresh.length} forecast(s) would be written, nothing written.\n`);
    return;
  }

  const capturedAt = new Date(now).toISOString();
  const drawId = draft.veikkaus?.drawId;
  for (const { line, match, week } of fresh) {
    if (line.pool && pool && drawId) {
      match.pool = { source: "veikkaus:sport-popularity", drawId, probs: line.pool, capturedAt: pool.capturedAt };
    }
    match.forecast = {
      roundId: draft.id,
      probs: line.probs!,
      marks: line.marks!,
      capturedAt,
      note:
        `pre-filled from football-data.co.uk odds (${line.books.join(", ")}; power method, averaged); ` +
        (line.pool ? "marks steered by Veikkaus pool popularity" : "marks by market alone, no pool popularity"),
    };
    week.changed = true;
  }
  const touched = weeks.filter((w) => w.changed);
  for (const w of touched) await writeFile(path.join(ROOT, w.rel), JSON.stringify(w.data, null, 2) + "\n");

  // Provenance: the odds and popularity behind each run, in the shape they
  // arrived. Neither source keeps old values, so this is the only record.
  const snapRel = `data/rounds/raw/${draft.id}-odds.json`;
  const snapFile = path.join(ROOT, snapRel);
  const previous = existsSync(snapFile) ? JSON.parse(await readFile(snapFile, "utf8")) : { runs: [] };
  previous.runs.push({
    capturedAt,
    odds: {
      source: csv.source,
      lastModified: csv.lastModified,
      books: books.map((b) => b.code),
      rows: fresh.map(({ line, match, cells }) => ({ position: line.position, matchId: match.id, cells })),
    },
    pool: pool ? { source: pool.source, capturedAt: pool.capturedAt, reply: pool.reply } : null,
  });
  await mkdir(path.dirname(snapFile), { recursive: true });
  await writeFile(snapFile, JSON.stringify(previous, null, 2) + "\n");

  log(
    `Wrote ${fresh.length} forecast(s) to ${touched.length} matchweek file(s) and ${snapRel}.\n` +
      `Next: npx tsx scripts/promote-round.ts ${draft.id}, then npm run validate.\n`
  );
}

main().catch((e) => {
  if (e instanceof Abort) {
    process.stderr.write(`\n✗ ${e.message}\n`);
    process.exit(1);
  }
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(1);
});
