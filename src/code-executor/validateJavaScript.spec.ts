import { CodeExecutorService } from './code-executor.service';

describe('CodeExecutorService.validateJavaScript more branches', () => {
  const svc = new CodeExecutorService();

  test('throws when no language supported', async () => {
    await expect(svc.validateCode('x=1', 'ruby' as any, [{ input: '1', output: '1' }])).rejects.toThrow();
  });

  test('javascript function with console output and return value', async () => {
    const code = `function solution(input){ console.log('out'); return 'ok'; }`;
    const res = await svc.validateCode(code, 'javascript', [{ input: '1', output: 'ok' }]);
    expect(res.passed).toBeTruthy();
  });
});
