#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — data validator
 *
 *   npm run validate          fails the build on any error
 *   npm run validate -- --warn-only
 *
 * Runs in prebuild and in CI. The point is to make the project's editorial
 * rules mechanical rather than a matter of discipline — in particular:
 *
 *   "Never backfill a prediction" becomes a build failure, because a forecast
 *   whose capturedAt is after kickoff cannot be honest.
 *
 * Errors block. Warnings are things that are legitimate mid-season (an
 * incomplete matchweek) but wrong once a season is closed.
 * ------------------------------------------------------------------------- */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  Matchweek,
  Round,
  TeamsFile,
  type Match,
  type LeagueId,
} from "../lib/schema";
import { resultSign } from "../lib/scoring";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");

const TEAMS_PER_LEAGUE: Record<LeagueId, number> = {
  "premier-league": 20,
  championship: 24,
  "league-one": 24,
};

interface Issue {
  level: "error" | "warn";
  where: string;
  msg: string;
}
const issues: Issue[] = [];
const err = (where: string, msg: string) => issues.push({ level: "error", where, msg });
const warn = (where: string, msg: string) => issues.push({ level: "warn", where, msg });

interface SeasonsFile {
  seasons: Array<{ id: string; label: string; status: "current" | "archive" }>;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function listDirs(dir: string) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function main() {
  const warnOnly = process.argv.includes("--warn-only");

  /* ----------------------------------------------------------- teams --- */
  const teamsRaw = await readJson<unknown>(path.join(DATA, "teams.json"));
  const teamsParsed = TeamsFile.safeParse(teamsRaw);
  if (!teamsParsed.success) {
    err("data/teams.json", teamsParsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return report(warnOnly);
  }
  const teamIds = new Set(teamsParsed.data.teams.map((t) => t.id));
  const seenIds = new Set<string>();
  for (const t of teamsParsed.data.teams) {
    if (seenIds.has(t.id)) err("data/teams.json", `duplicate team id "${t.id}"`);
    seenIds.add(t.id);
    if (t.short.length > 12) warn("data/teams.json", `"${t.short}" is ${t.short.length} chars — may wrap on narrow phones`);
  }

  /* --------------------------------------------------------- seasons --- */
  const seasonsFile = path.join(DATA, "seasons.json");
  if (!existsSync(seasonsFile)) {
    err("data/seasons.json", "missing — the validator needs it to know which seasons are archive");
    return report(warnOnly);
  }
  const seasons = await readJson<SeasonsFile>(seasonsFile);
  const archiveSeasons = new Set(seasons.seasons.filter((s) => s.status === "archive").map((s) => s.id));
  const knownSeasons = new Set(seasons.seasons.map((s) => s.id));
  if (seasons.seasons.filter((s) => s.status === "current").length !== 1) {
    err("data/seasons.json", "exactly one season must have status \"current\"");
  }

  /* ------------------------------------------------------ matchweeks --- */
  const allMatches: Array<{ m: Match; where: string; season: string; league: LeagueId }> = [];
  const matchIds = new Map<string, string>();

  for (const season of await listDirs(DATA)) {
    if (!/^\d{4}-\d{2}$/.test(season)) continue;
    if (!knownSeasons.has(season)) err(`data/${season}`, `season not declared in seasons.json`);

    for (const league of await listDirs(path.join(DATA, season))) {
      if (!(league in TEAMS_PER_LEAGUE)) {
        err(`data/${season}/${league}`, `unknown league directory`);
        continue;
      }
      const lid = league as LeagueId;
      const dir = path.join(DATA, season, league);
      const files = (await readdir(dir)).filter((f) => /^mw-\d{2}\.json$/.test(f)).sort();
      const seenWeeks = new Set<number>();

      for (const f of files) {
        const where = `data/${season}/${league}/${f}`;
        const parsed = Matchweek.safeParse(await readJson<unknown>(path.join(dir, f)));
        if (!parsed.success) {
          for (const i of parsed.error.issues) err(where, `${i.path.join(".")}: ${i.message}`);
          continue;
        }
        const mw = parsed.data;

        // -- file/content agreement
        const nn = Number(f.slice(3, 5));
        if (nn !== mw.matchweek) err(where, `filename says mw ${nn}, content says ${mw.matchweek}`);
        if (mw.season !== season) err(where, `season field "${mw.season}" ≠ directory "${season}"`);
        if (mw.league !== lid) err(where, `league field "${mw.league}" ≠ directory "${league}"`);
        if (seenWeeks.has(mw.matchweek)) err(where, `duplicate matchweek ${mw.matchweek}`);
        seenWeeks.add(mw.matchweek);

        // -- round shape
        const expected = TEAMS_PER_LEAGUE[lid] / 2;
        if (mw.matches.length > expected) {
          err(where, `${mw.matches.length} matches, but a ${TEAMS_PER_LEAGUE[lid]}-team round holds ${expected}`);
        } else if (mw.matches.length < expected) {
          warn(where, `${mw.matches.length}/${expected} matches — fine mid-season, wrong once the round is complete`);
        }

        // -- a team plays at most once per matchweek
        const appearances = new Map<string, number>();
        for (const m of mw.matches) {
          for (const t of [m.home, m.away]) appearances.set(t, (appearances.get(t) ?? 0) + 1);
        }
        for (const [t, n] of appearances) {
          if (n > 1) err(where, `${t} appears ${n}× in matchweek ${mw.matchweek}`);
        }

        for (const m of mw.matches) {
          const at = `${where} · ${m.id}`;

          // -- referential integrity
          if (!teamIds.has(m.home)) err(at, `unknown team id "${m.home}"`);
          if (!teamIds.has(m.away)) err(at, `unknown team id "${m.away}"`);

          if (matchIds.has(m.id)) err(at, `duplicate match id, also in ${matchIds.get(m.id)}`);
          matchIds.set(m.id, where);

          // -- THE RULE: a forecast must predate kickoff
          if (m.forecast) {
            const captured = Date.parse(m.forecast.capturedAt);
            const kickoff = Date.parse(m.kickoff);
            if (!(captured < kickoff)) {
              err(
                at,
                `forecast capturedAt (${m.forecast.capturedAt}) is not before kickoff ` +
                  `(${m.kickoff}) — predictions are never backfilled`
              );
            }
            // marks must be a set
            if (new Set(m.forecast.marks).size !== m.forecast.marks.length) {
              err(at, `duplicate signs in marks [${m.forecast.marks.join(",")}]`);
            }
            // a three-sign mark is always right and tells us nothing
            if (m.forecast.marks.length === 3) {
              warn(at, `all three signs marked — guaranteed hit, carries no information`);
            }
          }

          // -- archive seasons carry no forecasts
          if (archiveSeasons.has(season) && m.forecast) {
            err(at, `archive season has a forecast — hindsight predictions corrupt calibration`);
          }

          // -- results
          const r = resultSign(m);
          if (m.status === "played" && !r) err(at, `status "played" but no derivable result`);
          if (m.status === "pending" && Date.parse(m.kickoff) < Date.now() - 6 * 3600_000) {
            warn(at, `still "pending" more than 6h after kickoff — needs a score or "postponed"`);
          }

          allMatches.push({ m, where: at, season, league: lid });
        }
      }

      // -- no duplicated fixture within a season
      const fixtures = new Map<string, string>();
      for (const { m, where: at, season: s, league: l } of allMatches) {
        if (s !== season || l !== lid) continue;
        const key = `${m.home}|${m.away}`;
        if (fixtures.has(key)) err(at, `fixture ${key} already appears in ${fixtures.get(key)}`);
        fixtures.set(key, at);
      }
    }
  }

  /* ---------------------------------------------------------- rounds --- */
  const roundsDir = path.join(DATA, "rounds");
  if (existsSync(roundsDir)) {
    for (const f of (await readdir(roundsDir)).filter((f) => f.endsWith(".json"))) {
      const where = `data/rounds/${f}`;
      const parsed = Round.safeParse(await readJson<unknown>(path.join(roundsDir, f)));
      if (!parsed.success) {
        for (const i of parsed.error.issues) err(where, `${i.path.join(".")}: ${i.message}`);
        continue;
      }
      const round = parsed.data;

      if (new Set(round.matchIds).size !== round.matchIds.length) err(where, `duplicate match ids in coupon`);

      for (const id of round.matchIds) {
        if (!matchIds.has(id)) err(where, `match id "${id}" does not resolve to any matchweek file`);
      }

      // every listed match must point back at this round
      for (const id of round.matchIds) {
        const found = allMatches.find((a) => a.m.id === id);
        if (found && found.m.forecast?.roundId !== round.id) {
          err(where, `${id} is in this coupon but its forecast.roundId is "${found.m.forecast?.roundId ?? "null"}"`);
        }
        if (found && !found.m.forecast) err(where, `${id} is in this coupon but has no forecast`);
      }

      // Standing house rule: every coupon is played as 8+0 — five singles,
      // eight doubles, no triples. Fixed deliberately so that round-to-round
      // scoring compares like with like; a coupon whose shape moves with the
      // fixtures makes the season log harder to read, not easier.
      if (round.system) {
        const { singles: sg, doubles: db, triples: tp } = round.system;
        if (round.matchIds.length === 13 && (sg !== 5 || db !== 8 || tp !== 0)) {
          err(
            where,
            `system is ${sg} singles / ${db} doubles / ${tp} triples — the standing ` +
              `rule is 8+0 (5 singles, 8 doubles, 0 triples) on a 13-match coupon`
          );
        }
      }

      // system arithmetic must match the stated row count
      if (round.system) {
        const { singles, doubles, triples, rows, type } = round.system;
        const covered = singles + doubles + triples;
        if (covered !== round.matchIds.length) {
          err(where, `system covers ${covered} matches but the coupon has ${round.matchIds.length}`);
        }
        const computed = Math.pow(2, doubles) * Math.pow(3, triples);
        if (computed !== rows) {
          err(where, `system "${type}" implies ${computed} rows (2^${doubles} · 3^${triples}), file says ${rows}`);
        }
        // marks on the matches must agree with the declared system
        const marks = round.matchIds
          .map((id) => allMatches.find((a) => a.m.id === id)?.m.forecast?.marks.length)
          .filter((n): n is number => typeof n === "number");
        const actual = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
        for (const n of marks) actual[n] = (actual[n] ?? 0) + 1;
        if (marks.length === round.matchIds.length) {
          if (actual[1] !== singles) err(where, `system says ${singles} singles, marks show ${actual[1] ?? 0}`);
          if (actual[2] !== doubles) err(where, `system says ${doubles} doubles, marks show ${actual[2] ?? 0}`);
          if ((actual[3] ?? 0) !== triples) err(where, `system says ${triples} triples, marks show ${actual[3] ?? 0}`);
        }
      }
    }
  }

  report(warnOnly);
}

function report(warnOnly: boolean) {
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");

  for (const i of warns) process.stdout.write(`  warn   ${i.where}\n         ${i.msg}\n`);
  for (const i of errors) process.stderr.write(`  ERROR  ${i.where}\n         ${i.msg}\n`);

  const summary = `\n${errors.length} error(s), ${warns.length} warning(s)\n`;
  process.stdout.write(summary);

  if (errors.length && !warnOnly) process.exit(1);
}

main().catch((e) => {
  process.stderr.write(`${e.stack ?? e}\n`);
  process.exit(1);
});
