import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
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

@ApiTags('Challenges')
@Controller('challenges')
export class ChallengeController {
    constructor(private readonly challengeService: ChallengeService) { }

    // ── Public ────────────────────────────────────────────────────────

    /** GET /challenges/public — Published challenges for frontoffice */
            @ApiOperation({
        summary: 'Get_public_1 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/public HTTP/1.1
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
- **Valid Test Case**: Call \`GET /api/public\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'Get_public_id_2 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/public/:id HTTP/1.1
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
- **Valid Test Case**: Call \`GET /api/public/:id\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'GetBaseRoute_3 operation',
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
            @ApiOperation({
        summary: 'Get__id_4 operation',
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
        return this.challengeService.findById(id);
    }

    /** POST /challenges — Create challenge */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
            @ApiOperation({
        summary: 'PostBaseRoute_5 operation',
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
            @ApiOperation({
        summary: 'Patch__id_6 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/:id HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/:id\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'Patch__id_publish_7 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/:id/publish HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/:id/publish\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'Patch__id_unpublish_8 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/:id/unpublish HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/:id/unpublish\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
            @ApiOperation({
        summary: 'Delete__id_9 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
DELETE /api/:id HTTP/1.1
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
- **Valid Test Case**: Call \`DELETE /api/:id\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
