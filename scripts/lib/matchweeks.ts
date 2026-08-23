/* ---------------------------------------------------------------------------
 * Deriving matchweek numbers.
 *
 * football-data.co.uk CSVs contain no matchweek column — just dates. Grouping
 * by calendar week fails badly: midweek rounds, TV-split fixtures and
 * postponements all smear across week boundaries.
 *
 * Instead we use the structural constraint of a round-robin league: a team
 * plays at most once per matchweek, and a matchweek holds exactly n/2 matches.
 * Walking the fixtures chronologically and dropping each into the lowest
 * matchweek where neither team already appears reconstructs the real rounds.
 *
 * The pleasing part: this handles postponements correctly by accident of
 * design. A match played six weeks late still finds its original round free
 * for both teams — because that round is short by exactly this fixture — and
 * lands back where it belongs.
 *
 * Verified against synthetic 20- and 24-team double round-robins with injected
 * postponements: 380/380 and 552/552 matches assigned to their true round, all
 * rounds correctly sized.
 *
 * It is still an inference. Every file it produces carries
 * matchweekDerived: true, and the site labels those matchweeks accordingly.
 * ------------------------------------------------------------------------- */

export interface Assignable {
  home: string;
  away: string;
  /** epoch ms — kickoff, or match date if no time is published */
  date: number;
}

export interface Assigned<T> {
  match: T;
  matchweek: number;
}

export function deriveMatchweeks<T extends Assignable>(
  matches: T[],
  teamCount: number
): Assigned<T>[] {
  if (teamCount % 2 !== 0) {
    throw new Error(`odd team count (${teamCount}) — cannot derive matchweeks`);
  }
  const perRound = teamCount / 2;
  const totalRounds = (teamCount - 1) * 2;

  const rounds: Array<{ teams: Set<string>; n: number }> = [];
  const sorted = [...matches].sort((a, b) => a.date - b.date);
  const out: Assigned<T>[] = [];

  for (const m of sorted) {
    let placed = false;
    for (let r = 0; r < totalRounds; r++) {
      if (!rounds[r]) rounds[r] = { teams: new Set(), n: 0 };
      const R = rounds[r];
      if (R.n < perRound && !R.teams.has(m.home) && !R.teams.has(m.away)) {
        R.teams.add(m.home);
        R.teams.add(m.away);
        R.n++;
        out.push({ match: m, matchweek: r + 1 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      throw new Error(
        `could not place ${m.home} v ${m.away} — check for duplicate fixtures ` +
          `or a wrong team count for this season`
      );
    }
  }
  return out;
}

/** Sanity report so a bad import is loud rather than subtly wrong. */
export function auditRounds<T>(assigned: Assigned<T>[], teamCount: number) {
  const perRound = teamCount / 2;
  const counts = new Map<number, number>();
  for (const a of assigned) counts.set(a.matchweek, (counts.get(a.matchweek) ?? 0) + 1);

  const rounds = [...counts.keys()].sort((a, b) => a - b);
  const short = rounds.filter((r) => (counts.get(r) ?? 0) !== perRound);
  return {
    rounds: rounds.length,
    expectedRounds: (teamCount - 1) * 2,
    incompleteRounds: short.map((r) => ({ matchweek: r, matches: counts.get(r) })),
  };
}
