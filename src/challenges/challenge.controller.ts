import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChallengeService } from './challenge.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';

@Controller('challenges')
export class ChallengeController {
    constructor(private readonly challengeService: ChallengeService) { }

    // ── Public ────────────────────────────────────────────────────────

    /** GET /challenges/public — Published challenges for frontoffice */
    @Get('public')
    async getPublished(
        @Query('difficulty') difficulty?: string,
        @Query('tag') tag?: string,
        @Query('search') search?: string,
        @Query('sort') sort?: string,
    ) {
        return this.challengeService.findPublished({ difficulty, tag, search, sort });
    }

    /** GET /challenges/public/:id — Single published challenge */
    @Get('public/:id')
    async getPublishedById(@Param('id') id: string) {
        const ch = await this.challengeService.findById(id);
        if ((ch as any).status !== 'published') {
            return { error: 'Challenge not found', statusCode: 404 };
        }
        return ch;
    }

    // ── Admin CRUD ────────────────────────────────────────────────────

    /** GET /challenges — All challenges (admin) */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Get()
    async findAll(
        @Query('status') status?: string,
        @Query('difficulty') difficulty?: string,
        @Query('tag') tag?: string,
        @Query('search') search?: string,
        @Query('sort') sort?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.challengeService.findAll({
            status,
            difficulty,
            tag,
            search,
            sort,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        });
    }

    /** GET /challenges/:id — Single challenge (admin) */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.challengeService.findById(id);
    }

    /** POST /challenges — Create challenge */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() dto: CreateChallengeDto,
        @CurrentUser() user: { userId: string; username?: string },
    ) {
        const challenge = await this.challengeService.create(
            dto,
            user?.userId,
            user?.username || 'Admin',
        );
        return { success: true, data: challenge };
    }

    /** PATCH /challenges/:id — Update challenge */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: Partial<CreateChallengeDto>,
        @CurrentUser() user: { userId: string; username?: string },
    ) {
        const challenge = await this.challengeService.update(
            id,
            dto,
            user?.userId,
            user?.username || 'Admin',
        );
        return { success: true, data: challenge };
    }

    /** PATCH /challenges/:id/publish — Publish */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Patch(':id/publish')
    async publish(
        @Param('id') id: string,
        @CurrentUser() user: { userId: string; username?: string },
    ) {
        const challenge = await this.challengeService.publish(
            id,
            user?.userId,
            user?.username || 'Admin',
        );
        return { success: true, data: challenge };
    }

    /** PATCH /challenges/:id/unpublish — Unpublish */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Patch(':id/unpublish')
    async unpublish(
        @Param('id') id: string,
        @CurrentUser() user: { userId: string; username?: string },
    ) {
        const challenge = await this.challengeService.unpublish(
            id,
            user?.userId,
            user?.username || 'Admin',
        );
        return { success: true, data: challenge };
    }

    /** DELETE /challenges/:id — Delete */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Delete(':id')
    async remove(
        @Param('id') id: string,
        @CurrentUser() user: { userId: string; username?: string },
    ) {
        return this.challengeService.remove(
            id,
            user?.userId,
            user?.username || 'Admin',
        );
    }
}
