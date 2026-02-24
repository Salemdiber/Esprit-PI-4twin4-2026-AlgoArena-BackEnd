import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class RecaptchaService {
    async validate(token: string): Promise<boolean> {
        if (!token) {
            throw new UnauthorizedException('reCAPTCHA token is missing');
        }

        const secret = process.env.RECAPTCHA_SECRET;
        if (!secret) throw new UnauthorizedException('reCAPTCHA secret key not configured');
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${secret}&response=${token}`,
        });

        const data = await response.json();
        // Pour reCAPTCHA v3 : vérifier le score et l'action
        if (!data.success) {
            throw new UnauthorizedException('reCAPTCHA validation failed');
        }
        if (data.score !== undefined && data.score < 0.5) {
            throw new UnauthorizedException('reCAPTCHA score too low');
        }
        // Optionnel : vérifier l'action si vous l'utilisez côté frontend
        // if (data.action !== 'signup') {
        //     throw new UnauthorizedException('reCAPTCHA action mismatch');
        // }
        return true;
    }
}
