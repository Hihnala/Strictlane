#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
 * strictlane — apply an edited odds review table to the matchweek files
 *
 *   npx tsx scripts/apply-review.ts --comment review.md --at 2026-10-31T07:30:00Z
 *   npx tsx scripts/apply-review.ts --comment review.md --check
 *   npx tsx scripts/apply-review.ts --comment review.md --at … --dry
 *
 * The Fetch odds workflow posts its suggestions as a Markdown table in a PR
 * comment. The natural way to disagree with a suggestion is to edit that
 * table — so this script makes the table an editing surface: every row whose
 * Probs or Marks differ from the matchweek files is written back as the new
 * forecast, with `capturedAt` set to the time of the edit (`--at`).
 *
 * It refuses, writing nothing, when the edit can't be a valid coupon: an
 * unreadable cell, probabilities that don't sum to 100, a system that no
 * longer matches the coupon's (5 singles, 8 doubles). A match whose kickoff
 * has passed is never changed — that row is refused and the rest applied, and
 * the table keeps disagreeing with the files until the row is put back.
 *
 * --check          only report whether the table and the files agree
 * --dry            report what would change without writing
 * --summary FILE   also write the report as Markdown, for a PR reply
 *
 * Exit codes: 0 applied or nothing to do, 1 refused (nothing written),
 * 3 --check found differences.
 * ------------------------------------------------------------------------- */

import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ProbTriple, type Match } from "../lib/schema";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const SIGNS = ["1", "X", "2"] as const;
type S = (typeof SIGNS)[number];
type Probs = Record<S, number>;

/** Written into the review comment by fetch-odds.ts, so rows map to matches without guessing. */
export const MARKER_RE = /<!--\s*strictlane:review\s+round=(\S+)\s+ids=(\S*)\s*-->/;

/* --------------------------------------------------------------- parsing --- */

export interface Row {
  position: number; // 1-based, as shown
  label: string;
  probs: Probs | null;
  marks: S[] | null;
  /** set when a cell could not be read */
  error?: string;
}

const isDash = (c: string) => /^[—–-]?$/.test(c.trim());

export function parseMarks(cell: string): S[] | null | string {
  const c = cell.replace(/\*\*|`|\(kept\)/gi, "").trim().toUpperCase();
  if (isDash(c)) return null;
  const chars = c.replace(/[\s,]/g, "").split("");
  if (!chars.length || chars.some((ch) => !SIGNS.includes(ch as S))) return `Marks "${cell.trim()}": use 1, X and 2, e.g. 1X`;
  if (new Set(chars).size !== chars.length) return `Marks "${cell.trim()}" repeats a sign`;
  return SIGNS.filter((s) => chars.includes(s));
}

export function parseProbs(cell: string): Probs | null | string {
  const c = cell.replace(/\*\*|`/g, "").trim();
  if (isDash(c)) return null;
  const parts = c.split("/").map((x) => x.trim());
  const nums = parts.map(Number);
  if (parts.length !== 3 || parts.some((x) => x === "") || nums.some((n) => !Number.isFinite(n) || n < 0 || n > 100))
    return `Probs "${cell.trim()}": write three numbers as 1 / X / 2, e.g. 45 / 28 / 27`;
  return { "1": nums[0], X: nums[1], "2": nums[2] };
}

