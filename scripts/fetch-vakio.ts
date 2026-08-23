#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — Veikkaus Vakio fetcher
 *
 *   npx tsx scripts/fetch-vakio.ts --raw     dump the API payload, write nothing
 *   npx tsx scripts/fetch-vakio.ts --dry     map it, print, write nothing
 *   npx tsx scripts/fetch-vakio.ts           write data/rounds/{id}.json
 *
 * Reads the public open-games endpoint. No login, no registered key: the header
 * value is the literal string ROBOT for every caller.
 *
 * ⚠ THE FIELD MAPPING BELOW IS PROVISIONAL. The reference repo documents the
 * draws response as doc/sport-draws-reply.json but that file is not actually in
 * the repo, so the exact shape of `rows` / `outcome` for SPORT is unverified.
 * Run with --raw once, look at the payload, and fix `mapDraw()` before trusting
 * it. Everything else here is confirmed from the reference implementation.
 *
 * Timing matters: the endpoint returns ONLY open, playable draws. Once a coupon
 * closes it disappears from the response. If the job misses its window the
 * coupon is gone, so this runs on a schedule and commits a raw snapshot.
 * ------------------------------------------------------------------------- */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { TeamsFile, type Team } from "../lib/schema";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const BASE = "https://www.veikkaus.fi/api";

const HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  // Required on every request. Automated clients send the literal "ROBOT".
  "X-ESA-API-Key": "ROBOT",
};

/* ------------------------------------------------------------------ http --- */

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return (await res.json()) as T;
}

/* --------------------------------------------------------------- mapping --- */

/** Loose shape — tighten after inspecting a real payload with --raw. */
interface RawDraw {
  id: number | string;
  listIndex?: number;
  name?: string;
  brandName?: string;
  status?: string;
  openTime?: number;
  closeTime?: number;
  rows?: Array<{
    eventNumber?: number;
    name?: string;
    competitors?: Array<{ name?: string }>;
    outcome?: Array<{ name?: string }>;
  }>;
}

interface Fixture {
  eventId: number;
  home: string;
  away: string;
}

/**
 * Pull home/away out of a draw row.
 *
 * Vakio rows describe the fixture via `competitors` (two entries) or, in some
 * payloads, a single "Home - Away" name string. Both are handled; if neither
 * yields two teams the row is reported rather than guessed at.
 */
function mapDraw(draw: RawDraw): Fixture[] {
  const rows = draw.rows ?? [];
  return rows.map((row, i) => {
    const eventId = row.eventNumber ?? i;

    if (row.competitors?.length === 2) {
      return {
        eventId,
        home: (row.competitors[0].name ?? "").trim(),
        away: (row.competitors[1].name ?? "").trim(),
      };
    }
    const label = (row.name ?? "").trim();
    const split = label.split(/\s+[-–]\s+/);
    if (split.length === 2) return { eventId, home: split[0].trim(), away: split[1].trim() };

    throw new Error(
      `row ${i} of draw ${draw.id}: cannot read home/away from ${JSON.stringify(row).slice(0, 200)}` +
        ` — inspect with --raw and fix mapDraw()`
    );
  });
}

/* ----------------------------------------------------------- popularity --- */

interface PopularityReply {
  resultPopularities: Array<{
    eventId: number;
    outcomes: string[];
    percentage: number;      // scaled ×100 — 7615 means 76.15%
    awdPercentage: number;   // second series, meaning undocumented; kept raw
  }>;
}

/**
 * How the betting pool is distributed across 1/X/2, per match.
 *
 * This is the genuinely interesting half of the API. Vakio is pari-mutuel: the
 * payout depends on how many other people share your row, so pool popularity is
 * a different quantity from bookmaker probability, and the gap between them is
 * where pool value actually lives. Stored alongside — never mixed into — the
 * market probabilities.
 */
async function fetchPopularity(drawId: string | number) {
  const reply = await get<PopularityReply>(
    `${BASE}/sport-popularity/v1/games/SPORT/draws/${drawId}/popularity`
  );
  const byEvent = new Map<number, Record<string, number>>();
  for (const p of reply.resultPopularities ?? []) {
    const sign = p.outcomes?.[0];
    if (!sign) continue;
    const entry = byEvent.get(p.eventId) ?? {};
    entry[sign] = p.percentage / 100; // -> percent
    byEvent.set(p.eventId, entry);
  }
  return byEvent;
}

/* --------------------------------------------------------------- teams --- */

async function loadTeamIndex(): Promise<Map<string, Team>> {
  const parsed = TeamsFile.parse(JSON.parse(await readFile(path.join(DATA, "teams.json"), "utf8")));
  const index = new Map<string, Team>();
  for (const t of parsed.teams) {
    for (const key of [t.id, t.name, t.short, ...t.aliases]) {
      index.set(key.toLowerCase().trim(), t);
    }
  }
  return index;
}

