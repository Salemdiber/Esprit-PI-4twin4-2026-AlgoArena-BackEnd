import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SettingsService } from '../settings.service';

/** Route prefixes that are always allowed, even in maintenance mode */
const ALLOWED_PREFIXES = ['/auth', '/settings'];
/** Exact paths that are always allowed (e.g. profile fetch to identify user role) */
const ALLOWED_EXACT = ['/user/me'];

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path: string = request.url?.split('?')[0]; // strip query params

    // Always allow auth, settings routes & exact whitelisted paths
    if (
      ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/')) ||
      ALLOWED_EXACT.includes(path)
    ) {
      return true;
    }

    const settings: any = await this.settingsService.getSettings();
    if (!settings?.maintenanceMode) {
      return true;
    }

    // If user is authenticated as Admin, let them through
    const user = request.user;
    if (user && String(user.role || '').toUpperCase() === 'ADMIN') {
      return true;
    }

    throw new ServiceUnavailableException(
      'Service is under maintenance. Please try again later.',
    );
  }
}
