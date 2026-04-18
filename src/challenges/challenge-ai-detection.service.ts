import { Injectable } from '@nestjs/common';

export interface AiDetectionResult {
  overallSimilarity: number;
  isSuspicious: boolean;
  details: string[];
}

@Injectable()
export class ChallengeAiDetectionService {
  // Lightweight stub implementation. Replace with real AI logic later.
  async analyzeSubmission(code: string, reference?: string): Promise<AiDetectionResult> {
    // Simple heuristic: short code -> low similarity
    const lengthScore = Math.min(1, code.length / 1000);
    const similarity = Math.round(lengthScore * 100);

    return {
      overallSimilarity: similarity,
      isSuspicious: similarity > 75,
      details: ['Basic length-based heuristic (placeholder)'],
    };
  }
}
