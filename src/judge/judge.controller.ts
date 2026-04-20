import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
  UseGuards,
  Get,
  Param,
  Req,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { JudgeService } from './judge.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Request } from 'express';

@Controller('judge')
export class JudgeController {
  private readonly logger = new Logger(JudgeController.name);

  constructor(
    private readonly judgeService: JudgeService,
    private readonly i18n: I18nService,
  ) {}

  private tr(key: string): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang });
  }

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submit(
    @Body()
    body: {
      challengeId: string;
      userCode: string;
      language: string;
      solveTimeSeconds?: number;
      mode?: 'run' | 'submit';
    },
    @CurrentUser() user: { userId: string },
    @Req() req: Request,
  ) {
    if (!body.challengeId || !body.userCode || !body.language) {
      throw new BadRequestException(this.tr('judge.fieldsRequired'));
    }
    return this.judgeService.judgeSubmission(
      user.userId,
      body.challengeId,
      body.userCode,
      body.language,
      body.solveTimeSeconds,
      body.mode || 'submit',
      req.ip || req.headers['x-forwarded-for']?.toString() || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('hint')
  async getHint(
    @Body()
    body: {
      challengeId: string;
      elapsedTimeSeconds: number;
      attemptCount: number;
    },
  ) {
    if (!body.challengeId) {
      throw new BadRequestException(this.tr('judge.challengeIdRequired'));
    }
    return this.judgeService.getHint(
      body.challengeId,
      body.attemptCount || 0,
      body.elapsedTimeSeconds || 0,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('progress')
  async getProgress(@CurrentUser() user: { userId: string }) {
    return this.judgeService.getUserChallengeProgress(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('progress/:challengeId')
  async getProgressByChallenge(
    @CurrentUser() user: { userId: string },
    @Param('challengeId') challengeId: string,
    @Req() req: Request,
  ) {
    return this.judgeService.getChallengeProgress(
      user.userId,
      challengeId,
      req.ip || req.headers['x-forwarded-for']?.toString() || null,
      true,
    );
  }
}
