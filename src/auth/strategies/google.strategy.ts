import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    const proxy =
      process.env.HTTPS_PROXY || process.env.HTTP_PROXY || undefined;
    const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientID || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
    }
    super({
      clientID,
      clientSecret,
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