export function parseTable(body: string): { round: string | null; ids: (string | null)[] | null; rows: Row[] } {
  const marker = body.match(MARKER_RE);
  const heading = body.match(/^##\s+Odds pre-fill\b.*?(\d{4}-\d{2}-\d{2})\s*$/m);
  const round = marker?.[1] ?? heading?.[1] ?? null;
  const ids = marker ? marker[2].split(",").map((x) => x || null) : null;

  const lines = body.split(/\r?\n/).map((l) => l.trim());
  const cells = (l: string) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const head = lines.findIndex((l) => l.startsWith("|") && /\bProbs\b/.test(l) && /\bMarks\b/.test(l));
  if (head < 0) return { round, ids, rows: [] };
  const h = cells(lines[head]);
  const col = (name: string) => h.findIndex((c) => c.startsWith(name));
  const [iN, iMatch, iProbs, iMarks] = [col("#"), col("Match"), col("Probs"), col("Marks")];

  const rows: Row[] = [];
  for (const l of lines.slice(head + 2)) {
    if (!l.startsWith("|")) break;
    const c = cells(l);
    const position = Number(c[iN]);
    if (!Number.isInteger(position)) continue;
    const probs = parseProbs(c[iProbs] ?? "");
    const marks = parseMarks(c[iMarks] ?? "");
    const errs = [probs, marks].filter((x): x is string => typeof x === "string");
    rows.push({
      position,
      label: c[iMatch] ?? `row ${position}`,
      probs: typeof probs === "string" ? null : probs,
      marks: typeof marks === "string" ? null : marks,
      ...(errs.length ? { error: errs.join("; ") } : {}),
    });
  }
  return { round, ids, rows };
}

/* ------------------------------------------------------------------ data --- */

interface WeekFile {
  file: string;
  raw: string;
  data: { matches: Match[] } & Record<string, unknown>;
  dirty: boolean;
}

async function loadWeeks(): Promise<WeekFile[]> {
  const out: WeekFile[] = [];
  for (const season of await readdir(DATA, { withFileTypes: true })) {
    if (!season.isDirectory() || !/^\d{4}-\d{2}$/.test(season.name)) continue;
    for (const league of await readdir(path.join(DATA, season.name), { withFileTypes: true })) {
      if (!league.isDirectory()) continue;
      const dir = path.join(DATA, season.name, league.name);
      for (const f of (await readdir(dir)).filter((x) => /^mw-\d+\.json$/.test(x))) {
        const file = path.join(dir, f);
        const raw = await readFile(file, "utf8");
        out.push({ file, raw, data: JSON.parse(raw), dirty: false });
      }
    }
  }
  return out;
}

/** The ids the table's rows refer to, in row order: from the comment's marker, else the round file. */
async function roundIds(round: string, fromMarker: (string | null)[] | null): Promise<(string | null)[] | null> {
  if (fromMarker) return fromMarker;
  const file = path.join(DATA, "rounds", `${round}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8")).matchIds;
  return null;
}

/** The system the coupon was promoted with; 5 + 8 before it has been. */
async function roundSystem(round: string) {
  const file = path.join(DATA, "rounds", `${round}.json`);
  const s = existsSync(file) ? JSON.parse(await readFile(file, "utf8")).system : null;
  return { singles: s?.singles ?? 5, doubles: s?.doubles ?? 8, triples: s?.triples ?? 0 };
}

const fmt = (p: Probs) => SIGNS.map((s) => p[s]).join(" / ");
const sameMarks = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && SIGNS.every((s) => a.includes(s) === b.includes(s));
/** The table shows rounded probabilities, so an untouched cell must not count as an edit. */
const sameProbs = (table: Probs, file: Probs) => SIGNS.every((s) => table[s] === Math.round(file[s]));

/** What an earlier hand edit appended, so the provenance note never stacks. */
const HAND_RE = /;\s*(?:marks|probs|probs and marks) set by hand (?:in|from) the PR(?: #\d+)? review.*$/;
const MARKS_FROM_POOL = /;\s*marks steered by Veikkaus pool popularity$/;

/* ------------------------------------------------------------------ main --- */

interface Change {
  position: number;
  id: string;
  label: string;
  before: { probs: Probs; marks: S[] } | null;
  after: { probs: Probs; marks: S[] };
  what: "marks" | "probs" | "probs and marks" | "new forecast";
}

export interface Outcome {
  round: string | null;
  changes: Change[];
  applied: Change[];
  refused: string[];
  errors: string[];
}

export async function run(o: { body: string; at: string | null; check: boolean; dry: boolean }): Promise<Outcome> {
  const res: Outcome = { round: null, changes: [], applied: [], refused: [], errors: [] };
  const fail = (e: string) => ({ ...res, errors: [...res.errors, e] });
  const { round, ids: markerIds, rows } = parseTable(o.body);
  res.round = round;
  if (!round) return fail("Can't tell which round this table is for: no review marker or round date in the comment.");
  if (!rows.length) return fail("No review table with Probs and Marks columns in the comment.");

  const ids = await roundIds(round, markerIds);
  if (!ids) return fail(`Can't map the table's rows to matches: no review marker and no data/rounds/${round}.json.`);

  const weeks = await loadWeeks();
  const find = (id: string) => {
    for (const w of weeks) {
      const m = w.data.matches.find((x) => x.id === id);
      if (m) return { w, m };
    }
    return null;
  };

  for (const row of rows) {
    const tag = `Row ${row.position} (${row.label})`;
    if (row.error) {
      res.errors.push(`${tag}: ${row.error}.`);
      continue;
    }
    const id = ids[row.position - 1] ?? null;
    const hit = id ? find(id) : null;
    const base = { position: row.position, label: row.label };
    if (!id || !hit) {
      if (row.probs || row.marks) res.errors.push(`${tag}: no match record for this row yet, so fill it in the matchweek file instead.`);
      continue;
    }
    const f = hit.m.forecast;
    if (!f) {
      if (!row.probs && !row.marks) continue;
      if (!row.probs || !row.marks) {
        res.errors.push(`${tag}: a new forecast needs both Probs and Marks.`);
        continue;
      }
      res.changes.push({ ...base, id, before: null, after: { probs: row.probs, marks: row.marks }, what: "new forecast" });
      continue;
    }
    if (!row.probs || !row.marks) {
      res.errors.push(`${tag}: Probs and Marks can't be blanked; a forecast on file is never removed from the review table.`);
      continue;
    }
    const fileProbs = f.probs as Probs;
    const fileMarks = f.marks as S[];
    const probsChanged = !sameProbs(row.probs, fileProbs);
    const marksChanged = !sameMarks(row.marks, fileMarks);
    if (!probsChanged && !marksChanged) continue;
    res.changes.push({
      ...base,
      id,
      before: { probs: fileProbs, marks: fileMarks },
      after: { probs: probsChanged ? row.probs : fileProbs, marks: marksChanged ? row.marks : fileMarks },
      what: probsChanged && marksChanged ? "probs and marks" : probsChanged ? "probs" : "marks",
    });
  }

  for (const c of res.changes) {
    if (!ProbTriple.safeParse(c.after.probs).success)
      res.errors.push(`Row ${c.position} (${c.label}): Probs ${fmt(c.after.probs)} must sum to 100 (±1).`);
  }

  if (o.check || res.errors.length) return res;

  const at = o.at ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(at))) return fail(`--at "${at}" is not a timestamp.`);
  if (Date.parse(at) > Date.now() + 5 * 60_000) return fail(`--at ${at} is in the future.`);

  // A forecast is never written after kickoff: that row is refused, the rest go ahead.
  const ok: Change[] = [];
  for (const c of res.changes) {
    const { m } = find(c.id)!;
    if (m.status !== "pending" || !(Date.parse(at) < Date.parse(m.kickoff))) {
      const back = c.before ? `**${c.before.marks.join("")}** and ${fmt(c.before.probs)}` : "—";
      res.refused.push(
        `Row ${c.position} (${c.label}) kicked off ${m.kickoff.slice(0, 16).replace("T", " ")} UTC, before this edit, ` +
          `so it was left as it was. Put the row back to ${back} in the table.`
      );
    } else ok.push(c);
  }

  // The coupon's system must survive the edit.
  const target = await roundSystem(round);
  const marksNow = ids.map((id) => {
    if (!id) return null;
    const ch = ok.find((c) => c.id === id);
    return ch ? ch.after.marks : (find(id)?.m.forecast?.marks ?? null);
  });
  if (marksNow.every((m) => m)) {
    const n = (k: number) => marksNow.filter((m) => m!.length === k).length;
    const got = { singles: n(1), doubles: n(2), triples: n(3) };
    if (got.singles !== target.singles || got.doubles !== target.doubles || got.triples !== target.triples) {
      const sys = (s: typeof got) => `${s.singles} singles, ${s.doubles} doubles${s.triples ? `, ${s.triples} triples` : ""}`;
      return fail(`The edited table has ${sys(got)}; the coupon needs ${sys(target)}.`);
    }
  }

  const capturedAt = new Date(at).toISOString();
  for (const c of ok) {
    const { w, m } = find(c.id)!;
    const note = (m.forecast?.note ?? "").replace(HAND_RE, "");
    const kept = c.what === "probs" ? note : note.replace(MARKS_FROM_POOL, "");
    const hand = `${c.what === "new forecast" ? "probs and marks" : c.what} set by hand in the PR review`;
    m.forecast = {
      roundId: m.forecast?.roundId ?? round,
      probs: c.after.probs,
      marks: c.after.marks,
      capturedAt,
      note: kept ? `${kept}; ${hand}` : hand,
    };
    w.dirty = true;
    res.applied.push(c);
  }

  if (!o.dry) {
    for (const w of weeks.filter((x) => x.dirty)) {
      await writeFile(w.file, JSON.stringify(w.data, null, 2) + (w.raw.endsWith("\n") ? "\n" : ""));
    }
  }
  return res;
}

