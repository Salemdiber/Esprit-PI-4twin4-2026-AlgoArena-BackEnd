/**
 * DTOs pour la détection de plagiat
 */

export class DetectPlagiarismDto {
  submittedCode: string;
  referenceCode: string;
  userId: string;
  challengeId?: string;
  language?: 'javascript' | 'python' | 'typescript';
}

export class BulkPlagiarismCheckDto {
  challenge_id: string;
  submissions: Array<{
    user_id: string;
    code: string;
  }>;
}

export class PlagiarismThresholdDto {
  overallSimilarityThreshold: number; // 0-100
  technique?: 'all' | 'hash' | 'ast' | 'token' | 'ai';
}

export class PlagiarismResponseDto {
  success: boolean;
  data: {
    overallSimilarity: number;
    isSuspicious: boolean;
    recommendation: 'clear' | 'review' | 'suspicious';
    techniques: {
      hashMatch: {
        technique: string;
        similarity: number;
      };
      astComparison: {
        technique: string;
        similarity: number;
      };
      tokenSimilarity: {
        technique: string;
        similarity: number;
      };
      aiPatternDetection: {
        technique: string;
        similarity: number;
        detectedPatterns: Array<{
          type: string;
          confidence: number;
          description: string;
        }>;
      };
    };
    details: string[];
  };
  timestamp: string;
}

export class BulkPlagiarismResultDto {
  success: boolean;
  challengeId: string;
  matchPairs: Array<{
    user1: string;
    user2: string;
    overallSimilarity: number;
    recommendation: string;
    techniques: {
      hash: number;
      ast: number;
      token: number;
      ai: number;
    };
  }>;
  timestamp: string;
}
