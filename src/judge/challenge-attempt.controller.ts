import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
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
    @Body() body: { reason?: 'left_page' | 'tab_closed' },
    @Req() req: Request,
  ) {
    return this.judgeService.leaveChallengeAttempt(
      user.userId,
      challengeId,
      body?.reason || 'left_page',
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
