import { detectFunctionName } from './function-detection.util';

describe('function-detection.util', () => {
  test('detects named function (javascript)', () => {
    const code = `function solution(a){return a}`;
    const name = detectFunctionName(code, 'javascript');
    expect(name).toBe('solution');
  });

  test('returns null when no function', () => {
    const name = detectFunctionName("const x = 1;", 'javascript');
    expect(name).toBeNull();
  });
});
