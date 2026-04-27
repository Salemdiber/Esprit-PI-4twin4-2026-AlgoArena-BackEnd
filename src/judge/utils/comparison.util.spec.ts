import { isDeepEqual, stableStringify } from './comparison.util';

describe('comparison.util', () => {
  test('stableStringify sorts object keys and compares deeply', () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(isDeepEqual(a, b)).toBe(true);
  });

  test('different values are not equal', () => {
    expect(isDeepEqual('foo', 'bar')).toBe(false);
  });
});
