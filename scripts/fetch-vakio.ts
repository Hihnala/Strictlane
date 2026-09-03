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
  // A string ("1") in every payload seen so far, despite reading like a number.
  listIndex?: number | string;
  name?: string;
  // Absent on the 3 Sep 2026 payload — the draw name arrived in `name`, time
  // prefix and all ("16.00 Sunnuntaivakio"). Kept because the reference docs
  // describe it and some game types may still send it.
  brandName?: string;
  status?: string;
  openTime?: number;
  closeTime?: number;
  rows?: Array<{
    id?: string;           // position within the coupon, "0".."12"
    eventId?: string;      // Veikkaus's global fixture key, e.g. "104918542"
    eventNumber?: number;  // documented but never actually sent; fallback only
    name?: string;
    competitors?: Array<{ name?: string }>;
    outcome?: {
      home?: { id?: string; name?: string };
      away?: { id?: string; name?: string };
    };
  }>;
}

/**
 * Veikkaus sends two different abbreviations per side, and neither is reliably
 * the better one. On 3 Sep 2026 `outcome.name` gave "Manchester C" and "West
 * Bromwich" — both of which had to be added to teams.json by hand — while
 * `outcome.id` gave "Man City" and "West Brom", which were already aliases.
 * But `outcome.id` also gives "Middlesbr", "Portsm." and "Sunderl.", which
 * `outcome.name` spells out in full. So both are carried through to resolution
 * and either may be the one that matches.
 */
interface Side {
  name: string; // outcome.name — the display form, what gets logged
  alt: string;  // outcome.id — a second abbreviation, often an existing alias
}

interface Fixture {
  position: number;         // index within the coupon, from row.id
  eventRef: string | null;  // Veikkaus's own fixture key; provenance only
  home: Side;
  away: Side;
}

const drawLabel = (d: RawDraw) => d.brandName ?? d.name ?? "Vakio";

const side = (name: string, alt: string): Side => ({ name: name.trim(), alt: alt.trim() });

/** Pull home/away out of a draw row. */
function mapDraw(draw: RawDraw): Fixture[] {
  const rows = draw.rows ?? [];
  return rows.map((row, i) => {
    // `row.id` is the coupon position. The array index has agreed with it on
    // every payload so far, which is the only reason the previous
    // `eventNumber ?? i` worked at all — `eventNumber` is never actually sent.
    // Prefer the explicit field and refuse if the two disagree: the popularity
    // map is keyed on this number, so a silent drift would attach the wrong
    // pool split to a match instead of failing.
    const declared = row.id !== undefined ? Number(row.id) : row.eventNumber;
    const hasDeclared = declared !== undefined && Number.isFinite(declared);
    if (hasDeclared && declared !== i) {
      throw new Error(
        `row ${i} of draw ${draw.id}: declared position ${declared} does not match array index ${i}.` +
          ` Rows are out of document order and pool popularity would be misaligned.` +
          ` Inspect with --raw before trusting anything in this draw.`
      );
    }
    const position = hasDeclared ? (declared as number) : i;
    const eventRef = row.eventId ?? null;

    const hName = row.outcome?.home?.name ?? "";
    const aName = row.outcome?.away?.name ?? "";
    const hAlt = row.outcome?.home?.id ?? "";
    const aAlt = row.outcome?.away?.id ?? "";
    if ((hName || hAlt) && (aName || aAlt)) {
      return {
        position,
        eventRef,
        home: side(hName || hAlt, hAlt),
        away: side(aName || aAlt, aAlt),
      };
    }

    if (row.competitors?.length === 2) {
      return {
        position,
        eventRef,
        home: side(row.competitors[0].name ?? "", ""),
        away: side(row.competitors[1].name ?? "", ""),
      };
    }
    const label = (row.name ?? "").trim();
    const split = label.split(/\s+[-–]\s+/);
    if (split.length === 2) {
      return { position, eventRef, home: side(split[0], ""), away: side(split[1], "") };
    }

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

/**
 * Resolve one side against teams.json, trying both abbreviations Veikkaus
 * sends. Either may be the one that matches; only one needs to.
 *
 * If both match but disagree, that is not a naming quirk — it means one of the
 * two strings is on the wrong club's alias list, and every coupon that ever
 * used that alias is suspect. Surfaced as a hard failure, never resolved by
 * preferring one field.
 */
function resolveSide(s: Side, teams: TeamIndex): { team: Team | null; conflict: string | null } {
  const byName = s.name ? teams.byKey.get(s.name.toLowerCase()) : undefined;
  const byAlt = s.alt ? teams.byKey.get(s.alt.toLowerCase()) : undefined;

  if (byName && byAlt && byName.id !== byAlt.id) {
    return {
      team: null,
      conflict: `"${s.name}" → ${byName.id}, but "${s.alt}" → ${byAlt.id}`,
    };
  }
  return { team: byName ?? byAlt ?? null, conflict: null };
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
  const conflicts: string[] = [];

  const resolved = fixtures.map((f) => {
    const h = resolveSide(f.home, teams);
    const a = resolveSide(f.away, teams);

    if (h.conflict) conflicts.push(h.conflict);
    else if (!h.team) unknown.add(f.home.name || f.home.alt);
    if (a.conflict) conflicts.push(a.conflict);
    else if (!a.team) unknown.add(f.away.name || f.away.alt);

    return {
      eventId: f.position,
      eventRef: f.eventRef,
      homeRaw: f.home.name,
      awayRaw: f.away.name,
      home: h.team?.id ?? null,
      away: a.team?.id ?? null,
      poolPopularity: popularity?.get(f.position) ?? null,
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

  if (conflicts.length) {
    throw new Error(
      `${conflicts.length} side(s) where Veikkaus's two name forms resolve to different clubs:\n\n` +
        conflicts.map((c) => `    ${c}`).join("\n") +
        `\n\n  One of those aliases is on the wrong club in teams.json. Fix it before\n` +
        `  trusting this coupon — and check any past round that used it.\n`
    );
  }

  if (unknown.size) {
    throw new Error(
      `${unknown.size} unmapped team name(s) — nothing written for this draw.\n` +
        `  Both of Veikkaus's forms were tried and neither matched. Truncation is\n` +
        `  the usual cause; prefer an alias on the existing club:\n\n` +
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
