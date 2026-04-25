import 'dotenv/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    const logger = new Logger(GoogleStrategy.name);
    const proxy =
      process.env.HTTPS_PROXY || process.env.HTTP_PROXY || undefined;
    const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientID || !clientSecret) {
      logger.error(
        'Google OAuth credentials are missing (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
      );
    }
    super({
      clientID: clientID || '',
      clientSecret: clientSecret || '',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        `${backendBaseUrl}/auth/google/callback`,
      scope: ['email', 'profile'],
      proxy,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, name, emails, photos } = profile;
      const pInfo = {
        id,
        email: emails && emails[0].value,
        username: name
          ? `${name.givenName || ''}_${name.familyName || ''}`.trim()
          : null,
        avatar: photos && photos[0].value,
      };

      const user = await this.authService.validateOAuthLogin(pInfo, 'google');
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
