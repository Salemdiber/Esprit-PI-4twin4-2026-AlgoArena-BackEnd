import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UserService } from '../user/user.service';

@Injectable()
export class SpeedChallengeGuard implements CanActivate {
  constructor(private readonly users: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException('Authentication required');

    // Support different JWT payload shapes: { userId } or { sub }
    const userId = user.userId || user.sub || user.id || user._id;
    if (!userId) throw new UnauthorizedException('Invalid token payload');

    const completed = await this.users.hasCompletedSpeedChallenge(String(userId));
    if (completed) return true;

    throw new ForbiddenException('Speed challenge must be completed');
  }
}
