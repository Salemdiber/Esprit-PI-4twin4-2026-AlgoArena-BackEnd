import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { resetPasswordEmailTemplate } from './templates/reset-password-email.template';
import { welcomeEmailTemplate } from './templates/welcome-email.template';
import { resolveFrontendUrl } from '../common/server-config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'EMAIL_FROM_NAME'];
    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      this.logger.warn(
        `⚠️  SMTP env vars missing: ${missing.join(', ')} — emails will NOT be sent until these are configured on the deployment platform.`,
      );
    } else {
      this.logger.log(
        `SMTP configured: host=${process.env.SMTP_HOST}, port=${process.env.SMTP_PORT}, from=${process.env.EMAIL_FROM}`,
      );
    }
  }

  private getRequiredConfig() {
    const config = {
      SMTP_HOST: process.env.SMTP_HOST || '',
      SMTP_PORT: process.env.SMTP_PORT || '',
      SMTP_USER: process.env.SMTP_USER || '',
      SMTP_PASS: process.env.SMTP_PASS || '',
      EMAIL_FROM: process.env.EMAIL_FROM || '',
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || '',
    };

    const missing = Object.entries(config)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      this.logger.error(`Email configuration missing: ${missing.join(', ')}`);
      throw new InternalServerErrorException('Email service is not configured');
    }

    return config;
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;

    const config = this.getRequiredConfig();
    const smtpPort = Number(config.SMTP_PORT);
    if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
      this.logger.error(`Invalid SMTP_PORT value: ${config.SMTP_PORT}`);
      throw new InternalServerErrorException('Email service is not configured');
    }

    this.logger.log(
      `Creating SMTP transporter: host=${config.SMTP_HOST}, port=${smtpPort}, user=${config.SMTP_USER}, from=${config.EMAIL_FROM}`,
    );

    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    });

    return this.transporter;
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const config = this.getRequiredConfig();
    const transporter = this.getTransporter();

    try {
      this.logger.log(`Email send started | to=${to} | subject="${subject}"`);
      const info = await transporter.sendMail({
        from: `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>`,
        to,
        subject,
        html,
      });

      this.logger.log(
        `Email send success | to=${to} | messageId=${info.messageId || 'n/a'} | response=${info.response || 'n/a'}`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Email send failure | to=${to} | error=${error?.message || 'Unknown error'}`,
      );
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    confirmationCode: string,
  ) {
    // Reset link (frontend route)
    const frontendUrl = resolveFrontendUrl(process.env.FRONTEND_URL);
    const resetLink = `${frontendUrl}/reset-password/${token}`;
    const htmlTemplate = resetPasswordEmailTemplate(
      resetLink,
      undefined,
      confirmationCode,
    );
    await this.sendEmail(
      email,
      'Reset Your Password - AlgoArena',
      htmlTemplate,
    );
  }

  async sendWelcomeEmail(email: string, username: string) {
    const platformName = process.env.PLATFORM_NAME || 'AlgoArena';
    const logoUrl = process.env.PLATFORM_LOGO_URL;
    const appUrl = resolveFrontendUrl(process.env.FRONTEND_URL);

    const htmlTemplate = welcomeEmailTemplate(
      platformName,
      `${appUrl}/signin`,
      logoUrl,
    );
    await this.sendEmail(email, `Welcome to ${platformName}`, htmlTemplate);
    this.logger.log(`Welcome email sent to ${email} (${username})`);
  }
}
