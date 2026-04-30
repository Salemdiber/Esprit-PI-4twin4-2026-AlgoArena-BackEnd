import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import { BattlesService } from './battle.service';
import { ChallengeService } from '../challenges/challenge.service';
import { DockerExecutionService } from '../judge/services/docker-execution.service';
import { AIAnalysisService } from '../judge/services/ai-analysis.service';
import { BotDifficulty } from './battle.enums';

export interface AiSubmissionResult {
  passed: boolean;
  passedCount: number;
  total: number;
  executionTimeMs: number;
  timeComplexity: string;
  spaceComplexity: string;
  codeQualityScore: number;
  score: number;
  criteria: string[];
  model: string;
  language: 'javascript' | 'python';
  botDifficulty: BotDifficulty;
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
    private readonly i18n: I18nService,
  ) {
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
      this.provider = 'unknown';
      this.apiKey = undefined;
      this.baseUrl =
        this.config.get<string>('GROK_API_BASE_URL') || 'https://api.x.ai/v1';
      this.model = this.config.get<string>('GROK_MODEL') || 'grok-2-latest';
    }
  }

  private tr(key: string, args?: Record<string, unknown>): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang, args });
  }

  async submitAiSolution(
    battleId: string,
    language: 'javascript' | 'python' = 'javascript',
  ): Promise<AiSubmissionResult> {
    if (!battleId) {
      throw new BadRequestException(this.tr('battleAi.battleIdRequired'));
    }

    try {
      const battle = await this.battlesService.findOne(battleId);
      if (!battle?.challengeId) {
        throw new BadRequestException(this.tr('battleAi.missingChallengeId'));
      }

      const challenge = await this.challengeService.findById(
        battle.challengeId,
      );
      if (!challenge) {
        throw new BadRequestException(this.tr('battleAi.challengeNotFound'));
      }

      const testCases = (challenge.testCases || []).map((tc) => ({
        input: tc.input,
        expectedOutput: tc.output,
      }));

      if (!testCases.length) {
        throw new BadRequestException(this.tr('battleAi.noTestCases'));
      }

      const botDifficulty = battle?.botDifficulty as BotDifficulty | undefined;
      const effectiveDifficulty =
        botDifficulty ||
        this.mapChallengeDifficultyToBotDifficulty(
          (challenge as any)?.difficulty,
        );

      const code = await this.generateSolution(
        challenge,
        language,
        effectiveDifficulty,
      );
      const execution = await this.dockerService.executeCode(
        code,
        language,
        testCases,
        {
          challengeTitle: challenge.title,
          challengeDescription: challenge.description || '',
          challengeId: String((challenge as any)._id || battle.challengeId),
          userId: 'ai-opponent',
        },
      );

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

      const codeQualityScore = Number((details as any).codeQualityScore ?? 65);

      const score = this.calculateScore({
        maxPoints: Number(challenge.xpReward || 500),
        passedCount,
        total,
        executionTimeMs: execution.executionTimeMs,
        timeLimitSeconds: 900,
        timeComplexity: details.timeComplexity,
        spaceComplexity: details.spaceComplexity,
        codeQualityScore,
      });

      const criteria = [
        `Pass rate: ${passedCount}/${total}`,
        `Execution time: ${execution.executionTimeMs}ms`,
        `Time complexity: ${details.timeComplexity || 'Unknown'}`,
        `Space complexity: ${details.spaceComplexity || 'Unknown'}`,
        `Code quality: ${Math.round(codeQualityScore)}/100`,
      ];

      return {
        passed,
        passedCount,
        total,
        executionTimeMs: execution.executionTimeMs,
        timeComplexity: details.timeComplexity || 'Unknown',
        spaceComplexity: details.spaceComplexity || 'Unknown',
        codeQualityScore: Math.round(codeQualityScore),
        score,
        criteria,
        model: this.model,
        language,
        botDifficulty: effectiveDifficulty,
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
        codeQualityScore: 0,
        score: 0,
        criteria: [message],
        model: this.model,
        language,
        botDifficulty: BotDifficulty.MEDIUM,
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
    codeQualityScore?: number;
  }): number {
    const {
      maxPoints,
      passedCount,
      total,
      executionTimeMs,
      timeLimitSeconds,
      timeComplexity,
      spaceComplexity,
      codeQualityScore,
    } = params;
    if (!total) return 0;

    const correctnessFactor = Math.max(0, Math.min(1, passedCount / total));
    const complexityScore = Math.round(
      (this.mapComplexityScore(timeComplexity) +
        this.mapComplexityScore(spaceComplexity)) /
        2,
    );
    const solveSeconds = Math.max(0, executionTimeMs / 1000);
    const runtimeScore = Math.round(
      100 * (1 - Math.min(1, solveSeconds / (timeLimitSeconds || 900))),
    );
    const quality = Number.isFinite(Number(codeQualityScore))
      ? Number(codeQualityScore)
      : 60;
    const qualityScore = Math.max(0, Math.min(100, Math.round(quality)));

    // Priority: complexity -> runtime -> code quality (then gated by correctness)
    const composite =
      complexityScore * 0.45 + runtimeScore * 0.35 + qualityScore * 0.2;
    return Math.max(
      0,
      Math.round((maxPoints || 500) * (composite / 100) * correctnessFactor),
    );
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

  private async generateSolution(
    challenge: any,
    language: 'javascript' | 'python',
    difficulty: BotDifficulty,
  ): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn(
        'GROK_API_KEY or GROQ_API_KEY is not configured, using fallback solution',
      );
      return this.fallbackSolution(challenge, language);
    }

    const starter = challenge?.starterCode?.[language] || '';
    const constraints = Array.isArray(challenge.constraints)
      ? challenge.constraints.join('\n')
      : '';
    const examples = Array.isArray(challenge.examples)
      ? JSON.stringify(challenge.examples)
      : '[]';
    const tests = Array.isArray(challenge.testCases)
      ? JSON.stringify(challenge.testCases.slice(0, 6))
      : '[]';

    const systemPrompt =
      'You are a competitive programming assistant. Return only the final code. Do not include markdown or explanations.';

    const difficultyDirectives: Record<
      BotDifficulty,
      { extra: string; temperature: number; maxTokens: number }
    > = {
      [BotDifficulty.EASY]: {
        extra:
          'Difficulty: EASY BOT. Prefer the simplest correct approach. Avoid heavy optimizations and advanced tricks. Keep code short and straightforward even if performance is not optimal, but it MUST pass the provided tests.',
        temperature: 0.12,
        maxTokens: 1200,
      },
      [BotDifficulty.MEDIUM]: {
        extra:
          'Difficulty: MEDIUM BOT. Write a correct solution with reasonable efficiency. Prefer common patterns/data structures. Avoid over-optimizing micro details. It MUST pass the provided tests.',
        temperature: 0.22,
        maxTokens: 1600,
      },
      [BotDifficulty.HARD]: {
        extra:
          'Difficulty: HARD BOT. Aim for an efficient and robust solution, but keep it readable. Do not use obscure hacks or extreme golf. It MUST pass the provided tests, but you do not need to be the absolute fastest possible.',
        temperature: 0.32,
        maxTokens: 1800,
      },
    };

    const directive =
      difficultyDirectives[difficulty] ||
      difficultyDirectives[BotDifficulty.MEDIUM];
    const userPrompt = [
      `Solve the following challenge in ${language}.`,
      `Title: ${challenge.title}`,
      `Description: ${challenge.description}`,
      constraints ? `Constraints:\n${constraints}` : null,
      `Examples: ${examples}`,
      `TestCases: ${tests}`,
      starter ? `StarterCode:\n${starter}` : null,
      directive.extra,
      'Return a complete solution that matches the starter code signature if provided.',
    ]
      .filter(Boolean)
      .join('\n\n');

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
          temperature: directive.temperature,
          max_tokens: directive.maxTokens,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.warn(
          `AI API unavailable for ${this.provider} (${this.baseUrl}); using fallback solution: ${response.status} ${errorText}`,
        );
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
      this.logger.warn(
        `AI generation unavailable for ${this.provider} (${this.baseUrl}); using fallback solution: ${error?.message || error}`,
      );
      return this.fallbackSolution(challenge, language);
    }
  }

  private fallbackSolution(
    challenge: any,
    language: 'javascript' | 'python',
  ): string {
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

  private mapChallengeDifficultyToBotDifficulty(value?: string): BotDifficulty {
    const v = String(value || '')
      .toLowerCase()
      .trim();
    if (v === 'easy' || v === 'eas' || v === 'beginner')
      return BotDifficulty.EASY;
    if (v === 'hard' || v === 'expert') return BotDifficulty.HARD;
    if (v === 'medium' || v === 'med') return BotDifficulty.MEDIUM;
    // Handles older enum values like 'EASY'/'MEDIUM'/'HARD'
    if (v === 'easy') return BotDifficulty.EASY;
    if (v === 'medium') return BotDifficulty.MEDIUM;
    if (v === 'hard') return BotDifficulty.HARD;
    return BotDifficulty.MEDIUM;
  }
}
