import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PlagiarismDetectionService } from './plagiarism-detection.service';
import {
  DetectPlagiarismDto,
  BulkPlagiarismCheckDto,
  PlagiarismResponseDto,
  BulkPlagiarismResultDto,
} from './dto/plagiarism-detection.dto';

/**
 * API Controller for Plagiarism Detection
 *
 * Endpoints for detecting code plagiarism in speed challenges using multiple techniques:
 * ✅ Hash-based detection
 * ✅ AST comparison
 * ✅ Token-based similarity (MOSS-like)
 * ✅ AI-powered pattern detection
 */
@Controller('api/plagiarism')
export class PlagiarismDetectionController {
  constructor(private plagiarismService: PlagiarismDetectionService) {}

  /**
   * Detect plagiarism between two code submissions
   *
   * @example
   * POST /api/plagiarism/detect
   * {
   *   "submittedCode": "...",
   *   "referenceCode": "...",
   *   "userId": "user123",
   *   "challengeId": "challenge456",
   *   "language": "javascript"
   * }
   */
  @Post('detect')
  @HttpCode(HttpStatus.OK)
  async detectPlagiarism(
    @Body() dto: DetectPlagiarismDto,
  ): Promise<PlagiarismResponseDto> {
    if (!dto.submittedCode || !dto.referenceCode) {
      throw new Error('Both submittedCode and referenceCode are required');
    }

    const result = await this.plagiarismService.detectPlagiarism(
      dto.submittedCode,
      dto.referenceCode,
      dto.userId,
    );

    return {
      success: true,
      data: {
        overallSimilarity: result.overallSimilarity,
        isSuspicious: result.isSuspicious,
        recommendation: result.recommendation,
        techniques: {
          hashMatch: {
            technique: result.techniques.hashMatch.technique,
            similarity: Math.round(
              result.techniques.hashMatch.similarity * 100,
            ),
          },
          astComparison: {
            technique: result.techniques.astComparison.technique,
            similarity: Math.round(
              result.techniques.astComparison.similarity * 100,
            ),
          },
          tokenSimilarity: {
            technique: result.techniques.tokenSimilarity.technique,
            similarity: Math.round(
              result.techniques.tokenSimilarity.similarity * 100,
            ),
          },
          aiPatternDetection: {
            technique: result.techniques.aiPatternDetection.technique,
            similarity: Math.round(
              result.techniques.aiPatternDetection.similarity * 100,
            ),
            detectedPatterns:
              result.techniques.aiPatternDetection.detectedPatterns,
          },
        },
        details: result.details,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Bulk plagiarism check for all submissions of a challenge
   * Compares all submissions against each other
   *
   * @example
   * POST /api/plagiarism/bulk-check
   * {
   *   "challenge_id": "challenge123",
   *   "submissions": [
   *     { "user_id": "user1", "code": "..." },
   *     { "user_id": "user2", "code": "..." },
   *     { "user_id": "user3", "code": "..." }
   *   ]
   * }
   */
  @Post('bulk-check')
  @HttpCode(HttpStatus.OK)
  async bulkPlagiarismCheck(
    @Body() dto: BulkPlagiarismCheckDto,
  ): Promise<BulkPlagiarismResultDto> {
    if (!dto.challenge_id || !dto.submissions || dto.submissions.length < 2) {
      throw new Error('Challenge ID and at least 2 submissions are required');
    }

    const matchPairs: Array<{
      user1: string;
      user2: string;
      overallSimilarity: number;
      recommendation: string;
      techniques: { hash: number; ast: number; token: number; ai: number };
    }> = [];

    // Compare all pairs of submissions
    for (let i = 0; i < dto.submissions.length; i++) {
      for (let j = i + 1; j < dto.submissions.length; j++) {
        const submission1 = dto.submissions[i];
        const submission2 = dto.submissions[j];

        const result = await this.plagiarismService.detectPlagiarism(
          submission1.code,
          submission2.code,
          submission1.user_id,
        );

        // Only include suspicious matches
        if (result.isSuspicious || result.overallSimilarity > 60) {
          matchPairs.push({
            user1: submission1.user_id,
            user2: submission2.user_id,
            overallSimilarity: result.overallSimilarity,
            recommendation: result.recommendation,
            techniques: {
              hash: result.techniques.hashMatch.similarity * 100,
              ast: result.techniques.astComparison.similarity * 100,
              token: result.techniques.tokenSimilarity.similarity * 100,
              ai: result.techniques.aiPatternDetection.similarity * 100,
            },
          });
        }
      }
    }

    // Sort by similarity (highest first)
    matchPairs.sort((a, b) => b.overallSimilarity - a.overallSimilarity);

    return {
      success: true,
      challengeId: dto.challenge_id,
      matchPairs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get plagiarism detection statistics
   * Shows how the different techniques perform together
   */
  @Post('analyze-code')
  @HttpCode(HttpStatus.OK)
  async analyzeCode(@Body() dto: { code: string; language?: string }) {
    if (!dto.code) {
      throw new Error('Code is required');
    }

    const analysis = {
      codeLength: dto.code.length,
      lines: dto.code.split('\n').length,
      language: dto.language || 'javascript',
      hash: this.hashCode(dto.code),
      normalized: this.hashCode(this.normalizeCode(dto.code)),
      characteristics: {
        hasComments: /\/\*|\/\/|'''|"""|#/m.test(dto.code),
        hasComplexLogic: /(?:for|while|if|switch|try)/i.test(dto.code),
        hasFunctions: /function|const.*=\s*\(|def\s+/i.test(dto.code),
      },
    };

    return {
      success: true,
      data: analysis,
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods
  private hashCode(code: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private normalizeCode(code: string): string {
    return code
      .replace(/\s+/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .trim();
  }
}
