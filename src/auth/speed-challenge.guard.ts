import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { UserService } from '../user/user.service';

@Injectable()
export class SpeedChallengeGuard implements CanActivate {
  constructor(
    private readonly users: UserService,
    private readonly i18n: I18nService,
  ) {}

  private tr(key: string): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang }) as string;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException(this.tr('speedChallengeGuard.authRequired'));

    // Support different JWT payload shapes: { userId } or { sub }
    const userId = user.userId || user.sub || user.id || user._id;
    if (!userId) throw new UnauthorizedException(this.tr('speedChallengeGuard.invalidTokenPayload'));

    const completed = await this.users.hasCompletedSpeedChallenge(String(userId));
    if (completed) return true;

    throw new ForbiddenException(this.tr('speedChallengeGuard.mustComplete'));
  }
}
