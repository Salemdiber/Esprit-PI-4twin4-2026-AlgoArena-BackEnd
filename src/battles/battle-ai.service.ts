import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BattlesService } from './battle.service';
import { ChallengeService } from '../challenges/challenge.service';
import { DockerExecutionService } from '../judge/services/docker-execution.service';
import { AIAnalysisService } from '../judge/services/ai-analysis.service';

export interface AiSubmissionResult {
  passed: boolean;
  passedCount: number;
  total: number;
  executionTimeMs: number;
  timeComplexity: string;
  spaceComplexity: string;
  score: number;
  criteria: string[];
  model: string;
  language: 'javascript' | 'python';
  results: any[];
  error: { type: string; message: string; line: number | null } | null;
}

@Injectable()
export class BattleAiService {
  private readonly logger = new Logger(BattleAiService.name);
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly provider: 'grok' | 'groq' | 'unknown';

  constructor(
    private readonly config: ConfigService,
    private readonly battlesService: BattlesService,
    private readonly challengeService: ChallengeService,
    private readonly dockerService: DockerExecutionService,
    private readonly analysisService: AIAnalysisService,
  ) {
    const grokKey = this.config.get<string>('GROK_API_KEY');
    const groqKey = this.config.get<string>('GROQ_API_KEY');

    if (grokKey) {
      this.provider = 'grok';
      this.apiKey = grokKey;
      this.baseUrl = this.config.get<string>('GROK_API_BASE_URL') || 'https://api.x.ai/v1';
      this.model = this.config.get<string>('GROK_MODEL') || 'grok-2-latest';
    } else if (groqKey) {
      this.provider = 'groq';
      this.apiKey = groqKey;
      this.baseUrl = this.config.get<string>('GROQ_API_BASE_URL') || 'https://api.groq.com/openai/v1';
      this.model = this.config.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
    } else {
      this.provider = 'unknown';
      this.apiKey = undefined;
      this.baseUrl = this.config.get<string>('GROK_API_BASE_URL') || 'https://api.x.ai/v1';
      this.model = this.config.get<string>('GROK_MODEL') || 'grok-2-latest';
    }
  }

  async submitAiSolution(battleId: string, language: 'javascript' | 'python' = 'javascript'): Promise<AiSubmissionResult> {
    if (!battleId) {
      throw new BadRequestException('battleId is required');
    }

    try {
      const battle = await this.battlesService.findOne(battleId);
      if (!battle?.challengeId) {
        throw new BadRequestException('Battle is missing a challengeId');
      }

      const challenge = await this.challengeService.findById(battle.challengeId);
      if (!challenge) {
        throw new BadRequestException('Challenge not found');
      }

      const testCases = (challenge.testCases || []).map((tc) => ({
        input: tc.input,
        expectedOutput: tc.output,
      }));

      if (!testCases.length) {
        throw new BadRequestException('Challenge has no test cases');
      }

      const code = await this.generateSolution(challenge, language);
      const execution = await this.dockerService.executeCode(code, language, testCases, {
        challengeTitle: challenge.title,
        challengeDescription: challenge.description || '',
        challengeId: String((challenge as any)._id || battle.challengeId),
        userId: 'ai-opponent',
      });

      const passedCount = execution.results.filter((r) => r.passed).length;
      const total = testCases.length;
      const passed = execution.error ? false : passedCount === total;

      const details = await this.analysisService.analyzeSubmissionDetails(
        code,
        language,
        challenge.title,
        challenge.description || '',
        execution.results,
      );

      const score = this.calculateScore({
        maxPoints: Number(challenge.xpReward || 500),
        passedCount,
        total,
        executionTimeMs: execution.executionTimeMs,
        timeLimitSeconds: 900,
        timeComplexity: details.timeComplexity,
        spaceComplexity: details.spaceComplexity,
      });

      const criteria = [
        `Pass rate: ${passedCount}/${total}`,
        `Execution time: ${execution.executionTimeMs}ms`,
        `Time complexity: ${details.timeComplexity || 'Unknown'}`,
        `Space complexity: ${details.spaceComplexity || 'Unknown'}`,
      ];

      return {
        passed,
        passedCount,
        total,
        executionTimeMs: execution.executionTimeMs,
        timeComplexity: details.timeComplexity || 'Unknown',
        spaceComplexity: details.spaceComplexity || 'Unknown',
        score,
        criteria,
        model: this.model,
        language,
        results: execution.results,
        error: execution.error,
      };
    } catch (error: any) {
      const message = error?.message || 'AI submission failed';
      this.logger.error(`AI submission fallback: ${message}`);
      return {
        passed: false,
        passedCount: 0,
        total: 0,
        executionTimeMs: 0,
        timeComplexity: 'Unknown',
        spaceComplexity: 'Unknown',
        score: 0,
        criteria: [message],
        model: this.model,
        language,
        results: [],
        error: { type: 'AIError', message, line: null },
      };
    }
  }

