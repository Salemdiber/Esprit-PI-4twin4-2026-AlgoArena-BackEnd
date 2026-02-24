import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';

const SHOW_2FA_IN_LOGS = process.env.SHOW_2FA_CODES === 'true' || process.env.NODE_ENV !== 'production';

@Injectable()
export class SmsService {
  private client: any = null;
  private readonly logger = new Logger(SmsService.name);

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) {
      try {
        this.client = twilio(sid, token);
        this.logger.log('Twilio client initialized');
      } catch (e) {
        this.logger.error('Failed to initialize Twilio client: ' + (e?.message || e));
      }
    } else {
      this.logger.warn('Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN). SMS sends will be skipped.');
    }
  }

  async sendTwoFactorSms(to: string, code: string) {
    if (!to) throw new Error('Phone number required');

    const body = `AlgoArena verification code: ${code} (expires in 10 minutes)`;

    if (!this.client) {
      this.logger.warn(`Twilio client not configured; would have sent SMS to ${to}: ${body}`);
      if (SHOW_2FA_IN_LOGS) return { ok: true, debug: true, code };
      throw new Error('SMS provider not configured');
    }

    const from = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      this.logger.warn('TWILIO_FROM not set; aborting SMS send');
      if (SHOW_2FA_IN_LOGS) return { ok: true, debug: true, code };
      throw new Error('TWILIO_FROM not configured');
    }

    try {
      const msg = await this.client.messages.create({ body, from, to });
      this.logger.log(`Sent SMS via Twilio to ${to}, sid=${msg.sid}`);
      return { ok: true };
    } catch (err) {
      this.logger.error(`Failed to send SMS to ${to}: ${err?.message || err}`);
      this.logger.error(err?.stack || String(err));
      if (SHOW_2FA_IN_LOGS) return { ok: true, debug: true, code };
      throw err;
    }
  }
}
