import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private readonly authService: AuthService) {
        super({
            clientID: process.env.GITHUB_CLIENT_ID || 'dummy_client_id_github',
            clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy_client_secret_github',
            callbackURL: 'http://localhost:3000/auth/github/callback',
            scope: ['user:email'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: Function): Promise<any> {
        try {
            const { id, username, emails, photos } = profile;
            const pInfo = {
                id,
                email: emails && emails.length ? emails[0].value : `${username || id}@github.local`,
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
