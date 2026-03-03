import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

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
  complexity: number; // 0-100
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
  aiScores: { exactitude: number; complexity: number; style: number };
  message: string;
}

// ─── Rank tiers (highest first) ───────────────────────────────────────────────

const RANK_TIERS = [
  { min: 85, rank: 'DIAMOND', label: '💎 Diamond', color: '#a855f7', gradient: ['#a855f7', '#7c3aed'] as [string, string], xp: 500 },
  { min: 70, rank: 'PLATINUM', label: '🔷 Platinum', color: '#22d3ee', gradient: ['#22d3ee', '#06b6d4'] as [string, string], xp: 380 },
  { min: 55, rank: 'GOLD', label: '🥇 Gold', color: '#facc15', gradient: ['#facc15', '#f59e0b'] as [string, string], xp: 250 },
  { min: 35, rank: 'SILVER', label: '🥈 Silver', color: '#c0c0c0', gradient: ['#c0c0c0', '#a8a8a8'] as [string, string], xp: 120 },
  { min: 0, rank: 'BRONZE', label: '🥉 Bronze', color: '#cd7f32', gradient: ['#cd7f32', '#a0522d'] as [string, string], xp: 0 },
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
  private readonly ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  private readonly model = process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b-instruct-q4_K_M';

  constructor(private readonly settingsService: SettingsService) {}

  // ── Public entry point ──────────────────────────────────────────────────────

  async classifySolutions(
    solutions: SolutionInput[],
    totalSeconds: number,
  ): Promise<ClassificationResult> {
    // Check if Ollama is enabled in platform settings
    const settings = await this.settingsService.getSettings() as any;
    const ollamaEnabled = settings?.ollamaEnabled !== false; // default true

    if (!ollamaEnabled) {
      this.logger.log('Ollama is disabled — using rule-based placement only');
      return this.ruleBased(solutions, totalSeconds);
    }

    // Score each problem with AI (in sequence to avoid hammering Ollama)
    const breakdown: ProblemScore[] = [];
    for (const sol of solutions) {
      const score = await this.scoreSolution(sol);
      breakdown.push(score);
    }

    // Weighted aggregate
    const solvedBreakdown = breakdown.filter((b) => b.composite > 0);
    let avgExactitude = 0;
    let avgComplexity = 0;
    let avgStyle = 0;

    if (solvedBreakdown.length > 0) {
      avgExactitude = solvedBreakdown.reduce((s, b) => s + b.exactitude, 0) / solvedBreakdown.length;
      avgComplexity = solvedBreakdown.reduce((s, b) => s + b.complexity, 0) / solvedBreakdown.length;
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
        style: Math.round(avgStyle),
      },
      message: RANK_MESSAGES[tier.rank],
    };
  }

  // ── Rule-based fallback (no Ollama) ────────────────────────────────────────

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
      style: s.solved ? 50 : 0,
      composite: s.solved ? baseScore : 0,
      notes: s.solved ? 'Rule-based estimate (Ollama disabled).' : 'Not solved.',
    }));

    return {
      rank: tier.rank,
      label: tier.label,
      color: tier.color,
      gradient: tier.gradient,
      xp: tier.xp,
      totalScore: baseScore,
      breakdown,
      aiScores: { exactitude: baseScore, complexity: 50, style: 50 },
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
      const raw = await this.callOllama(prompt);
      const parsed = this.extractJson(raw);

      const exactitude = this.clamp(Number(parsed.exactitude) || 50);
      const complexity = this.clamp(Number(parsed.complexity) || 50);
      const style = this.clamp(Number(parsed.style) || 50);
      const composite = Math.round(exactitude * 0.40 + complexity * 0.35 + style * 0.25);

      return {
        problemId: sol.problemId,
        title: sol.title,
        difficulty: sol.difficulty,
        exactitude,
        complexity,
        style,
        composite,
        notes: String(parsed.notes ?? ''),
      };
    } catch (err) {
      this.logger.warn(`AI scoring failed for "${sol.title}": ${(err as Error)?.message}`);
      // Graceful fallback: difficulty-adjusted base score
      const base =
        sol.difficulty === 'HARD' ? 70 : sol.difficulty === 'MEDIUM' ? 60 : 50;
      return {
        problemId: sol.problemId,
        title: sol.title,
        difficulty: sol.difficulty,
        exactitude: base,
        complexity: 50,
        style: 50,
        composite: Math.round(base * 0.40 + 50 * 0.35 + 50 * 0.25),
        notes: 'AI analysis unavailable — baseline estimate applied.',
      };
    }
  }

  // ── Ollama interaction ───────────────────────────────────────────────────────

  private buildPrompt(sol: SolutionInput): string {
    return `You are a senior software engineer evaluating a coding interview submission.

Problem: ${sol.title} (difficulty: ${sol.difficulty})
Language: ${sol.language}

Submitted solution:
\`\`\`${sol.language}
${sol.code}
\`\`\`

Score this solution on three axes, each from 0 to 100:
- exactitude: Is the algorithm logic correct? Would it pass all standard test cases? (0 = completely wrong, 100 = perfectly correct)
- complexity: Is the time/space complexity optimal or near-optimal for this problem? (0 = brute force, 100 = optimal)
- style: Is the code readable, clean, idiomatic for the language? (0 = very messy, 100 = exemplary)

Respond ONLY with valid JSON — no markdown, no explanation:
{"exactitude": <0-100>, "complexity": <0-100>, "style": <0-100>, "notes": "<one concise sentence>"}`;
  }

  private async callOllama(prompt: string): Promise<string> {
    const res = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 256 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as { response: string };
    return data.response ?? '';
  }

  private extractJson(raw: string): Record<string, unknown> {
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('No JSON object found in Ollama response');
    return JSON.parse(match[0]);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private clamp(n: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, n));
  }

  private zeroScore(sol: SolutionInput, notes: string): ProblemScore {
    return { problemId: sol.problemId, title: sol.title, difficulty: sol.difficulty, exactitude: 0, complexity: 0, style: 0, composite: 0, notes };
  }
}
