import type { LeagueId, Match } from "./schema";

/* ---------------------------------------------------------------------------
 * strictlane — league standings
 *
 * Same rule as scoring.ts: nothing here is stored. The table is aggregated
 * from played matches at build time, so it can never disagree with the
 * results already on the site.
 * ------------------------------------------------------------------------- */

export type FormResult = "W" | "D" | "L";

/** How many recent results the form column shows. */
export const FORM_LENGTH = 5;

export interface StandingRow {
  team: string; // team id
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** latest results, oldest first, at most FORM_LENGTH */
  form: FormResult[];
}

/** Standard W/D/L table, sorted by points, then goal difference, then goals for. */
export function computeStandings(matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();

  const row = (team: string) => {
    let r = rows.get(team);
    if (!r) {
      r = { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] };
      rows.set(team, r);
    }
    return r;
  };

  // Chronological, so each team's form ends with its latest match. Array sort
  // is stable, so same-kickoff matches keep their file order.
  const played = matches
    .filter((m) => m.status === "played" && m.score)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));

  for (const m of played) {
    if (!m.score) continue;
    const home = row(m.home);
    const away = row(m.away);
    home.played++;
    away.played++;
    home.gf += m.score.home;
    home.ga += m.score.away;
    away.gf += m.score.away;
    away.ga += m.score.home;
    if (m.score.home > m.score.away) {
      home.won++;
      home.points += 3;
      away.lost++;
      home.form.push("W");
      away.form.push("L");
    } else if (m.score.home < m.score.away) {
      away.won++;
      away.points += 3;
      home.lost++;
      away.form.push("W");
      home.form.push("L");
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      home.form.push("D");
      away.form.push("D");
    }
  }

  for (const r of rows.values()) {
    r.gd = r.gf - r.ga;
    r.form = r.form.slice(-FORM_LENGTH);
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );
}

/* ------------------------------------------------------------ table zones --- */

export type Zone = "ucl" | "uel" | "promotion" | "playoff" | "relegation";

/**
 * Promotion, relegation and European places by final position, per league.
 * Positions are 1-based and inclusive. These are competition rules, not data,
 * so they live here rather than in the season files — revisit if a league
 * changes its format (e.g. extra Champions League places).
 */
const ZONES: Record<LeagueId, Array<{ zone: Zone; from: number; to: number }>> = {
  "premier-league": [
    { zone: "ucl", from: 1, to: 4 },
    { zone: "uel", from: 5, to: 5 },
    { zone: "relegation", from: 18, to: 20 },
  ],
  championship: [
    { zone: "promotion", from: 1, to: 2 },
    { zone: "playoff", from: 3, to: 8 },
    { zone: "relegation", from: 22, to: 24 },
  ],
  "league-one": [
    { zone: "promotion", from: 1, to: 2 },
    { zone: "playoff", from: 3, to: 6 },
    { zone: "relegation", from: 21, to: 24 },
  ],
};

export function zoneFor(league: LeagueId, position: number): Zone | null {
  return ZONES[league].find((z) => position >= z.from && position <= z.to)?.zone ?? null;
}

/** The zones a league uses, in table order — for the key under the table. */
export function zonesOf(league: LeagueId): Zone[] {
  return ZONES[league].map((z) => z.zone);
}
