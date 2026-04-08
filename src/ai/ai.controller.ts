import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
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

@ApiTags('AI Operations')
@Controller('admin/challenges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({
    summary: 'Post_generate_ai_1 operation',
    description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/generate-ai HTTP/1.1
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
- **Valid Test Case**: Call \`POST /api/generate-ai\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `,
  })
  @ApiResponse({ status: 200, description: 'Successful operation' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid parameters/body',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
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
