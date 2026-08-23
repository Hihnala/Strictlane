#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — archive importer
 *
 * Pulls historical results and closing odds from football-data.co.uk and writes
 * them into data/{season}/{league}/mw-NN.json.
 *
 *   npx tsx scripts/import-archive.ts --seasons 2024-25,2025-26
 *   npx tsx scripts/import-archive.ts --seasons 2025-26 --leagues championship
 *   npx tsx scripts/import-archive.ts --seasons 2024-25 --margin power --dry
 *
 * Two rules this script will not break:
 *
 *   1. forecast is always null for imported matches. We did not forecast these
 *      games. Writing hindsight predictions into the archive would corrupt
 *      every calibration number on the site. (Brand rule 05.)
 *   2. Unknown team names abort the import. It prints a ready-to-paste stub for
 *      data/teams.json rather than guessing at a mapping — a silently wrong
 *      team alias is the kind of error that survives to production.
 * ------------------------------------------------------------------------- */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { deriveMatchweeks, auditRounds } from "./lib/matchweeks.js";
import { pickOdds, toProbs, overround, type MarginMethod, type Triple } from "./lib/odds.js";
import { TeamsFile, type Team, type LeagueId } from "../lib/schema.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");

/** football-data division codes and squad sizes per division. */
const LEAGUES: Record<LeagueId, { div: string; teams: number; label: string }> = {
  "premier-league": { div: "E0", teams: 20, label: "Premier League" },
  championship: { div: "E1", teams: 24, label: "Championship" },
  "league-one": { div: "E2", teams: 24, label: "League One" },
};

/** "2025-26" -> "2526" */
function seasonCode(season: string): string {
  const [a, b] = season.split("-");
  return a.slice(2) + b;
}

/* ------------------------------------------------------------------ CSV --- */

/** Minimal RFC-4180 parser. football-data quotes referee names containing commas. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const header = (rows.shift() ?? []).map((h) => h.replace(/^\uFEFF/, "").trim());
  return rows
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/** dd/mm/yyyy (or dd/mm/yy) + optional HH:MM -> ISO. Kickoffs are UK local. */
function toIso(date: string, time?: string): string {
  const [d, m, yRaw] = date.split("/");
  if (!d || !m || !yRaw) throw new Error(`unparseable date: "${date}"`);
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  const hhmm = /^\d{1,2}:\d{2}$/.test(time ?? "") ? time! : "15:00";
  const [hh, mm] = hhmm.split(":");
  // Recorded as UTC. Football-data publishes UK local time without a zone, so
  // this is off by an hour during BST. It never affects a matchweek assignment
  // or a result; if you later need exact kickoffs, resolve the zone here.
  return new Date(
    Date.UTC(+y, +m - 1, +d, +hh.padStart(2, "0"), +mm)
  ).toISOString();
}

/* ---------------------------------------------------------------- teams --- */

async function loadTeams(): Promise<Map<string, Team>> {
  const file = path.join(DATA, "teams.json");
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  const parsed = TeamsFile.parse(JSON.parse(await readFile(file, "utf8")));

  const index = new Map<string, Team>();
  const add = (key: string, t: Team) => {
    const k = key.toLowerCase().trim();
    const existing = index.get(k);
    if (existing && existing.id !== t.id) {
      throw new Error(`alias "${key}" maps to both ${existing.id} and ${t.id}`);
    }
    index.set(k, t);
  };
  for (const t of parsed.teams) {
    add(t.id, t); add(t.name, t); add(t.short, t);
    for (const a of t.aliases) add(a, t);
  }
  return index;
}

