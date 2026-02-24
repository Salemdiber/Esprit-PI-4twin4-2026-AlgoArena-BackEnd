import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // GET /settings → Returns current settings
  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  // PUT /settings → Update all settings (admin only)
  @Put()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  // PATCH /settings/user-registration → Toggle user registration on/off (admin only)
  @Patch('user-registration')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleUserRegistration(@Body('userRegistration') value: boolean) {
    return this.settingsService.updateSettings({ userRegistration: value });
  }

  // PATCH /settings/ai-battles → Toggle AI battles on/off (admin only)
  @Patch('ai-battles')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleAiBattles(@Body('aiBattles') value: boolean) {
    return this.settingsService.updateSettings({ aiBattles: value });
  }

  // PATCH /settings/maintenance-mode → Toggle maintenance mode on/off (admin only)
  @Patch('maintenance-mode')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async toggleMaintenanceMode(@Body('maintenanceMode') value: boolean) {
    return this.settingsService.updateSettings({ maintenanceMode: value });
  }

  // PATCH /settings/api-rate-limit → Update API rate limit (admin only)
  @Patch('api-rate-limit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async updateApiRateLimit(@Body('apiRateLimit') value: number) {
    return this.settingsService.updateSettings({ apiRateLimit: value });
  }

  // PATCH /settings/code-execution-limit → Update code execution limit (admin only)
  @Patch('code-execution-limit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('Admin')
  async updateCodeExecutionLimit(@Body('codeExecutionLimit') value: number) {
    return this.settingsService.updateSettings({ codeExecutionLimit: value });
  }
}
