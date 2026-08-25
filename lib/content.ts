import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import {
  Matchweek,
  Round,
  TeamsFile,
  type Match,
  type LeagueId,
  type Team,
} from "./schema";

/* ---------------------------------------------------------------------------
 * Reading the data layer.
 *
 * JSON is the source of truth for matches; Markdown carries commentary. They
 * are joined by path convention, never by an id inside the prose:
 *
 *   data/2026-27/championship/mw-02.json
 *   content/2026-27/championship/mw-02.md
 *
 * Everything runs at build time in server components, so the cache below is a
 * build-duration memo rather than a runtime concern.
 * ------------------------------------------------------------------------- */

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const CONTENT = path.join(ROOT, "content");

const cache = new Map<string, unknown>();
async function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, await fn());
  return cache.get(key) as T;
}

export const LEAGUES: Array<{ id: LeagueId; label: string; short: string; teams: number }> = [
  { id: "premier-league", label: "Premier League", short: "PL", teams: 20 },
  { id: "championship", label: "Championship", short: "Champ", teams: 24 },
  { id: "league-one", label: "League One", short: "L1", teams: 24 },
];

export function leagueMeta(id: LeagueId) {
  const l = LEAGUES.find((x) => x.id === id);
  if (!l) throw new Error(`unknown league "${id}"`);
  return l;
}

/* --------------------------------------------------------------- seasons --- */

export interface Season {
  id: string;
  label: string;
  status: "current" | "archive";
}

export async function getSeasons(): Promise<Season[]> {
  return memo("seasons", async () => {
    const raw = JSON.parse(await readFile(path.join(DATA, "seasons.json"), "utf8"));
    return raw.seasons as Season[];
  });
}

export async function currentSeason(): Promise<Season> {
  const s = await getSeasons();
  const cur = s.find((x) => x.status === "current");
  if (!cur) throw new Error("no season marked current in seasons.json");
  return cur;
}

/* ----------------------------------------------------------------- teams --- */

export async function getTeams(): Promise<Map<string, Team>> {
  return memo("teams", async () => {
    const parsed = TeamsFile.parse(JSON.parse(await readFile(path.join(DATA, "teams.json"), "utf8")));
    return new Map(parsed.teams.map((t) => [t.id, t]));
  });
}

/* ------------------------------------------------------------ matchweeks --- */

export async function listMatchweeks(season: string, league: LeagueId): Promise<number[]> {
  return memo(`mws:${season}:${league}`, async () => {
    const dir = path.join(DATA, season, league);
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    return files
      .filter((f) => /^mw-\d{2}\.json$/.test(f))
      .map((f) => Number(f.slice(3, 5)))
      .sort((a, b) => a - b);
  });
}

export async function getMatchweek(season: string, league: LeagueId, mw: number) {
  return memo(`mw:${season}:${league}:${mw}`, async () => {
    const file = path.join(DATA, season, league, `mw-${String(mw).padStart(2, "0")}.json`);
    if (!existsSync(file)) return null;
    return Matchweek.parse(JSON.parse(await readFile(file, "utf8")));
  });
}

/** Every match in a season/league, flattened. */
export async function getSeasonMatches(season: string, league: LeagueId): Promise<Match[]> {
  const weeks = await listMatchweeks(season, league);
  const out: Match[] = [];
  for (const w of weeks) {
    const mw = await getMatchweek(season, league, w);
    if (mw) out.push(...mw.matches);
  }
  return out;
}

/** The highest matchweek that has at least one played match. */
export async function latestPlayedMatchweek(season: string, league: LeagueId): Promise<number | null> {
  const weeks = await listMatchweeks(season, league);
  for (let i = weeks.length - 1; i >= 0; i--) {
    const mw = await getMatchweek(season, league, weeks[i]);
    if (mw?.matches.some((m) => m.status === "played")) return weeks[i];
  }
  return weeks[0] ?? null;
}

/* ------------------------------------------------------------ commentary --- */

export interface Commentary {
  html: string;
  title?: string;
  summary?: string;
}

export async function getCommentary(
  season: string,
  league: LeagueId,
  mw: number
): Promise<Commentary | null> {
  const file = path.join(CONTENT, season, league, `mw-${String(mw).padStart(2, "0")}.md`);
  if (!existsSync(file)) return null;
  const { data, content } = matter(await readFile(file, "utf8"));
  return {
    html: await marked.parse(content),
    title: typeof data.title === "string" ? data.title : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
  };
}

