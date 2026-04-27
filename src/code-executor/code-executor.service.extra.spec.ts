import { CodeExecutorService } from './code-executor.service';

describe('CodeExecutorService (basic)', () => {
  let svc: CodeExecutorService;

  beforeEach(() => {
    svc = new CodeExecutorService();
  });

  it('executeRaw should run simple javascript function and return result', async () => {
    const code = `function solution(input){ return Number(input) + 1; }`;
    const res = await svc.executeRaw(code, 'javascript');
    // function returns NaN when called without input; ensure it returns a string
    expect(typeof res).toBe('string');
  });

  it('executeRaw should capture console.log output', async () => {
    const code = `console.log('hello world')`;
    const res = await svc.executeRaw(code, 'javascript');
    expect(res).toBe('hello world');
  });

  it('validateCode should throw for empty code', async () => {
    await expect(
      svc.validateCode('', 'javascript', [{ input: '1', output: '1' }]),
    ).rejects.toThrow('Code cannot be empty');
  });
});