export function report(r: Outcome, mode: { check: boolean; dry: boolean; at?: string | null }): string {
  const out: string[] = [];
  const row = (c: Change) => {
    const was = c.before ? `**${c.before.marks.join("")}** · ${fmt(c.before.probs)}` : "—";
    return `| ${c.position} | ${c.label} | ${was} | **${c.after.marks.join("")}** · ${fmt(c.after.probs)} | ${c.what} |`;
  };
  if (r.errors.length) {
    out.push(`### ❌ Review table not applied${r.round ? ` (${r.round})` : ""}`, "", "Nothing was written.", "");
    out.push(...r.errors.map((e) => `- ${e}`));
    if (r.refused.length) out.push("", "These rows were left out because kickoff has passed:", "", ...r.refused.map((x) => `- ${x}`));
    out.push("", "Fix the table and save the comment again.");
    return out.join("\n");
  }
  if (mode.check) {
    out.push(
      r.changes.length
        ? `### Review table and matchweek files disagree on ${r.changes.length} row(s)`
        : "### Review table and matchweek files agree",
      ""
    );
    if (r.changes.length) out.push("| # | Match | Files | Table | Differs in |", "|---:|---|---|---|---|", ...r.changes.map(row));
    return out.join("\n");
  }
  const list = r.applied;
  out.push(
    list.length
      ? `### ✅ Review table applied${mode.dry ? " (dry run)" : ""} (${r.round})`
      : `### Review table: nothing to apply (${r.round})`,
    ""
  );
  if (list.length) {
    out.push("| # | Match | Was | Now | Changed |", "|---:|---|---|---|---|", ...list.map(row), "");
    out.push(`\`capturedAt\` on these forecasts: ${mode.at ?? "now"}. The rest of the coupon is unchanged.`);
  } else if (!r.refused.length) {
    out.push("The table already matches the matchweek files.");
  }
  if (r.refused.length) out.push("", "**Refused because kickoff has passed:**", "", ...r.refused.map((x) => `- ${x}`));
  return out.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? (args[i + 1] ?? null) : null;
  };
  const commentFile = opt("--comment");
  if (!commentFile) {
    console.error("usage: apply-review.ts --comment FILE [--at ISO] [--check] [--dry] [--summary FILE]");
    process.exit(1);
  }
  const check = args.includes("--check");
  const dry = args.includes("--dry");
  const at = opt("--at");
  const r = await run({ body: await readFile(commentFile, "utf8"), at, check, dry });
  const md = report(r, { check, dry, at });
  console.log(md);
  const summary = opt("--summary");
  if (summary) await writeFile(summary, md + "\n");
  if (r.errors.length) process.exit(1);
  if (check && r.changes.length) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
