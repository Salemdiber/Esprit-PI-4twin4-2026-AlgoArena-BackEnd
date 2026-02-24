import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private readonly authService: AuthService) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id_google',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret_google',
            callbackURL: 'http://localhost:3000/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
        try {
            const { id, name, emails, photos } = profile;
            const pInfo = {
                id,
                email: emails && emails[0].value,
                username: name ? `${name.givenName || ''}_${name.familyName || ''}`.trim() : null,
                avatar: photos && photos[0].value,
            };

            const user = await this.authService.validateOAuthLogin(pInfo, 'google');
            done(null, user);
        } catch (err) {
            done(err, false);
        }
    }
}
