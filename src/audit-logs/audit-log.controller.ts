import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    Body,
    UseGuards,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) { }

    /**
     * GET /audit-logs — paginated + filterable
     */
    @Get()
    async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('actionType') actionType?: string,
        @Query('actor') actor?: string,
        @Query('entityType') entityType?: string,
        @Query('status') status?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('search') search?: string,
    ) {
        return this.auditLogService.findAll({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            actionType,
            actor,
            entityType,
            status,
            startDate,
            endDate,
            search,
        });
    }

    /**
     * GET /audit-logs/stats — summary statistics
     */
    @Get('stats')
    async getStats() {
        return this.auditLogService.getStats();
    }

    /**
     * GET /audit-logs/:id — single log detail
     */
    @Get(':id')
    async findOne(@Param('id') id: string) {
        const log = await this.auditLogService.findOne(id);
        if (!log) {
            throw new HttpException('Audit log not found', HttpStatus.NOT_FOUND);
        }
        return log;
    }

    /**
     * POST /audit-logs — create a log entry manually (for testing / manual logging)
     */
    @Post()
    async create(@Body() dto: CreateAuditLogDto) {
        return this.auditLogService.create(dto);
    }

    /**
     * POST /audit-logs/confirm/:id — confirm an action
     */
    @Post('confirm/:id')
    async confirm(@Param('id') id: string) {
        try {
            return await this.auditLogService.confirm(id);
        } catch (err) {
            throw new HttpException(
                err.message || 'Failed to confirm',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * POST /audit-logs/rollback/:id — rollback an action
     */
    @Post('rollback/:id')
    async rollback(
        @Param('id') id: string,
        @CurrentUser() user: { userId: string; username?: string },
    ) {
        try {
            return await this.auditLogService.rollback(id, user?.username || 'Admin');
        } catch (err) {
            throw new HttpException(
                err.message || 'Failed to rollback',
                HttpStatus.BAD_REQUEST,
            );
        }
    }
}
