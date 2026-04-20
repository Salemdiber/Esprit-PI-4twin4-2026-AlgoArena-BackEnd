import { Test, TestingModule } from '@nestjs/testing';
import { PlagiarismDetectionService } from './plagiarism-detection.service';

describe('PlagiarismDetectionService', () => {
  let service: PlagiarismDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlagiarismDetectionService],
    }).compile();

    service = module.get<PlagiarismDetectionService>(
      PlagiarismDetectionService,
    );
  });

  it('should detect exact matching code (hash)', async () => {
    const code = `
function solution(n) {
    let result = 0;
    for (let i = 0; i < n; i++) {
        result += i;
    }
    return result;
}
        `;

    const result = await service.detectPlagiarism(code, code, 'user1');

    expect(result.techniques.hashMatch.similarity).toBe(1.0);
    expect(result.overallSimilarity).toBeGreaterThan(90);
  });

  it('should detect variable renaming plagiarism', async () => {
    const reference = `
function solution(n) {
    let result = 0;
    for (let i = 0; i < n; i++) {
        result += i;
    }
    return result;
}
        `;

    const plagiarized = `
function solve(x) {
    let sum = 0;
    for (let j = 0; j < x; j++) {
        sum += j;
    }
    return sum;
}
        `;

    const result = await service.detectPlagiarism(
      reference,
      plagiarized,
      'user2',
    );

    expect(result.isSuspicious).toBe(true);
    expect(
      result.techniques.aiPatternDetection.detectedPatterns.length,
    ).toBeGreaterThan(0);
    expect(
      result.techniques.aiPatternDetection.detectedPatterns.some(
        (p) => p.type === 'variable_renaming',
      ),
    ).toBe(true);
  });

  it('should detect whitespace manipulation', async () => {
    const reference = `function solution(n){let r=0;for(let i=0;i<n;i++){r+=i;}return r;}`;

    const formatted = `
function solution(n) {
    let r = 0;
    for (let i = 0; i < n; i++) {
        r += i;
    }
    return r;
}
        `;

    const result = await service.detectPlagiarism(
      reference,
      formatted,
      'user3',
    );

    expect(result.techniques.hashMatch.similarity).toBeGreaterThan(0.9);
    expect(result.isSuspicious).toBe(true);
  });

  it('should NOT detect legit different solutions as plagiarism', async () => {
    const solution1 = `
function solution(n) {
    return n * (n + 1) / 2;
}
        `;

    const solution2 = `
function solution(n) {
    let sum = 0;
    for (let i = 1; i <= n; i++) {
        sum += i;
    }
    return sum;
}
        `;

    const result = await service.detectPlagiarism(
      solution1,
      solution2,
      'user4',
    );

    expect(result.isSuspicious).toBe(false);
    expect(result.recommendation).toBe('clear');
    expect(result.overallSimilarity).toBeLessThan(60);
  });

  it('should detect AST structural similarity', async () => {
    const code1 = `
function sum(arr) {
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
        total += arr[i];
    }
    return total;
}
        `;

    const code2 = `
function getSum(numbers) {
    let total = 0;
    for (let i = 0; i < numbers.length; i++) {
        total += numbers[i];
    }
    return total;
}
        `;

    const result = await service.detectPlagiarism(code1, code2, 'user5');

    expect(result.techniques.astComparison.similarity).toBeGreaterThan(0.8);
  });

  it('should detect token-based similarity (MOSS-like)', async () => {
    const code1 = `
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}
        `;

    const code2 = `
function fib(x) {
    if (x <= 1) return x;
    return fib(x - 1) + fib(x - 2);
}
        `;

    const result = await service.detectPlagiarism(code1, code2, 'user6');

    expect(result.techniques.tokenSimilarity.similarity).toBeGreaterThan(0.7);
  });

  it('should handle Python code analysis gracefully', async () => {
    const pythonCode1 = `
def solution(n):
    result = 0
    for i in range(n):
        result += i
    return result
        `;

    const pythonCode2 = `
def solve(x):
    sum_total = 0
    for j in range(x):
        sum_total += j
    return sum_total
        `;

    // Note: This may not work perfectly with Python due to Babel being JS-focused
    // But the service should handle it gracefully
    const result = await service.detectPlagiarism(
      pythonCode1,
      pythonCode2,
      'user7',
    );

    expect(result.overallSimilarity).toBeGreaterThan(0);
    expect(result.techniques).toBeDefined();
  });

  it('should report multiple suspicious indicators', async () => {
    const code = `
function solution(n) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
        sum += i;
    }
    return sum;
}
        `;

    const result = await service.detectPlagiarism(code, code, 'user8');

    expect(result.details.length).toBeGreaterThan(0);
    expect(
      result.details.some((d) => d.includes('⚠️') || d.includes('✅')),
    ).toBe(true);
  });

  it('should provide detailed pattern analysis', async () => {
    const reference = `
const solution = (n) => {
    let result = 0;
    for (let i = 1; i <= n; i++) {
        if (i % 2 === 0) result += i;
    }
    return result;
};
        `;

    const plagiarized = `
const solve = (x) => {
    let sum = 0;
    for (let j = 1; j <= x; j++) {
        if (j % 2 === 0) sum += j;
    }
    return sum;
};
        `;

    const result = await service.detectPlagiarism(
      reference,
      plagiarized,
      'user9',
    );

    const aiResult = result.techniques.aiPatternDetection;
    expect(aiResult.detectedPatterns.length).toBeGreaterThan(0);
    expect(aiResult.suspiciousIndicators.length).toBeGreaterThan(0);
  });
});
