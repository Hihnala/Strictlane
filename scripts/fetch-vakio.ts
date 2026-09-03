#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — Veikkaus Vakio fetcher
 *
 *   npx tsx scripts/fetch-vakio.ts --raw     dump the API payload, write nothing
 *   npx tsx scripts/fetch-vakio.ts --dry     map it, print, write nothing
 *   npx tsx scripts/fetch-vakio.ts           write data/rounds/drafts/{id}.json
 *
 * Reads the public open-games endpoint. No login, no registered key: the header
 * value is the literal string ROBOT for every caller.
 *
 * Timing matters: the endpoint returns ONLY open, playable draws. Once a coupon
 * closes it disappears from the response. If the job misses its window the
 * coupon is gone, so this runs on a schedule and commits a raw snapshot.
 *
 * Everything this script prints goes to stdout, deliberately. Splitting the
 * fixture listing across two streams made the Actions log interleave the error
 * summary into the middle of the match list, which was unreadable.
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

const log = (s: string) => process.stdout.write(s);

/* ------------------------------------------------------------------ http --- */

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return (await res.json()) as T;
}

/* --------------------------------------------------------------- mapping --- */

/**
 * Confirmed against a real payload (draw 100569, Aug 2026): SPORT rows carry
 * `outcome.home` / `outcome.away` objects, each with `id` and `name`. The
 * `competitors` array and single `"Home - Away"` string were the two shapes
 * the reference repo's docs left ambiguous; neither is what the API actually
 * sends, but both stay as fallbacks in case a different game type or a future
 * payload uses them.
 */
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
    outcome?: {
      home?: { id?: string; name?: string };
      away?: { id?: string; name?: string };
    };
  }>;
}

interface Fixture {
  eventId: number;
  home: string;
  away: string;
}

const drawLabel = (d: RawDraw) => d.brandName ?? d.name ?? "Vakio";

