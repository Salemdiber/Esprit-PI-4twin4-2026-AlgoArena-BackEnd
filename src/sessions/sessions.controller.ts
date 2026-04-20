import { Controller, Get, Req } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import type { Request } from 'express';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get('active')
  getActiveSession(@Req() req: Request) {
    return this.sessionsService.detectActiveSession(req);
  }
}
