import type { Match } from "./schema";

/* ---------------------------------------------------------------------------
 * strictlane — league standings
 *
 * Same rule as scoring.ts: nothing here is stored. The table is aggregated
 * from played matches at build time, so it can never disagree with the
 * results already on the site.
 * ------------------------------------------------------------------------- */

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
}

/** Standard W/D/L table, sorted by points, then goal difference, then goals for. */
export function computeStandings(matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();

  const row = (team: string) => {
    let r = rows.get(team);
    if (!r) {
      r = { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
      rows.set(team, r);
    }
    return r;
  };

  for (const m of matches) {
    if (m.status !== "played" || !m.score) continue;
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
    } else if (m.score.home < m.score.away) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  for (const r of rows.values()) r.gd = r.gf - r.ga;

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );
}
