import {
  Body,
  Controller,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JudgeService } from './judge.service';

@Controller('challenges')
export class ChallengeAttemptController {
  constructor(private readonly judgeService: JudgeService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':challengeId/attempt/start')
  async startAttempt(
    @CurrentUser() user: { userId: string },
    @Param('challengeId') challengeId: string,
    @Req() req: Request,
  ) {
    return this.judgeService.startChallengeAttempt(
      user.userId,
      challengeId,
      req.ip || req.headers['x-forwarded-for']?.toString() || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':challengeId/attempt/leave')
  async leaveAttempt(
    @CurrentUser() user: { userId: string },
    @Param('challengeId') challengeId: string,
    @Body()
    body: {
      reason?: 'left_page' | 'tab_closed';
      savedCode?: string;
      elapsedTime?: number;
      attemptId?: string | null;
    },
    @Req() req: Request,
  ) {
    return this.judgeService.leaveChallengeAttempt(
      user.userId,
      challengeId,
      body?.reason || 'left_page',
      {
        savedCode: body?.savedCode,
        elapsedTime: body?.elapsedTime,
        attemptId: body?.attemptId,
      },
      req.ip || req.headers['x-forwarded-for']?.toString() || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put(':challengeId/attempt/save')
  async saveAttempt(
    @CurrentUser() user: { userId: string },
    @Param('challengeId') challengeId: string,
    @Body()
    body: {
      attemptId?: string | null;
      savedCode?: string;
      elapsedTime?: number;
      mode?: 'challenge' | 'practice' | 'contest';
      reason?: 'left_page' | 'tab_closed' | 'manual_save';
    },
    @Req() req: Request,
  ) {
    return this.judgeService.saveChallengeAttempt(
      user.userId,
      challengeId,
      {
        attemptId: body?.attemptId,
        savedCode: body?.savedCode,
        elapsedTime: body?.elapsedTime,
        mode: body?.mode,
        reason: body?.reason,
      },
      req.ip || req.headers['x-forwarded-for']?.toString() || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':challengeId/attempt/return')
  async returnAttempt(
    @CurrentUser() user: { userId: string },
    @Param('challengeId') challengeId: string,
    @Req() req: Request,
  ) {
    return this.judgeService.returnChallengeAttempt(
      user.userId,
      challengeId,
      req.ip || req.headers['x-forwarded-for']?.toString() || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':challengeId/attempt/expire')
  async expireAttempt(
    @CurrentUser() user: { userId: string },
    @Param('challengeId') challengeId: string,
  ) {
    return this.judgeService.expireChallengeAttempt(user.userId, challengeId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':challengeId/attempt/abandon')
  async abandonAttempt(
    @CurrentUser() user: { userId: string },
    @Param('challengeId') challengeId: string,
    @Body() body: { reason?: 'timeout' | 'left_page' | 'tab_closed' },
    @Req() req: Request,
  ) {
    return this.judgeService.abandonChallengeAttempt(
      user.userId,
      challengeId,
      body?.reason || 'timeout',
      req.ip || req.headers['x-forwarded-for']?.toString() || null,
    );
  }
}
