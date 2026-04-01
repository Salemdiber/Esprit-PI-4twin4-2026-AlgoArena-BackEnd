import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('analytics/insights')
    async getInsights() {
        return await this.analyticsService.getPlatformInsights();
    }

    @Get('admin/stats/overview')
    async getOverview() {
        return await this.analyticsService.getAdminOverviewStats();
    }

    @Get('admin/stats/users')
    async getUsersStats() {
        return await this.analyticsService.getAdminUsersStats();
    }

    @Get('admin/stats/challenges')
    async getChallengeStats() {
        return await this.analyticsService.getAdminChallengesStats();
    }

    @Get('admin/stats/submissions')
    async getSubmissionStats() {
        return await this.analyticsService.getAdminSubmissionsStats();
    }

}
