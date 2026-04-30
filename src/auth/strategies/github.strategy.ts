import 'dotenv/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly authService: AuthService) {
    const logger = new Logger(GithubStrategy.name);
    const backendBaseUrl =
      process.env.BACKEND_URL ||
      `http://localhost:${process.env.PORT || 3000}`;
    const clientID = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientID || !clientSecret) {
      logger.error(
        'GitHub OAuth credentials are missing (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).',
      );
    }
    super({
      clientID: clientID || '',
      clientSecret: clientSecret || '',
      callbackURL:
        process.env.GITHUB_CALLBACK_URL ||
        `${backendBaseUrl}/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ): Promise<any> {
    try {
      const { id, username, emails, photos } = profile;
      const pInfo = {
        id,
        email:
          emails && emails.length
            ? emails[0].value
            : `${username || id}@github.local`,
        username: username || `github_${id}`,
        avatar: photos && photos.length ? photos[0].value : null,
      };

      const user = await this.authService.validateOAuthLogin(pInfo, 'github');
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