function slug(name: string) {
  return name.toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* --------------------------------------------------------------- import --- */

interface Opts {
  seasons: string[];
  leagues: LeagueId[];
  margin: MarginMethod;
  dry: boolean;
}

async function importOne(season: string, league: LeagueId, teams: Map<string, Team>, opts: Opts) {
  const cfg = LEAGUES[league];
  const url = `https://www.football-data.co.uk/mmz4281/${seasonCode(season)}/${cfg.div}.csv`;
  process.stdout.write(`\n${season} · ${cfg.label}\n  ${url}\n`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`  fetch failed: ${res.status} ${res.statusText}`);
  const rows = parseCsv(await res.text()).filter((r) => r.HomeTeam && r.AwayTeam && r.Date);
  process.stdout.write(`  ${rows.length} rows\n`);

  // Resolve every team name before writing anything.
  const unknown = new Set<string>();
  const resolve = (name: string) => {
    const t = teams.get(name.toLowerCase().trim());
    if (!t) unknown.add(name);
    return t;
  };
  for (const r of rows) { resolve(r.HomeTeam); resolve(r.AwayTeam); }
  if (unknown.size) {
    const stub = [...unknown].sort().map(
      (n) => `    { "id": "${slug(n)}", "name": "${n}", "short": "${n.slice(0, 12)}", "aliases": ["${n}"] }`
    );
    throw new Error(
      `  ${unknown.size} unknown team name(s) in ${cfg.label} ${season}.\n` +
        `  Nothing written. Add these to data/teams.json (fix name/short by hand):\n\n` +
        stub.join(",\n") + "\n"
    );
  }

  const prepared = rows.map((r) => {
    const home = resolve(r.HomeTeam)!;
    const away = resolve(r.AwayTeam)!;
    const kickoff = toIso(r.Date, r.Time);
    const picked = pickOdds(r);
    const hasScore = r.FTHG !== "" && r.FTAG !== "";
    return {
      home: home.id,
      away: away.id,
      date: Date.parse(kickoff),
      kickoff,
      score: hasScore ? { home: Number(r.FTHG), away: Number(r.FTAG) } : null,
      market: picked
        ? {
            source: picked.source,
            method: opts.margin,
            overround: Number(overround(picked.odds as Triple).toFixed(4)),
            probs: toProbs(picked.odds as Triple, opts.margin),
            capturedAt: kickoff, // football-data publishes no odds timestamp
          }
        : null,
    };
  });

  const assigned = deriveMatchweeks(prepared, cfg.teams);
  const audit = auditRounds(assigned, cfg.teams);
  process.stdout.write(
    `  ${audit.rounds}/${audit.expectedRounds} matchweeks · ` +
      `${prepared.filter((p) => p.market).length}/${prepared.length} with odds\n`
  );
  if (audit.incompleteRounds.length) {
    process.stdout.write(
      `  note: ${audit.incompleteRounds.length} incomplete matchweek(s) — ` +
        `expected mid-season, wrong if the season is finished\n`
    );
  }

  // Group and write.
  const byWeek = new Map<number, typeof assigned>();
  for (const a of assigned) {
    if (!byWeek.has(a.matchweek)) byWeek.set(a.matchweek, []);
    byWeek.get(a.matchweek)!.push(a);
  }

  const dir = path.join(DATA, season, league);
  if (!opts.dry) await mkdir(dir, { recursive: true });

  for (const [mw, group] of [...byWeek].sort((a, b) => a[0] - b[0])) {
    const nn = String(mw).padStart(2, "0");
    const file = {
      season,
      league,
      matchweek: mw,
      matchweekDerived: true,
      source: `football-data.co.uk/${seasonCode(season)}/${cfg.div}.csv`,
      importedAt: new Date().toISOString(),
      matches: group
        .sort((a, b) => a.match.date - b.match.date)
        .map(({ match: m }) => ({
          id: `${season}-${cfg.div.toLowerCase()}-${nn}-${m.home}-${m.away}`,
          home: m.home,
          away: m.away,
          kickoff: m.kickoff,
          status: m.score ? "played" : "pending",
          score: m.score,
          market: m.market,
          forecast: null, // never backfilled — see header
        })),
    };
    if (!opts.dry) {
      await writeFile(path.join(dir, `mw-${nn}.json`), JSON.stringify(file, null, 2) + "\n");
    }
  }
  process.stdout.write(`  ${opts.dry ? "would write" : "wrote"} ${byWeek.size} files -> data/${season}/${league}/\n`);
}

/* ------------------------------------------------------------------ cli --- */

function parseArgs(argv: string[]): Opts {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const seasons = (get("--seasons") ?? "2024-25,2025-26").split(",").map((s) => s.trim());
  const leagues = (get("--leagues") ?? Object.keys(LEAGUES).join(","))
    .split(",")
    .map((s) => s.trim()) as LeagueId[];
  const margin = (get("--margin") ?? "proportional") as MarginMethod;

  for (const s of seasons) if (!/^\d{4}-\d{2}$/.test(s)) throw new Error(`bad season "${s}", expected e.g. 2025-26`);
  for (const l of leagues) if (!(l in LEAGUES)) throw new Error(`unknown league "${l}"`);
  if (margin !== "proportional" && margin !== "power") throw new Error(`--margin must be proportional or power`);

  return { seasons, leagues, margin, dry: argv.includes("--dry") };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  process.stdout.write(
    `strictlane archive import\n` +
      `  seasons: ${opts.seasons.join(", ")}\n` +
      `  leagues: ${opts.leagues.join(", ")}\n` +
      `  margin:  ${opts.margin}${opts.dry ? "\n  DRY RUN — nothing will be written" : ""}\n`
  );

  const teams = await loadTeams();
  let failed = 0;

  for (const season of opts.seasons) {
    for (const league of opts.leagues) {
      try {
        await importOne(season, league, teams, opts);
      } catch (err) {
        failed++;
        process.stderr.write(`\n${(err as Error).message}\n`);
      }
      await new Promise((r) => setTimeout(r, 1500)); // be polite to the host
    }
  }

  process.stdout.write(`\ndone${failed ? ` — ${failed} import(s) failed, see above` : ""}\n`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(1);
});
