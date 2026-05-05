import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TestCase, DockerExecutionResponse, ExecutionResult } from './docker-execution.service';

/**
 * Fallback code execution service that uses Grok (x.ai) or Groq LLM APIs
 * to evaluate user code against test cases when Docker is unavailable
 * (e.g. deployed environments without Docker).
 *
 * The LLM is asked to mentally execute the code for each test case and
 * return structured JSON results. This is NOT a sandbox — it relies on
 * the model's ability to trace code correctly. It is used as a best-effort
 * fallback only when the Docker sandbox is unreachable.
 */
@Injectable()
export class GrokExecutionService {
  private readonly logger = new Logger(GrokExecutionService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly provider: 'grok' | 'groq' | 'none';

  constructor(private readonly config: ConfigService) {
    const grokKey = this.config.get<string>('GROK_API_KEY');
    const groqKey = this.config.get<string>('GROQ_API_KEY');

    if (grokKey) {
      this.provider = 'grok';
      this.apiKey = grokKey;
      this.baseUrl =
        this.config.get<string>('GROK_API_BASE_URL') || 'https://api.x.ai/v1';
      this.model = this.config.get<string>('GROK_MODEL') || 'grok-2-latest';
    } else if (groqKey) {
      this.provider = 'groq';
      this.apiKey = groqKey;
      this.baseUrl =
        this.config.get<string>('GROQ_API_BASE_URL') ||
        'https://api.groq.com/openai/v1';
      this.model =
        this.config.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
    } else {
      this.provider = 'none';
      this.apiKey = undefined;
      this.baseUrl = 'https://api.x.ai/v1';
      this.model = 'grok-2-latest';
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async executeCode(
    userCode: string,
    language: string,
    testCases: TestCase[],
  ): Promise<DockerExecutionResponse> {
    const startedAt = Date.now();

    if (!this.apiKey) {
      return {
        results: [],
        executionTimeMs: Date.now() - startedAt,
        error: {
          type: 'ServiceUnavailable',
          message:
            'Neither Docker nor AI execution is available. Please configure GROK_API_KEY or GROQ_API_KEY.',
          line: null,
        },
      };
    }

    try {
      const testCaseDescriptions = testCases
        .map(
          (tc, i) =>
            `Test ${i + 1}: input=${JSON.stringify(tc.input)}, expectedOutput=${JSON.stringify(tc.expectedOutput)}`,
        )
        .join('\n');

      const systemPrompt = `You are a precise code execution engine. You must mentally execute the provided code for each test case and return the EXACT output the code would produce.

CRITICAL RULES:
- Execute the code EXACTLY as written — do NOT fix bugs, do NOT optimize, do NOT modify anything.
- If the code has a runtime error (division by zero, index out of bounds, etc.), report the error for that test case.
- If the code has a syntax error, report it.
- The "output" field must contain the EXACT return value of the function, matching the type (number, string, array, object, boolean, null).
- Compare your computed output with the expectedOutput to set "passed" to true/false.
- Return ONLY valid JSON, no markdown fences, no explanation.

Response format (strict JSON array):
[
  {
    "testCase": 1,
    "output": <actual return value>,
    "passed": true/false,
    "error": null or "error message string",
    "executionTimeMs": <estimated ms, use 1-50>
  }
]`;

      const userPrompt = `Language: ${language}

Code:
\`\`\`
${userCode}
\`\`\`

Test Cases:
${testCaseDescriptions}

Execute the code for each test case and return the JSON array of results. Remember: execute the code AS-IS, do not fix it.`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(
          `Grok execution API error (${this.provider}): ${response.status} ${errorText}`,
        );
        return {
          results: [],
          executionTimeMs: Date.now() - startedAt,
          error: {
            type: 'AIExecutionError',
            message: `AI execution service returned ${response.status}. Please try again later.`,
            line: null,
          },
        };
      }

      const payload = await response.json().catch(() => null);
      const rawContent = payload?.choices?.[0]?.message?.content || '';
      const parsed = this.parseResults(rawContent, testCases);

      if (!parsed) {
        this.logger.error(
          `Failed to parse Grok execution response: ${rawContent.slice(0, 500)}`,
        );
        return {
          results: [],
          executionTimeMs: Date.now() - startedAt,
          error: {
            type: 'AIExecutionError',
            message:
              'AI execution returned an unparseable response. Please try again.',
            line: null,
          },
        };
      }

      return {
        results: parsed,
        executionTimeMs: Date.now() - startedAt,
        error: this.extractGlobalError(parsed),
      };
    } catch (err: any) {
      this.logger.error(`Grok execution failed: ${err?.message || err}`);
      return {
        results: [],
        executionTimeMs: Date.now() - startedAt,
        error: {
          type: 'AIExecutionError',
          message: `AI execution failed: ${err?.message || 'Unknown error'}`,
          line: null,
        },
      };
    }
  }

  private parseResults(
    rawContent: string,
    testCases: TestCase[],
  ): ExecutionResult[] | null {
    try {
      // Strip markdown code fences if present
      let cleaned = rawContent.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
      }

      const arr = JSON.parse(cleaned);
      if (!Array.isArray(arr)) return null;

      return arr.map((item: any, index: number) => {
        const tc = testCases[index];
        const output = item.output ?? item.actualOutput ?? null;
        const expected = tc?.expectedOutput ?? null;
        const error = item.error || null;
        // Trust the model's passed flag, but verify if output matches expected
        const passed = error
          ? false
          : item.passed ?? this.looseEquals(output, expected);

        return {
          testCase: index + 1,
          input: tc?.input ?? item.input ?? null,
          expected,
          output,
          got: output,
          expectedOutput: expected,
          actualOutput: output,
          passed,
          error,
          executionTimeMs: Number(item.executionTimeMs) || 5,
          executionTime: `${Number(item.executionTimeMs) || 5}ms`,
        };
      });
    } catch {
      return null;
    }
  }

  private looseEquals(actual: unknown, expected: unknown): boolean {
    if (actual === expected) return true;
    try {
      return JSON.stringify(actual) === JSON.stringify(expected);
    } catch {
      return String(actual).trim() === String(expected).trim();
    }
  }

  private extractGlobalError(
    results: ExecutionResult[],
  ): DockerExecutionResponse['error'] {
    // If ALL results have errors, treat it as a global error
    if (results.length > 0 && results.every((r) => r.error)) {
      return {
        type: 'RuntimeError',
        message: results[0].error || 'All test cases failed with errors',
        line: null,
      };
    }
    return null;
  }
}
