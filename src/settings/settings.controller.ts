import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditLogService } from '../audit-logs/audit-log.service';

// Human-readable labels for settings keys
const SETTING_LABELS: Record<string, string> = {
  platformName: 'Platform Name',
  supportEmail: 'Support Email',
  userRegistration: 'User Registration',
  aiBattles: 'AI Battles',
  maintenanceMode: 'Maintenance Mode',
  ollamaEnabled: 'AI Classification',
  disableCopyPaste: 'Disable Copy/Paste',
  disableTabSwitch: 'Disable Tab Switch',
  disableSpeedChallenges: 'Disable Speed Challenges',
  apiRateLimit: 'API Requests per Hour',
  codeExecutionLimit: 'Code Executions per Day',
};

function formatValue(val: any): string {
  if (typeof val === 'boolean') return val ? 'Enabled' : 'Disabled';
  return String(val);
}

@ApiTags('Platform Settings')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditLogService: AuditLogService,
  ) { }

  // GET /settings → Returns current settings
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
  async getSettings() {
    return this.settingsService.getSettings();
  }

  // PUT /settings → Update all settings (admin only)
          @ApiOperation({
        summary: 'PutBaseRoute_2 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PUT /api/ HTTP/1.1
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
- **Valid Test Case**: Call \`PUT /api/\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Put()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() actor: { userId: string; username?: string },
    @Req() req: any,
  ) {
    const previous = await this.settingsService.getSettings() as any;
    const result = await this.settingsService.updateSettings(dto);

    // Generate per-field audit logs for every changed setting
    const changedFields: string[] = [];
    for (const [key, newVal] of Object.entries(dto)) {
      if (newVal === undefined || newVal === null) continue;
      const prevVal = previous?.[key];
      if (prevVal !== newVal) {
        const label = SETTING_LABELS[key] || key;
        changedFields.push(`${label}: ${formatValue(prevVal)} → ${formatValue(newVal)}`);

        await this.auditLogService.create({
          actionType: 'SYSTEM_CONFIG_UPDATED',
          actor: actor?.username || 'System',
          actorId: actor?.userId,
          entityType: 'system',
          targetId: 'settings',
          targetLabel: label,
          previousState: { [key]: prevVal },
          newState: { [key]: newVal },
          description: `Admin "${actor?.username || 'System'}" changed ${label} from "${formatValue(prevVal)}" to "${formatValue(newVal)}"`,
          status: 'active',
          metadata: { ip: req?.ip || req?.connection?.remoteAddress || null },
        });
      }
    }

    return result;
  }

  // PATCH /settings/user-registration → Toggle user registration on/off (admin only)
          @ApiOperation({
        summary: 'Patch_user_registration_3 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/user-registration HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/user-registration\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Patch('user-registration')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleUserRegistration(
    @Body('userRegistration') value: boolean,
    @CurrentUser() actor: { userId: string; username?: string },
    @Req() req: any,
  ) {
    const previous = await this.settingsService.getSettings() as any;
    const result = await this.settingsService.updateSettings({ userRegistration: value });

    if (previous?.userRegistration !== value) {
      await this.auditLogService.create({
        actionType: 'FEATURE_FLAG_CHANGED',
        actor: actor?.username || 'System',
        actorId: actor?.userId,
        entityType: 'system',
        targetId: 'settings',
        targetLabel: 'User Registration',
        previousState: { userRegistration: previous?.userRegistration },
        newState: { userRegistration: value },
        description: `Admin "${actor?.username || 'System'}" ${value ? 'enabled' : 'disabled'} User Registration`,
        status: 'active',
        metadata: { ip: req?.ip || null },
      });
    }

    return result;
  }

  // PATCH /settings/ai-battles → Toggle AI battles on/off (admin only)
          @ApiOperation({
        summary: 'Patch_ai_battles_4 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/ai-battles HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/ai-battles\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Patch('ai-battles')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleAiBattles(
    @Body('aiBattles') value: boolean,
    @CurrentUser() actor: { userId: string; username?: string },
    @Req() req: any,
  ) {
    const previous = await this.settingsService.getSettings() as any;
    const result = await this.settingsService.updateSettings({ aiBattles: value });

    if (previous?.aiBattles !== value) {
      await this.auditLogService.create({
        actionType: 'FEATURE_FLAG_CHANGED',
        actor: actor?.username || 'System',
        actorId: actor?.userId,
        entityType: 'system',
        targetId: 'settings',
        targetLabel: 'AI Battles',
        previousState: { aiBattles: previous?.aiBattles },
        newState: { aiBattles: value },
        description: `Admin "${actor?.username || 'System'}" ${value ? 'enabled' : 'disabled'} AI Battles`,
        status: 'active',
        metadata: { ip: req?.ip || null },
      });
    }

    return result;
  }

  // PATCH /settings/maintenance-mode → Toggle maintenance mode on/off (admin only)
          @ApiOperation({
        summary: 'Patch_maintenance_mode_5 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/maintenance-mode HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/maintenance-mode\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Patch('maintenance-mode')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleMaintenanceMode(
    @Body('maintenanceMode') value: boolean,
    @CurrentUser() actor: { userId: string; username?: string },
    @Req() req: any,
  ) {
    const previous = await this.settingsService.getSettings() as any;
    const result = await this.settingsService.updateSettings({ maintenanceMode: value });

    if (previous?.maintenanceMode !== value) {
      await this.auditLogService.create({
        actionType: 'FEATURE_FLAG_CHANGED',
        actor: actor?.username || 'System',
        actorId: actor?.userId,
        entityType: 'system',
        targetId: 'settings',
        targetLabel: 'Maintenance Mode',
        previousState: { maintenanceMode: previous?.maintenanceMode },
        newState: { maintenanceMode: value },
        description: `Admin "${actor?.username || 'System'}" ${value ? 'enabled' : 'disabled'} Maintenance Mode`,
        status: 'active',
        metadata: { ip: req?.ip || null },
      });
    }

    return result;
  }

  // PATCH /settings/ai-enabled → Toggle AI classification on/off (admin only)
          @ApiOperation({
        summary: 'Patch_ai_enabled operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/ollama-enabled HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/ollama-enabled\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Patch('ollama-enabled')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleOllamaEnabled(@Body('ollamaEnabled') value: boolean) {
    return this.settingsService.updateSettings({ ollamaEnabled: value });
  }

  // PATCH /settings/api-rate-limit → Update API rate limit (admin only)
          @ApiOperation({
        summary: 'Patch_api_rate_limit_7 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/api-rate-limit HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/api-rate-limit\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Patch('api-rate-limit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async updateApiRateLimit(
    @Body('apiRateLimit') value: number,
    @CurrentUser() actor: { userId: string; username?: string },
    @Req() req: any,
  ) {
    const previous = await this.settingsService.getSettings() as any;
    const result = await this.settingsService.updateSettings({ apiRateLimit: value });

    if (previous?.apiRateLimit !== value) {
      await this.auditLogService.create({
        actionType: 'SYSTEM_CONFIG_UPDATED',
        actor: actor?.username || 'System',
        actorId: actor?.userId,
        entityType: 'system',
        targetId: 'settings',
        targetLabel: 'API Rate Limit',
        previousState: { apiRateLimit: previous?.apiRateLimit },
        newState: { apiRateLimit: value },
        description: `Admin "${actor?.username || 'System'}" changed API rate limit from ${previous?.apiRateLimit} to ${value}`,
        status: 'active',
        metadata: { ip: req?.ip || null },
      });
    }

    return result;
  }

  // PATCH /settings/code-execution-limit → Update code execution limit (admin only)
          @ApiOperation({
        summary: 'Patch_code_execution_limit_8 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
PATCH /api/code-execution-limit HTTP/1.1
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
- **Valid Test Case**: Call \`PATCH /api/code-execution-limit\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Patch('code-execution-limit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async updateCodeExecutionLimit(
    @Body('codeExecutionLimit') value: number,
    @CurrentUser() actor: { userId: string; username?: string },
    @Req() req: any,
  ) {
    const previous = await this.settingsService.getSettings() as any;
    const result = await this.settingsService.updateSettings({ codeExecutionLimit: value });

    if (previous?.codeExecutionLimit !== value) {
      await this.auditLogService.create({
        actionType: 'SYSTEM_CONFIG_UPDATED',
        actor: actor?.username || 'System',
        actorId: actor?.userId,
        entityType: 'system',
        targetId: 'settings',
        targetLabel: 'Code Execution Limit',
        previousState: { codeExecutionLimit: previous?.codeExecutionLimit },
        newState: { codeExecutionLimit: value },
        description: `Admin "${actor?.username || 'System'}" changed code execution limit from ${previous?.codeExecutionLimit} to ${value}`,
        status: 'active',
        metadata: { ip: req?.ip || null },
      });
    }

    return result;
  }

  // PATCH /settings/disable-speed-challenges → Toggle speed challenges on/off (admin only)
  @ApiOperation({
    summary: 'Patch_disable_speed_challenges operation',
    description: `
### Required Permissions
- Admin role

### Example Request
\`\`\`http
PATCH /api/settings/disable-speed-challenges HTTP/1.1
Content-Type: application/json

{
  "disableSpeedChallenges": true
}
\`\`\`

### Example Response
\`\`\`json
{
  "disableSpeedChallenges": true
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`PATCH /api/settings/disable-speed-challenges\` with valid data -> Returns \`200 OK\`.
- **Invalid Test Case**: Call with malformed data -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token -> Returns \`401 Unauthorized\`.
    `
  })
  @ApiResponse({ status: 200, description: 'Successful operation' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @Patch('disable-speed-challenges')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleSpeedChallenges(
    @Body('disableSpeedChallenges') value: boolean,
    @CurrentUser() actor: { userId: string; username?: string },
    @Req() req: any,
  ) {
    const previous = await this.settingsService.getSettings() as any;
    const result = await this.settingsService.updateSettings({ disableSpeedChallenges: value });

    if (previous?.disableSpeedChallenges !== value) {
      await this.auditLogService.create({
        actionType: 'FEATURE_FLAG_CHANGED',
        actor: actor?.username || 'System',
        actorId: actor?.userId,
        entityType: 'system',
        targetId: 'settings',
        targetLabel: 'Speed Challenges',
        previousState: { disableSpeedChallenges: previous?.disableSpeedChallenges },
        newState: { disableSpeedChallenges: value },
        description: `Admin "${actor?.username || 'System'}" ${value ? 'disabled' : 'enabled'} Speed Challenges`,
        status: 'active',
        metadata: { ip: req?.ip || null },
      });
    }

    return result;
  }
}