/* ---------------------------------------------------------------- rounds --- */

export async function listRounds(): Promise<string[]> {
  return memo("rounds", async () => {
    const dir = path.join(DATA, "rounds");
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
      .reverse(); // newest first
  });
}

export async function getRound(id: string) {
  const file = path.join(DATA, "rounds", `${id}.json`);
  if (!existsSync(file)) return null;
  return Round.parse(JSON.parse(await readFile(file, "utf8")));
}

/** Resolve a round's coupon into matches, preserving coupon order. */
export async function getRoundMatches(
  id: string
): Promise<Array<{ match: Match; season: string; league: LeagueId; matchweek: number }>> {
  const round = await getRound(id);
  if (!round) return [];
  const index = await matchIndex();
  const out: Array<{ match: Match; season: string; league: LeagueId; matchweek: number }> = [];
  for (const mid of round.matchIds) {
    const found = index.get(mid);
    if (found) out.push(found);
  }
  return out;
}

export async function getRoundCommentary(id: string): Promise<Commentary | null> {
  const file = path.join(CONTENT, "rounds", `${id}.md`);
  if (!existsSync(file)) return null;
  const { data, content } = matter(await readFile(file, "utf8"));
  return {
    html: await marked.parse(content),
    title: typeof data.title === "string" ? data.title : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
  };
}

/**
 * Every round with its matches and status, newest first.
 *
 * "settled" means every match has a result. A round stays "open" until the last
 * one kicks off, and "partial" in between — which matters because the home page
 * must keep showing the last settled round even while a new coupon is live.
 * Otherwise the moment a coupon is fetched, the reviewable one disappears.
 */
export interface RoundSummary {
  id: string;
  round: Round;
  located: Array<{ match: Match; season: string; league: LeagueId; matchweek: number }>;
  status: "open" | "partial" | "settled";
  played: number;
  total: number;
}

export async function getRoundSummaries(): Promise<RoundSummary[]> {
  const ids = await listRounds();
  const out: RoundSummary[] = [];
  for (const id of ids) {
    const round = await getRound(id);
    if (!round) continue;
    const located = await getRoundMatches(id);
    const played = located.filter((l) => l.match.status === "played").length;
    const total = located.length;
    out.push({
      id,
      round,
      located,
      played,
      total,
      status: played === 0 ? "open" : played === total ? "settled" : "partial",
    });
  }
  return out; // listRounds() already sorts newest first
}

/** The newest round with every match played — the one worth reviewing. */
export async function latestSettledRound(): Promise<RoundSummary | null> {
  const all = await getRoundSummaries();
  return all.find((r) => r.status === "settled") ?? null;
}

/** The newest round still awaiting results, if one is live. */
export async function openRound(): Promise<RoundSummary | null> {
  const all = await getRoundSummaries();
  return all.find((r) => r.status === "open" || r.status === "partial") ?? null;
}

/** Neighbours for prev/next links on a round page. */
export async function roundNeighbours(id: string) {
  const ids = await listRounds(); // newest first
  const i = ids.indexOf(id);
  if (i === -1) return { newer: null, older: null };
  return { newer: ids[i - 1] ?? null, older: ids[i + 1] ?? null };
}

/* ----------------------------------------------------------- match index --- */

type Located = { match: Match; season: string; league: LeagueId; matchweek: number };

/** id -> match, built once per build. Rounds cut across leagues, so they need it. */
export async function matchIndex(): Promise<Map<string, Located>> {
  return memo("index", async () => {
    const index = new Map<string, Located>();
    for (const season of await getSeasons()) {
      for (const { id: league } of LEAGUES) {
        for (const w of await listMatchweeks(season.id, league)) {
          const mw = await getMatchweek(season.id, league, w);
          if (!mw) continue;
          for (const m of mw.matches) {
            index.set(m.id, { match: m, season: season.id, league, matchweek: w });
          }
        }
      }
    }
    return index;
  });
}

/** All forecast matches in a season, across leagues — for the calibration page. */
export async function getForecastMatches(season: string): Promise<Match[]> {
  const out: Match[] = [];
  for (const { id: league } of LEAGUES) {
    const ms = await getSeasonMatches(season, league);
    out.push(...ms.filter((m) => m.forecast));
  }
  return out;
}
