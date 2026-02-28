import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { resetPasswordEmailTemplate } from './templates/reset-password-email.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor() {}

  async sendPasswordResetEmail(email: string, token: string) {
    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) {
      this.logger.error('BREVO_API_KEY not configured');
      throw new InternalServerErrorException('BREVO_API_KEY not configured');
    }

    const fromEmail = process.env.EMAIL_FROM ;
    const fromName = process.env.EMAIL_FROM_NAME ;

    // Reset link (frontend route)
    const resetLink = `http://localhost:5173/reset-password/${token}`;

    const htmlTemplate = resetPasswordEmailTemplate(resetLink);

    // If the key looks like an SMTP key (xsmtpsib-...), send via SMTP
    if (brevoKey.startsWith('xsmtpsib-') || brevoKey.startsWith('xsmtp')) {
      const smtpUser = process.env.BREVO_SMTP_USER || 'apikey';
      const transporter = nodemailer.createTransport({
        host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
        port: Number(process.env.BREVO_SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: smtpUser,
          pass: brevoKey,
        },
      });

      try {
        this.logger.log(`Sending reset email via SMTP to ${email} (user=${smtpUser})`);
        const info = await transporter.sendMail({
          from: `${fromName} <${fromEmail}>`,
          to: email,
          subject: 'Reset Your Password - AlgoArena',
          html: htmlTemplate,
        });
        this.logger.log(`SMTP send OK: ${info?.messageId || JSON.stringify(info)}`);
        return;
      } catch (err) {
        this.logger.error('SMTP send failed', err as any);
        throw new InternalServerErrorException('SMTP send failed');
      }
    }

    // Otherwise assume REST API key (xkeysib-...)
    const payload = {
      sender: { name: fromName, email: fromEmail },
      to: [{ email }],
      subject: 'Reset Your Password - AlgoArena',
      htmlContent: htmlTemplate,
    };

    try {
      this.logger.log(`Sending reset email via Brevo REST to ${email}`);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Brevo REST send failed: ${res.status} ${text}`);
        throw new InternalServerErrorException(`Brevo send failed: ${res.status} ${text}`);
      }
      this.logger.log('Brevo REST send OK');
    } catch (err) {
      this.logger.error('Brevo REST send error', err as any);
      throw err;
    }
  }
}
