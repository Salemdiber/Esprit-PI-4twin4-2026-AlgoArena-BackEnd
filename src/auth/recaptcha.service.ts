import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class RecaptchaService {
    async validate(token: string): Promise<boolean> {
        if (!token) {
            throw new UnauthorizedException('reCAPTCHA token is missing');
        }

        const secret = process.env.RECAPTCHA_SECRET || '6LdKIHMsAAAAAMVX_6-yG6iNW1dcocjH-ktJZC2b';
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${secret}&response=${token}`,
        });

        const data = await response.json();
        if (!data.success) {
            throw new UnauthorizedException('reCAPTCHA validation failed');
        }
        return true;
    }
}
