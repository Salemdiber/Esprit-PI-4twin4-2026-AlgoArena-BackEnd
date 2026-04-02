import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'defaultJwtSecret',
    });
  }

  async validate(payload: any) {
    if (payload?.sub) {
      try {
        await this.userService.syncDailyStreak(String(payload.sub));
      } catch {
        // Streak syncing must never block authentication
      }
    }
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}
