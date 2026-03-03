import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiService } from './ai.service';
import { GenerateChallengeDto } from './dto/generate-challenge.dto';

@Controller('admin/challenges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('generate-ai')
    @HttpCode(HttpStatus.OK)
    async generateChallenge(@Body() dto: GenerateChallengeDto) {
        const result = await this.aiService.generateChallenge(dto);
        return {
            success: true,
            data: result,
        };
    }
}