  private calculateScore(params: {
    maxPoints: number;
    passedCount: number;
    total: number;
    executionTimeMs: number;
    timeLimitSeconds: number;
    timeComplexity?: string;
    spaceComplexity?: string;
  }): number {
    const {
      maxPoints,
      passedCount,
      total,
      executionTimeMs,
      timeLimitSeconds,
      timeComplexity,
      spaceComplexity,
    } = params;
    if (!total) return 0;

    const exactitude = (passedCount / total) * 100;
    const complexityScore = Math.round((
      this.mapComplexityScore(timeComplexity) + this.mapComplexityScore(spaceComplexity)
    ) / 2);
    const styleScore = 60;
    const solveSeconds = Math.max(0, Math.round(executionTimeMs / 1000));
    const timeBonus = Math.max(0, Math.round(10 * (1 - Math.min(1, solveSeconds / (timeLimitSeconds || 900)))));
    const composite = exactitude * 0.4 + complexityScore * 0.3 + styleScore * 0.2 + timeBonus;
    return Math.max(0, Math.round((maxPoints || 500) * (composite / 100)));
  }

  private mapComplexityScore(value?: string): number {
    const label = String(value || '').toLowerCase();
    if (label.includes('o(1)')) return 100;
    if (label.includes('o(log')) return 90;
    if (label.includes('o(n log')) return 75;
    if (label.includes('o(n)')) return 80;
    if (label.includes('o(n^2') || label.includes('o(n2)')) return 55;
    if (label.includes('o(n^3') || label.includes('o(n3)')) return 35;
    return 60;
  }

  private async generateSolution(challenge: any, language: 'javascript' | 'python'): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GROK_API_KEY or GROQ_API_KEY is not configured, using fallback solution');
      return this.fallbackSolution(challenge, language);
    }

    const starter = challenge?.starterCode?.[language] || '';
    const constraints = Array.isArray(challenge.constraints) ? challenge.constraints.join('\n') : '';
    const examples = Array.isArray(challenge.examples) ? JSON.stringify(challenge.examples) : '[]';
    const tests = Array.isArray(challenge.testCases) ? JSON.stringify(challenge.testCases.slice(0, 6)) : '[]';

    const systemPrompt = 'You are a competitive programming assistant. Return only the final code. Do not include markdown or explanations.';
    const userPrompt = [
      `Solve the following challenge in ${language}.`,
      `Title: ${challenge.title}`,
      `Description: ${challenge.description}`,
      constraints ? `Constraints:\n${constraints}` : null,
      `Examples: ${examples}`,
      `TestCases: ${tests}`,
      starter ? `StarterCode:\n${starter}` : null,
      'Return a complete solution that matches the starter code signature if provided.',
    ].filter(Boolean).join('\n\n');

    try {
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
          temperature: 0.2,
          max_tokens: 1800,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(`AI API error: ${response.status} ${errorText}`);
        return this.fallbackSolution(challenge, language);
      }

      const payload = await response.json().catch(() => null);
      const raw = payload?.choices?.[0]?.message?.content || '';
      const cleaned = this.stripCodeFences(raw);

      if (!cleaned.trim()) {
        return this.fallbackSolution(challenge, language);
      }

      return cleaned;
    } catch (error: any) {
      this.logger.error(`AI generation failed: ${error?.message || error}`);
      return this.fallbackSolution(challenge, language);
    }
  }

  private fallbackSolution(challenge: any, language: 'javascript' | 'python'): string {
    const reference = challenge?.referenceSolution || '';
    if (reference.trim()) return reference;

    const starter = challenge?.starterCode?.[language] || '';
    if (starter.trim()) return starter;

    if (language === 'python') {
      return 'def solve(*args):\n    return None\n';
    }
    return 'function solve() {\n  return null;\n}\n';
  }

  private stripCodeFences(content: string): string {
    const trimmed = content.trim();
    const fence = trimmed.match(/```(?:\w+)?\s*([\s\S]*?)```/);
    return (fence ? fence[1] : trimmed).trim();
  }
}