/** Pull home/away out of a draw row. */
function mapDraw(draw: RawDraw): Fixture[] {
  const rows = draw.rows ?? [];
  return rows.map((row, i) => {
    const eventId = row.eventNumber ?? i;

    const oHome = (row.outcome?.home?.name ?? row.outcome?.home?.id ?? "").trim();
    const oAway = (row.outcome?.away?.name ?? row.outcome?.away?.id ?? "").trim();
    if (oHome && oAway) return { eventId, home: oHome, away: oAway };

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

interface TeamIndex {
  byKey: Map<string, Team>;
  all: Team[];
}

async function loadTeamIndex(): Promise<TeamIndex> {
  const parsed = TeamsFile.parse(JSON.parse(await readFile(path.join(DATA, "teams.json"), "utf8")));
  const byKey = new Map<string, Team>();
  for (const t of parsed.teams) {
    for (const key of [t.id, t.name, t.short, ...t.aliases]) {
      byKey.set(key.toLowerCase().trim(), t);
    }
  }
  return { byKey, all: parsed.teams };
}

// NFD-decompose before stripping, so Å/ä/ö reduce to a/a/o instead of vanishing.
// The old version turned "ÅIFK" into "ifk" and "JäPS" into "j-ps".
function slug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Veikkaus truncates canonical names at a word boundary, sometimes leaving an
 * initial: "Manchester C", "Crystal P", "West Bromwich", "Manchester U". Every
 * one of those is a prefix of a name already in teams.json, so the fix is
 * almost always a new alias on an existing club — never a new id, which would
 * split one club into two identities that the validator cannot detect, since
 * both would resolve.
 *
 * Deliberately only *suggests*. A wrong mapping must never reach the site
 * silently, so the draw still fails and the paste is still by hand.
 */
function suggest(raw: string, teams: Team[]): string {
  const needle = raw.toLowerCase().trim();
  const hits = teams.filter((t) => t.name.toLowerCase().startsWith(needle));

  if (hits.length === 1) {
    return `    "${raw}"  →  add to aliases of "${hits[0].id}" (${hits[0].name})`;
  }
  if (hits.length > 1) {
    return `    "${raw}"  →  ambiguous prefix of ${hits.map((t) => t.id).join(", ")} — resolve by hand`;
  }
  return (
    `    "${raw}"  →  no prefix match. If this club really is new to the three leagues:\n` +
    `        { "id": "${slug(raw)}", "name": "${raw}", "short": "${raw.slice(0, 12)}", "aliases": ["${raw}"] }`
  );
}

/* ---------------------------------------------------------------- draws --- */

/**
 * The one draw type this site models. PRODUCT.md defines a round as a 13-match
 * coupon across the Premier League, Championship and League One; Lauantaivakio
 * is the only draw that is one.
 *
 * A whitelist, not a blacklist, on purpose. The previous test —
 * `includes("vakio") && !includes("futis")` — let through anything Veikkaus
 * chose to name next, and on 3 Sep 2026 that was a 12-match Sunnuntaivakio
 * mixing La Liga, Serie A and the Finnish Kakkonen, whose 23 unmapped teams
 * killed a run that had already captured the Saturday coupon.
 *
 * The optional time prefix is load-bearing: the API sent "16.00 Sunnuntaivakio",
 * so a bare equality test would fail closed the first week Veikkaus prefixes the
 * Saturday coupon too. Failing closed is expensive here — the endpoint drops
 * closed coupons permanently — hence the loud non-zero exit below when nothing
 * matches, rather than a quiet "nothing to do".
 */
const LAUANTAIVAKIO = /^(?:\d{1,2}[.:]\d{2}\s+)?Lauantaivakio$/i;

const isTarget = (d: RawDraw) =>
  [d.brandName, d.name].some((v) => LAUANTAIVAKIO.test((v ?? "").trim()));

/**
 * The round id is the date the coupon is PLAYED, not the date it was captured.
 * Those coincided when the job polled Tue–Fri and the PR was merged the same
 * afternoon; on the Thursday cron they are two days apart, and a round filed
 * under its capture date would not line up with `forecast.roundId` or with
 * data/{season}/{league}/mw-NN.json. closeTime is the last moment bets are
 * accepted — just before the first kickoff — so its UTC date is the coupon's.
 */
function roundId(draw: RawDraw, capturedAt: string): string {
  if (!draw.closeTime) {
    log(`  ⚠ draw ${draw.id} has no closeTime — falling back to the capture date for the id\n`);
    return capturedAt.slice(0, 10);
  }
  return new Date(draw.closeTime).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------- one draw --- */

async function processDraw(draw: RawDraw, teams: TeamIndex, dry: boolean) {
  const fixtures = mapDraw(draw);
  log(`\nDraw ${draw.id} — ${drawLabel(draw)} · ${fixtures.length} matches\n`);

  let popularity: Map<number, Record<string, number>> | null = null;
  try {
    popularity = await fetchPopularity(draw.id);
  } catch (e) {
    // Popularity may require an authenticated session; the reference docs are
    // ambiguous. Never fatal — the coupon itself is the deliverable.
    log(`  popularity unavailable (${(e as Error).message})\n`);
  }

  // Scoped to this draw. Previously declared once outside the loop and never
  // cleared, so one bad draw poisoned every draw processed after it — including
  // clean ones that would otherwise have written fine.
  const unknown = new Set<string>();

  const resolved = fixtures.map((f) => {
    const h = teams.byKey.get(f.home.toLowerCase());
    const a = teams.byKey.get(f.away.toLowerCase());
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
    log(
      `  ${String(r.eventId).padStart(2)} ${r.homeRaw} – ${r.awayRaw}` +
        `${r.home && r.away ? "" : "   ⚠ unmapped"}${pop}\n`
    );
  }

  if (unknown.size) {
    throw new Error(
      `${unknown.size} unmapped team name(s) — nothing written for this draw.\n` +
        `  Veikkaus truncates names; prefer an alias on the existing club:\n\n` +
        [...unknown].sort().map((n) => suggest(n, teams.all)).join("\n") +
        "\n"
    );
  }

  const capturedAt = new Date().toISOString();
  const id = roundId(draw, capturedAt);

  // Draft round file. matchIds are filled in by hand or by a later join once
  // the fixtures exist in the matchweek files — this script never invents them.
  const out = {
    id,
    name: drawLabel(draw),
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
    log(`\n[dry] would write data/rounds/drafts/${id}.json\n`);
    return;
  }

  // Drafts live in a subdirectory the validator ignores (it only reads *.json
  // directly under data/rounds). A draft has no forecasts and no matchIds yet,
  // so it cannot satisfy the Round schema — writing it to the validated path
  // would break the production build.
  await mkdir(path.join(DATA, "rounds", "drafts"), { recursive: true });
  const file = path.join(DATA, "rounds", "drafts", `${id}.json`);
  if (existsSync(file)) {
    log(`  ${file} exists — not overwriting. Delete it to re-fetch.\n`);
    return;
  }
  await writeFile(file, JSON.stringify(out, null, 2) + "\n");

  // Raw snapshot as provenance. The open-games endpoint is ephemeral; once the
  // coupon closes this payload cannot be retrieved again from anywhere.
  await mkdir(path.join(DATA, "rounds", "raw"), { recursive: true });
  await writeFile(
    path.join(DATA, "rounds", "raw", `${id}-draw-${draw.id}.json`),
    JSON.stringify({ capturedAt, draw }, null, 2) + "\n"
  );
  log(
    `  wrote data/rounds/drafts/${id}.json\n` +
      `  next: add forecasts, then npx tsx scripts/promote-round.ts ${id}\n`
  );
}

/* ----------------------------------------------------------------- main --- */

async function main() {
  const argv = process.argv.slice(2);
  const raw = argv.includes("--raw");
  const dry = argv.includes("--dry") || raw;

  const allDraws = await get<RawDraw[]>(`${BASE}/sport-open-games/v1/games/SPORT/draws`);

  if (raw) {
    // Unfiltered on purpose: --raw exists to inspect what the API actually
    // sends, which is exactly what you need when the filter is the suspect.
    process.stdout.write(JSON.stringify(allDraws, null, 2));
    log(`\n\n${allDraws.length} open draw(s): ${allDraws.map(drawLabel).join(", ")}\n`);
    return;
  }

  const draws = allDraws.filter(isTarget);
  const skipped = allDraws.filter((d) => !isTarget(d));
  if (skipped.length) {
    log(`Skipped ${skipped.length} out-of-scope draw(s): ${skipped.map(drawLabel).join(", ")}.\n`);
  }

  if (!draws.length) {
    // Not "nothing to do". Veikkaus publishes Lauantaivakio on Monday or
    // Tuesday, so by the Thursday run its absence means the filter is stale or
    // the endpoint changed — and the coupon is unrecoverable once it closes.
    // Fail red on Thursday, while there are still two days to fetch by hand.
    log(
      `No Lauantaivakio draw in the response.\n` +
        `  Saw: ${allDraws.map(drawLabel).join(", ") || "(nothing)"}\n` +
        `  Check those names against LAUANTAIVAKIO, or capture the coupon manually.\n`
    );
    process.exitCode = 1;
    return;
  }

  const teams = await loadTeamIndex();

  // One draw's failure must not discard another's output. The 3 Sep 2026 run
  // wrote the Saturday coupon, then threw on an unrelated draw; that error
  // failed the Actions step, every later step was skipped, no PR opened, and
  // the draft died with the runner. Collect, keep going, exit at the end.
  const failures: string[] = [];
  for (const draw of draws) {
    try {
      await processDraw(draw, teams, dry);
    } catch (e) {
      failures.push(`Draw ${draw.id} (${drawLabel(draw)}): ${(e as Error).message}`);
    }
  }

  if (failures.length) {
    log(`\n${failures.length} draw(s) failed:\n\n${failures.join("\n")}\n`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  log(`${(e as Error).message}\n`);
  process.exit(1);
});
