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
  apiRateLimit: 'API Requests per Hour',
  codeExecutionLimit: 'Code Executions per Day',
};

function formatValue(val: any): string {
  if (typeof val === 'boolean') return val ? 'Enabled' : 'Disabled';
  return String(val);
}

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditLogService: AuditLogService,
  ) { }

  // GET /settings → Returns current settings
  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  // PUT /settings → Update all settings (admin only)
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

  // PATCH /settings/api-rate-limit → Update API rate limit (admin only)
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
}
