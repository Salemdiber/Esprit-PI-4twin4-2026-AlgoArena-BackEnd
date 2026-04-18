import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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

    @Get('admin/dashboard/submission-stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    async getDashboardSubmissionStats() {
        return await this.analyticsService.getAdminDashboardSubmissionStats();
    }

    @Get('admin/challenges/submissions-overview')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    async getChallengeSubmissionOverview() {
        return await this.analyticsService.getAdminChallengeSubmissionsOverview();
    }

}
