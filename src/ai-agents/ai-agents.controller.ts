import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiAgentsService } from './ai-agents.service';

@Controller('ai-agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class AiAgentsController {
  constructor(private readonly aiAgentsService: AiAgentsService) {}

  @Get('analytics-insights')
  async getAnalyticsInsights(
    @Query('activityDays') activityDays?: string,
    @Query('communityDays') communityDays?: string,
    @Query('force') force?: string,
  ) {
    return this.aiAgentsService.getAnalyticsInsights({
      activityDays: Number(activityDays || 7),
      communityDays: Number(communityDays || 30),
      forceRefresh: String(force || '').toLowerCase() === 'true',
    });
  }

  @Get('security-scan')
  async getSecurityScan(
    @Query('minSeverity') minSeverity?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('force') force?: string,
  ) {
    return this.aiAgentsService.runSecurityScan({
      minSeverity: (minSeverity as any) || 'low',
      limit: Number(limit || 200),
      category,
      forceRefresh: String(force || '').toLowerCase() === 'true',
    });
  }

  @Get('i18n-scan')
  async getI18nScan(
    @Query('limit') limit?: string,
    @Query('minConfidence') minConfidence?: string,
    @Query('pathContains') pathContains?: string,
    @Query('force') force?: string,
  ) {
    const parsedLimit = Number(limit || 150);
    return this.aiAgentsService.scanI18nHardcodedTexts(parsedLimit, {
      minConfidence: Number(minConfidence || 0),
      pathContains,
      forceRefresh: String(force || '').toLowerCase() === 'true',
    });
  }

  @Get('executive-brief')
  async getExecutiveBrief(
    @Query('i18nLimit') i18nLimit?: string,
    @Query('provider') provider?: string,
    @Query('force') force?: string,
  ) {
    const parsedLimit = Number(i18nLimit || 120);
    const forceRefresh = String(force || '').toLowerCase() === 'true';
    return this.aiAgentsService.getExecutiveBrief(parsedLimit, provider, forceRefresh);
  }
}

