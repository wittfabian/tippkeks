export interface DuelScore {
  fixtureId: string;
  userId: string;
  points: number;
}

export interface DuelRecord {
  opponentId: string;
  /** Fixtures where the reference user scored more than the opponent. */
  wins: number;
  /** Fixtures where the opponent scored more. */
  losses: number;
  /** Fixtures where both scored equally. */
  draws: number;
}

/**
 * Head-to-head records of `me` against every other member, over fixtures BOTH
 * have a scored prediction for. Pure (no DB / no `server-only`) so it is
 * unit-testable. A fixture only counts for a pairing when both sides tipped it.
 */
export function computeDuels(scores: DuelScore[], me: string): DuelRecord[] {
  const byFixture = new Map<string, Map<string, number>>();
  for (const s of scores) {
    let perUser = byFixture.get(s.fixtureId);
    if (!perUser) {
      perUser = new Map();
      byFixture.set(s.fixtureId, perUser);
    }
    perUser.set(s.userId, s.points);
  }

  const records = new Map<string, DuelRecord>();
  for (const perUser of byFixture.values()) {
    const mine = perUser.get(me);
    if (mine === undefined) continue;
    for (const [userId, points] of perUser) {
      if (userId === me) continue;
      const record = records.get(userId) ?? { opponentId: userId, wins: 0, losses: 0, draws: 0 };
      if (mine > points) record.wins++;
      else if (mine < points) record.losses++;
      else record.draws++;
      records.set(userId, record);
    }
  }

  return [...records.values()];
}
