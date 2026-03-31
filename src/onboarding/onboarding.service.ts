import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { CacheService } from '../cache/cache.service';
import * as crypto from 'crypto';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SolutionInput {
  problemId: string;
  title: string;
  difficulty: string; // 'EASY' | 'MEDIUM' | 'HARD'
  code: string;
  language: string;
  solved: boolean;
}

export interface ProblemScore {
  problemId: string;
  title: string;
  difficulty: string;
  exactitude: number; // 0-100
  complexity: number; // 0-100 (time efficiency)
  space: number;      // 0-100 (space/memory efficiency)
  timeComplexity?: string; // e.g. "O(n)", optional
  complexite?: string; // french label alias for timeComplexity
  style: number;      // 0-100
  composite: number;  // 0-100 weighted
  notes: string;
}

export interface ClassificationResult {
  rank: string;
  label: string;
  color: string;
  gradient: [string, string];
  xp: number;
  totalScore: number;
  breakdown: ProblemScore[];
  aiScores: { exactitude: number; complexity: number; space: number; style: number };
  message: string;
}

// ─── Rank tiers (highest first) ───────────────────────────────────────────────

const RANK_TIERS = [
  { min: 85, rank: 'DIAMOND', label: 'Diamond', color: '#a855f7', gradient: ['#a855f7', '#7c3aed'] as [string, string], xp: 500 },
  { min: 70, rank: 'PLATINUM', label: 'Platinum', color: '#22d3ee', gradient: ['#22d3ee', '#06b6d4'] as [string, string], xp: 380 },
  { min: 55, rank: 'GOLD', label: 'Gold', color: '#facc15', gradient: ['#facc15', '#f59e0b'] as [string, string], xp: 250 },
  { min: 35, rank: 'SILVER', label: 'Silver', color: '#c0c0c0', gradient: ['#c0c0c0', '#a8a8a8'] as [string, string], xp: 120 },
  { min: 0, rank: 'BRONZE', label: 'Bronze', color: '#cd7f32', gradient: ['#cd7f32', '#a0522d'] as [string, string], xp: 0 },
];

const RANK_MESSAGES: Record<string, string> = {
  DIAMOND: 'Exceptional! Your code correctness, efficiency and style are top-tier.',
  PLATINUM: 'Outstanding! Clean, efficient solutions delivered at pace.',
  GOLD: 'Solid work! Good correctness with room to further optimise.',
  SILVER: 'Good effort — keep sharpening your problem-solving instincts.',
  BRONZE: 'Every expert started somewhere — keep coding every day!',
};

