import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class AuditLogController {
    constructor(private readonly auditLogService: AuditLogService) { }

    /**
     * GET /audit-logs — paginated + filterable
     */
            @ApiOperation({
        summary: 'GetBaseRoute_1 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/ HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`GET /api/\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'Get_stats_2 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/stats HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`GET /api/stats\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Get('stats')
    async getStats() {
        return this.auditLogService.getStats();
    }

    /**
     * GET /audit-logs/:id — single log detail
     */
            @ApiOperation({
        summary: 'Get__id_3 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/:id HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`GET /api/:id\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'PostBaseRoute_4 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/ HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post()
    async create(@Body() dto: CreateAuditLogDto) {
        return this.auditLogService.create(dto);
    }

    /**
     * POST /audit-logs/confirm/:id — confirm an action
     */
            @ApiOperation({
        summary: 'Post_confirm_id_5 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/confirm/:id HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/confirm/:id\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'Post_rollback_id_6 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/rollback/:id HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/rollback/:id\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
