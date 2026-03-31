import { Controller, Post, Body, Get } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

@Controller()
export class SubmissionsController {
    constructor(private readonly submissionsService: SubmissionsService) {}

    @Post('submissions/run')
    async runCode(
        @Body('code') code: string,
        @Body('language') language: string,
        @Body('challengeId') challengeId: string,
    ) {
        return this.submissionsService.runCode(code, language, challengeId, false);
    }

    @Post('submissions/submit')
    async submitCode(
        // Assuming we have authentication, but for public/simple mapping we use user info from body or token
        @Body('code') code: string,
        @Body('language') language: string,
        @Body('challengeId') challengeId: string,
        @Body('userId') userId: string, // We accept userId for the leaderboard
    ) {
        return this.submissionsService.runCode(code, language, challengeId, true, userId);
    }

    @Get('leaderboard')
    async getLeaderboard() {
        return this.submissionsService.getLeaderboard();
    }
}