function slug(name: string) {
  return name.toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ----------------------------------------------------------------- main --- */

async function main() {
  const argv = process.argv.slice(2);
  const raw = argv.includes("--raw");
  const dry = argv.includes("--dry") || raw;

  const draws = await get<RawDraw[]>(`${BASE}/sport-open-games/v1/games/SPORT/draws`);

  if (raw) {
    process.stdout.write(JSON.stringify(draws, null, 2));
    process.stderr.write(
      `\n\n${draws.length} open Vakio draw(s). Check the row shape above, then fix mapDraw().\n`
    );
    return;
  }

  if (!draws.length) {
    process.stdout.write("No open Vakio draws right now — nothing to do.\n");
    return;
  }

  const teams = await loadTeamIndex();
  const unknown = new Set<string>();

  for (const draw of draws) {
    const fixtures = mapDraw(draw);
    process.stdout.write(
      `\nDraw ${draw.id} — ${draw.brandName ?? draw.name ?? "Vakio"} · ${fixtures.length} matches\n`
    );

    let popularity: Map<number, Record<string, number>> | null = null;
    try {
      popularity = await fetchPopularity(draw.id);
    } catch (e) {
      // Popularity may require an authenticated session; the reference docs are
      // ambiguous. Never fatal — the coupon itself is the deliverable.
      process.stdout.write(`  popularity unavailable (${(e as Error).message})\n`);
    }

    const resolved = fixtures.map((f) => {
      const h = teams.get(f.home.toLowerCase());
      const a = teams.get(f.away.toLowerCase());
      if (!h) unknown.add(f.home);
      if (!a) unknown.add(f.away);
      return {
        eventId: f.eventId,
        homeRaw: f.home,
        awayRaw: f.away,
        home: h?.id ?? null,
        away: a?.id ?? null,
        poolPopularity: popularity?.get(f.eventId) ?? null,
      };
    });

    for (const r of resolved) {
      const pop = r.poolPopularity
        ? `  pool ${r.poolPopularity["1"] ?? "?"}/${r.poolPopularity.X ?? "?"}/${r.poolPopularity["2"] ?? "?"}`
        : "";
      process.stdout.write(
        `  ${String(r.eventId).padStart(2)} ${r.homeRaw} – ${r.awayRaw}` +
          `${r.home && r.away ? "" : "   ⚠ unmapped"}${pop}\n`
      );
    }

    if (unknown.size) {
      const stub = [...unknown]
        .sort()
        .map((n) => `    { "id": "${slug(n)}", "name": "${n}", "short": "${n.slice(0, 12)}", "aliases": ["${n}"] }`);
      throw new Error(
        `\n${unknown.size} unmapped team name(s). Nothing written.\n` +
          `Add to data/teams.json (Veikkaus uses Finnish/short forms):\n\n${stub.join(",\n")}\n`
      );
    }

    // Draft round file. matchIds are filled in by hand or by a later join once
    // the fixtures exist in the matchweek files — this script never invents them.
    const capturedAt = new Date().toISOString();
    const id = capturedAt.slice(0, 10);
    const out = {
      id,
      name: draw.brandName ?? draw.name ?? "Vakio",
      sourceUrl: `https://www.veikkaus.fi/fi/vedonlyonti/vakio?kohde=a_${draw.id}`,
      veikkaus: {
        drawId: String(draw.id),
        listIndex: draw.listIndex ?? null,
        closeTime: draw.closeTime ? new Date(draw.closeTime).toISOString() : null,
        capturedAt,
      },
      fixtures: resolved,
      matchIds: [] as string[], // filled once the matches exist in data/{season}/…
    };

    if (dry) {
      process.stdout.write(`\n[dry] would write data/rounds/${id}.json\n`);
      continue;
    }

    await mkdir(path.join(DATA, "rounds"), { recursive: true });
    const file = path.join(DATA, "rounds", `${id}.json`);
    if (existsSync(file)) {
      process.stdout.write(`  ${file} exists — not overwriting. Delete it to re-fetch.\n`);
      continue;
    }
    await writeFile(file, JSON.stringify(out, null, 2) + "\n");

    // Raw snapshot as provenance. The open-games endpoint is ephemeral; once the
    // coupon closes this payload cannot be retrieved again from anywhere.
    await mkdir(path.join(DATA, "rounds", "raw"), { recursive: true });
    await writeFile(
      path.join(DATA, "rounds", "raw", `${id}-draw-${draw.id}.json`),
      JSON.stringify({ capturedAt, draw }, null, 2) + "\n"
    );
    process.stdout.write(`  wrote data/rounds/${id}.json\n`);
  }
}

main().catch((e) => {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exit(1);
});
