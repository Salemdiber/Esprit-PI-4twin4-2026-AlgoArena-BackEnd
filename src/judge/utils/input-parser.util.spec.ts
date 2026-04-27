import { parseInputArguments, parseExpectedOutput } from './input-parser.util';

describe('input-parser.util', () => {
  test('parses JSON input string to object', () => {
    const res = parseInputArguments('[1,2,3]');
    expect(Array.isArray(res)).toBe(true);
    expect(res[0]).toEqual([1,2,3]);
  });

  test('returns tokens for space-separated raw string', () => {
    const res = parseInputArguments('not json');
    expect(res).toEqual(['not', 'json']);
  });

  test('parseExpectedOutput returns structured value', () => {
    const out = parseExpectedOutput('[4,5]');
    expect(Array.isArray(out)).toBe(true);
  });
});
