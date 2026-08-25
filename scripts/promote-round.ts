#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — promote a fetched coupon draft into a real round
 *
 *   npx tsx scripts/promote-round.ts 2026-08-29
 *   npx tsx scripts/promote-round.ts 2026-08-29 --dry
 *
 * A draft from fetch-vakio.ts holds the coupon's fixtures. It is not a round
 * yet: the matches have to exist in the matchweek files, and each one needs a
 * forecast written before kickoff. This script joins the two and refuses when
 * either half is missing.
 *
 * It derives the system block from the marks rather than taking it on trust —
 * count the doubles and triples, compute the rows. A system that disagrees with
 * its own coupon is then impossible rather than merely caught later.
 * ------------------------------------------------------------------------- */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Matchweek, type Match } from "../lib/schema";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");

interface Draft {
  id: string;
  name: string;
  sourceUrl?: string;
  veikkaus?: { drawId?: string; closeTime?: string | null; capturedAt?: string };
  fixtures: Array<{ eventId: number; homeRaw: string; awayRaw: string; home: string | null; away: string | null }>;
}

type Located = { match: Match; season: string; league: string; matchweek: number };

/** Scan every matchweek file once. Rounds cut across leagues, so we need all of them. */
async function scanMatches(): Promise<Located[]> {
  const out: Located[] = [];
  const seasons = (await readdir(DATA, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name))
    .map((e) => e.name);

  for (const season of seasons) {
    const leagues = (await readdir(path.join(DATA, season), { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const league of leagues) {
      const dir = path.join(DATA, season, league);
      for (const f of (await readdir(dir)).filter((f) => /^mw-\d{2}\.json$/.test(f))) {
        const mw = Matchweek.parse(JSON.parse(await readFile(path.join(dir, f), "utf8")));
        for (const m of mw.matches) out.push({ match: m, season, league, matchweek: mw.matchweek });
      }
    }
  }
  return out;
}

async function main() {
  const [id, ...rest] = process.argv.slice(2);
  const dry = rest.includes("--dry");
  if (!id) throw new Error("usage: promote-round.ts <round-id> [--dry]");

  const draftFile = path.join(DATA, "rounds", "drafts", `${id}.json`);
  if (!existsSync(draftFile)) throw new Error(`no draft at data/rounds/drafts/${id}.json`);
  const draft: Draft = JSON.parse(await readFile(draftFile, "utf8"));

  const all = await scanMatches();
  process.stdout.write(`Promoting ${id} — ${draft.fixtures.length} fixtures, ${all.length} matches on file\n\n`);

  const resolved: Located[] = [];
  const missingMatch: string[] = [];
  const missingForecast: string[] = [];

  for (const f of draft.fixtures) {
    if (!f.home || !f.away) {
      missingMatch.push(`${f.homeRaw} – ${f.awayRaw}  (team not mapped in teams.json)`);
      continue;
    }
    // Match on the fixture pair. A given pairing occurs once per season per
    // direction, so this is unambiguous without needing dates.
    const hits = all.filter((l) => l.match.home === f.home && l.match.away === f.away);
    if (hits.length === 0) {
      missingMatch.push(`${f.home} v ${f.away}  (no match record — add it to the matchweek file)`);
      continue;
    }
    if (hits.length > 1) {
      throw new Error(
        `${f.home} v ${f.away} resolves to ${hits.length} matches: ${hits.map((h) => h.match.id).join(", ")}`
      );
    }
    const hit = hits[0];
    if (!hit.match.forecast) missingForecast.push(`${hit.match.id}`);
    resolved.push(hit);
  }

  for (const l of resolved) {
    const fc = l.match.forecast;
    process.stdout.write(
      `  ${l.match.id.padEnd(44)} ${fc ? fc.marks.join("").padEnd(3) : "—  "} ` +
        `${fc ? `${fc.probs["1"]}/${fc.probs.X}/${fc.probs["2"]}` : "no forecast"}\n`
    );
  }

  if (missingMatch.length || missingForecast.length) {
    process.stdout.write("\n");
    if (missingMatch.length) {
      process.stdout.write(`${missingMatch.length} fixture(s) have no match record:\n`);
      for (const m of missingMatch) process.stdout.write(`  ${m}\n`);
    }
    if (missingForecast.length) {
      process.stdout.write(`\n${missingForecast.length} match(es) have no forecast:\n`);
      for (const m of missingForecast) process.stdout.write(`  ${m}\n`);
      process.stdout.write(
        `\nWrite them into the matchweek files with capturedAt before kickoff.\n` +
          `A forecast added after kickoff fails the build, by design.\n`
      );
    }
    throw new Error("\nNothing written — resolve the above and run again.");
  }

  // System derived from the marks, never typed by hand.
  const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
  for (const l of resolved) counts[l.match.forecast!.marks.length]++;
  const doubles = counts[2] ?? 0;
  const triples = counts[3] ?? 0;
  const rows = Math.pow(2, doubles) * Math.pow(3, triples);

  const round = {
    id: draft.id,
    name: draft.name,
    ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
    system: {
      type: triples ? `${doubles}+${triples}` : `${doubles}+0`,
      singles: counts[1] ?? 0,
      doubles,
      triples,
      rows,
    },
    matchIds: resolved.map((l) => l.match.id),
  };

  process.stdout.write(
    `\nSystem: ${round.system.type} — ${round.system.singles} singles, ${doubles} doubles` +
      `${triples ? `, ${triples} triples` : ""} → ${rows} rows\n`
  );

  if (dry) {
    process.stdout.write(`\n[dry] would write data/rounds/${id}.json\n`);
    return;
  }
  await writeFile(path.join(DATA, "rounds", `${id}.json`), JSON.stringify(round, null, 2) + "\n");
  process.stdout.write(`\nwrote data/rounds/${id}.json — run npm run validate\n`);
}

main().catch((e) => {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exit(1);
});
