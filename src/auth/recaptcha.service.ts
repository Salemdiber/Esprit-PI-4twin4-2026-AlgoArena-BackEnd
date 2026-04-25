import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  private tr(key: string): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang });
  }

  async validate(token: string): Promise<boolean> {
    if (!token) {
      throw new UnauthorizedException(this.tr('recaptcha.tokenMissing'));
    }

    const secret = this.configService.get<string>('RECAPTCHA_SECRET');
    if (!secret)
      throw new UnauthorizedException(this.tr('recaptcha.secretNotConfigured'));
    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${secret}&response=${token}`,
      },
    );

    const data = await response.json();
    // Pour reCAPTCHA v3 : vérifier le score et l'action
    if (!data.success) {
      const providerCodes = Array.isArray(data['error-codes'])
        ? data['error-codes'].join(', ')
        : 'unknown';
      this.logger.warn(
        `reCAPTCHA validation failed with provider codes: ${providerCodes}`,
      );
      throw new UnauthorizedException(this.tr('recaptcha.validationFailed'));
    }
    if (data.score !== undefined && data.score < 0.5) {
      throw new UnauthorizedException(this.tr('recaptcha.scoreTooLow'));
    }
    // Optionnel : vérifier l'action si vous l'utilisez côté frontend
    // if (data.action !== 'signup') {
    //     throw new UnauthorizedException('reCAPTCHA action mismatch');
    // }
    return true;
  }
}
