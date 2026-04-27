import { xpToRank, RANK_CONFIG } from './user.service';

describe('xpToRank', () => {
  it('returns lowest rank for 0 xp', () => {
    const rank = xpToRank(0);
    expect(rank).toBe(RANK_CONFIG[0].name);
  });

  it('returns higher ranks for larger xp', () => {
    const first = xpToRank(RANK_CONFIG[1].xpRequired + 10);
    expect(first).toBe(RANK_CONFIG[1].name);
    const top = xpToRank(1000000);
    expect(top).toBe(RANK_CONFIG[RANK_CONFIG.length - 1].name);
  });
});
