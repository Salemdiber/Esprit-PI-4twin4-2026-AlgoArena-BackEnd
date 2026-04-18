import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChallengeAiDetectionService } from './challenge-ai-detection.service';

@Controller('challenges/ai-detection')
export class ChallengeAiDetectionController {
  constructor(private readonly aiService: ChallengeAiDetectionService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() body: { code: string; reference?: string }) {
    if (!body || !body.code) {
      throw new Error('`code` is required');
    }

    const result = await this.aiService.analyzeSubmission(body.code, body.reference);
    return { success: true, data: result };
  }
}