// Starter code snippets to detect empty submissions
const STARTER_TOKENS = [
  '// your solution here',
  '# your solution here',
  '// write your solution here',
  '// start here',
  'pass',
  'return new int[]{}',
  'return 0.0',
  'return ""',
];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly groqApiKey = process.env.GROQ_API_KEY;
  private readonly groqModel = 'llama-3.1-8b-instant'; // Fast, cost-effective

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    if (!this.groqApiKey) {
      this.logger.warn('GROQ_API_KEY not set — AI scoring will be disabled');
    }
  }

  // ── Public entry point ──────────────────────────────────────────────────────

  async classifySolutions(
    solutions: SolutionInput[],
    totalSeconds: number,
  ): Promise<ClassificationResult> {
    // Check if AI classification is enabled in platform settings
    const settings = await this.settingsService.getSettings() as any;
    const aiEnabled = settings?.ollamaEnabled !== false; // default true (backward compat: ollamaEnabled controls AI)

    if (!aiEnabled || !this.groqApiKey) {
      this.logger.log('AI classification disabled or Groq API not configured — using rule-based placement');
      return this.ruleBased(solutions, totalSeconds);
    }

    // Score each problem with AI (in sequence to avoid rate limiting)
    const breakdown: ProblemScore[] = [];
    for (const sol of solutions) {
      const score = await this.scoreSolution(sol);
      breakdown.push(score);
    }

    // Weighted aggregate
    const solvedBreakdown = breakdown.filter((b) => b.composite > 0);
    let avgExactitude = 0;
    let avgComplexity = 0;
    let avgSpace = 0;
    let avgStyle = 0;

    if (solvedBreakdown.length > 0) {
      avgExactitude = solvedBreakdown.reduce((s, b) => s + b.exactitude, 0) / solvedBreakdown.length;
      avgComplexity = solvedBreakdown.reduce((s, b) => s + b.complexity, 0) / solvedBreakdown.length;
      avgSpace = solvedBreakdown.reduce((s, b) => s + (b.space ?? 50), 0) / solvedBreakdown.length;
      avgStyle = solvedBreakdown.reduce((s, b) => s + b.style, 0) / solvedBreakdown.length;
    }

    // Time bonus: 0-10 extra points — faster is better (max 15 min)
    const minutesUsed = totalSeconds / 60;
    const timeBonus = Math.max(0, Math.round(10 * (1 - minutesUsed / 15)));

    const totalScore = Math.round(
      avgExactitude * 0.40 +
      avgComplexity * 0.30 +
      avgStyle * 0.20 +
      timeBonus,  // up to 10% bonus
    );

    const tier = RANK_TIERS.find((t) => totalScore >= t.min) ?? RANK_TIERS[RANK_TIERS.length - 1];

    return {
      rank: tier.rank,
      label: tier.label,
      color: tier.color,
      gradient: tier.gradient,
      xp: tier.xp,
      totalScore,
      breakdown,
      aiScores: {
        exactitude: Math.round(avgExactitude),
        complexity: Math.round(avgComplexity),
        space: Math.round(avgSpace),
        style: Math.round(avgStyle),
      },
      message: RANK_MESSAGES[tier.rank],
    };
  }

  // ── Rule-based fallback (no AI) ───────────────────────────────────────────

  private ruleBased(solutions: SolutionInput[], totalSeconds: number): ClassificationResult {
    const solvedIds = solutions.filter((s) => s.solved).map((s) => s.problemId);
    const solved = solvedIds.length;
    const minutesUsed = totalSeconds / 60;

    let tierName: string;
    if (solved === 0) tierName = 'BRONZE';
    else if (solved === 1) tierName = minutesUsed <= 5 ? 'SILVER' : 'BRONZE';
    else if (solved === 2) tierName = minutesUsed <= 8 ? 'GOLD' : 'SILVER';
    else tierName = minutesUsed <= 7 ? 'DIAMOND' : minutesUsed <= 11 ? 'PLATINUM' : 'GOLD';

    const tier = RANK_TIERS.find((t) => t.rank === tierName) ?? RANK_TIERS[RANK_TIERS.length - 1];
    const baseScore = { DIAMOND: 90, PLATINUM: 75, GOLD: 60, SILVER: 40, BRONZE: 20 }[tierName] ?? 20;

    const breakdown: ProblemScore[] = solutions.map((s) => ({
      problemId: s.problemId,
      title: s.title,
      difficulty: s.difficulty,
      exactitude: s.solved ? baseScore : 0,
      complexity: s.solved ? 50 : 0,
      space: s.solved ? 50 : 0,
      timeComplexity: 'O(?)',
      complexite: 'O(?)',
      style: s.solved ? 50 : 0,
      composite: s.solved ? baseScore : 0,
      notes: s.solved ? 'Rule-based estimate (AI classification disabled).' : 'Not solved.',
    }));

    return {
      rank: tier.rank,
      label: tier.label,
      color: tier.color,
      gradient: tier.gradient,
      xp: tier.xp,
      totalScore: baseScore,
      breakdown,
      aiScores: { exactitude: baseScore, complexity: 50, space: 50, style: 50 },
      message: RANK_MESSAGES[tier.rank] + ' (AI classification disabled)',
    };
  }

  // ── Per-problem scoring ──────────────────────────────────────────────────────

  private async scoreSolution(sol: SolutionInput): Promise<ProblemScore> {
    const isEmpty =
      !sol.code ||
      sol.code.trim().length < 40 ||
      STARTER_TOKENS.some((t) => sol.code.toLowerCase().includes(t));

    if (!sol.solved || isEmpty) {
      return this.zeroScore(sol, 'Problem not solved or no meaningful code submitted.');
    }

    try {
      const prompt = this.buildPrompt(sol);
      const raw = await this.callGroq(prompt);
      const parsed = this.extractJson(raw);

      const exactitude = this.clamp(Number(parsed.exactitude) || 50);
      const complexity = this.clamp(Number(parsed.complexity) || 50);
      // space may be provided as 'space' or 'memory' or similar keys
      const rawSpace = Number(parsed.space ?? parsed.memory ?? (parsed as any).space_complexity ?? (parsed as any).spaceComplexity ?? NaN);
      const space = Number.isFinite(rawSpace) ? this.clamp(rawSpace) : 50;
      const style = this.clamp(Number(parsed.style) || 50);
      // parse optional time complexity notation (strings like O(n), O(n log n), etc.)
      const timeComplexity = String((parsed.complexityNotation ?? parsed.complexity_notation ?? parsed.timeComplexity ?? parsed.time_complexity ?? parsed.complexity_text ?? parsed.complexityStr ?? parsed.complexity) || '').trim() || 'O(?)';
      const composite = Math.round(exactitude * 0.40 + complexity * 0.30 + style * 0.25 + space * 0.05);

      return {
        problemId: sol.problemId,
        title: sol.title,
        difficulty: sol.difficulty,
        exactitude,
        complexity,
        space,
        timeComplexity,
        complexite: timeComplexity,
        style,
        composite,
        notes: String(parsed.notes ?? ''),
      };
    } catch (err) {
      this.logger.warn(`AI scoring failed for "${sol.title}": ${(err as Error)?.message}`);
      // Graceful fallback: difficulty-adjusted base score
      const base = sol.difficulty === 'HARD' ? 70 : sol.difficulty === 'MEDIUM' ? 60 : 50;
      return {
        problemId: sol.problemId,
        title: sol.title,
        difficulty: sol.difficulty,
        exactitude: base,
        complexity: 50,
        space: 50,
        timeComplexity: 'O(?)',
        complexite: 'O(?)',
        style: 50,
        composite: Math.round(base * 0.40 + 50 * 0.30 + 50 * 0.25 + 50 * 0.05),
        notes: 'AI analysis unavailable — baseline estimate applied.',
      };
    }
  }

  // ── Groq API interaction ────────────────────────────────────────────────────

  private buildPrompt(sol: SolutionInput): string {
    return `You are a senior software engineer evaluating a coding interview submission.

Problem: ${sol.title} (difficulty: ${sol.difficulty})
Language: ${sol.language}

Submitted solution:
\`\`\`${sol.language}
${sol.code}
\`\`\`

Score this solution on four axes, each from 0 to 100:
- exactitude: Is the algorithm logic correct? Would it pass all standard test cases? (0 = completely wrong, 100 = perfectly correct)
- complexity: Is the time complexity optimal or near-optimal for this problem? (0 = brute force, 100 = optimal)
- space: Is the memory usage / space complexity optimal or near-optimal? (0 = uses excessive memory, 100 = memory-optimal)
- style: Is the code readable, clean, idiomatic for the language? (0 = very messy, 100 = exemplary)

Also provide an optional field timeComplexity (string) with the big-O notation, for example: "O(1)", "O(n)", "O(n log n)", "O(n^2)". If uncertain, return "O(?)".

Output ONLY the JSON object below with no additional text, markdown, or explanation:
START_JSON_RESPONSE
{"exactitude": <0-100>, "complexity": <0-100>, "space": <0-100>, "timeComplexity": "O(n)", "style": <0-100>, "notes": "<one sentence>"}
END_JSON_RESPONSE`;
  }

  private async callGroq(prompt: string): Promise<string> {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    // Cache key derived from prompt
    try {
      const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
      const cacheKey = `groq:${promptHash}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.log('Groq cache hit');
        return cached;
      }
    } catch (e) {
      // cache failures should not block the request
      this.logger.warn('Groq cache check failed: ' + (e as Error).message);
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`,
      },
      body: JSON.stringify({
        model: this.groqModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 256,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Groq API ${res.status}: ${error}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content ?? '';

    // Save to cache (7 days)
    try {
      const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');
      const cacheKey = `groq:${promptHash}`;
      await this.cacheService.set(cacheKey, content, 60 * 60 * 24 * 7);
    } catch (e) {
      this.logger.warn('Groq cache save failed: ' + (e as Error).message);
    }
    return content;
  }

  private extractJson(raw: string): Record<string, unknown> {
    // First, try to extract content between delimiters
    const delimiterStart = 'START_JSON_RESPONSE';
    const delimiterEnd = 'END_JSON_RESPONSE';
    
    let jsonStr: string | null = null;
    const startIdx = raw.indexOf(delimiterStart);
    const endIdx = raw.indexOf(delimiterEnd);
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      // Extract between delimiters
      jsonStr = raw.substring(startIdx + delimiterStart.length, endIdx).trim();
    } else {
      // Fallback: find JSON object with brace matching, but validate structure
      const braceStart = raw.indexOf('{');
      if (braceStart === -1) throw new Error('No JSON object found in AI response');

      let braceCount = 0;
      let braceEnd = -1;
      for (let i = braceStart; i < raw.length; i++) {
        if (raw[i] === '{') braceCount++;
        if (raw[i] === '}') braceCount--;
        if (braceCount === 0) {
          braceEnd = i;
          break;
        }
      }

      if (braceEnd === -1) throw new Error('Malformed JSON in AI response: unmatched braces');
      jsonStr = raw.substring(braceStart, braceEnd + 1);
    }

    if (!jsonStr.trim()) throw new Error('No JSON content found in AI response');

    try {
      const parsed = JSON.parse(jsonStr);
      
      // Validate that the JSON has expected fields
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Expected JSON object');
      }
      if (!('exactitude' in parsed) || !('complexity' in parsed) || !('style' in parsed)) {
        throw new Error('Missing required fields: exactitude, complexity, style');
      }
      
      return parsed;
    } catch (e) {
      this.logger.error(`Failed to parse JSON: ${jsonStr}`);
      throw new Error(`Invalid JSON in AI response: ${(e as Error).message}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private clamp(n: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, n));
  }

  private zeroScore(sol: SolutionInput, notes: string): ProblemScore {
    return { problemId: sol.problemId, title: sol.title, difficulty: sol.difficulty, exactitude: 0, complexity: 0, space: 0, timeComplexity: 'O(?)', complexite: 'O(?)', style: 0, composite: 0, notes };
  }
}
