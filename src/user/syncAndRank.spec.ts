import { xpToRank } from './user.service';

describe('user helpers', () => {
  test('xpToRank boundaries', () => {
    expect(xpToRank(0)).toBeDefined();
    expect(xpToRank(1000000)).toBeDefined();
  });
});
