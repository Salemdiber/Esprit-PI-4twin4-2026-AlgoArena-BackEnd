import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';
import disposableDomainsList from 'disposable-email-domains';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const emailExistence = require('email-existence');

type CacheValue = { valid: boolean; expiresAt: number };

export type EmailValidationReason =
  | 'ok'
  | 'invalid_format'
  | 'fake_pattern'
  | 'disposable'
  | 'no_mx';

export interface EmailValidationResult {
  valid: boolean;
  reason: EmailValidationReason;
  message: string;
  suspicious: boolean;
}

@Injectable()
export class EmailDeliverabilityService {
  private readonly logger = new Logger(EmailDeliverabilityService.name);
  private readonly domainCache = new Map<string, CacheValue>();
  private readonly cacheTtlMs = 10 * 60 * 1000;
  private readonly mxTimeoutMs = 2500;
  private readonly smtpProbeTimeoutMs = 2000;

  private readonly strictEmailRegex =
    /^(?=.{6,254}$)(?=.{1,64}@)([a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i;

  private readonly blockedDomains = new Set([
    'example.com',
    'example.net',
    'example.org',
    'test.com',
    'fake.com',
    'admin.com',
    'user.com',
    'localhost',
    'local',
  ]);

  private readonly blockedTlds = new Set([
    'test',
    'example',
    'invalid',
    'localhost',
    'local',
    'internal',
    'lan',
    'home',
  ]);

  private readonly fakeTokens = new Set([
    'test',
    'example',
    'admin',
    'user',
    'fake',
    'abc',
    'mail',
    'email',
  ]);

  private readonly disposableDomains = new Set<string>(
    Array.isArray(disposableDomainsList)
      ? disposableDomainsList.map((domain) => String(domain).toLowerCase())
      : [],
  );

  async validate(email: string): Promise<EmailValidationResult> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!this.isFormatValid(normalizedEmail)) {
      return this.result(false, 'invalid_format', false);
    }

    const [localPart = '', domain = ''] = normalizedEmail.split('@');
    if (!domain) return this.result(false, 'invalid_format', false);

    if (this.matchesFakePattern(localPart, domain)) {
      return this.result(false, 'fake_pattern', false);
    }

    if (this.isDisposableDomain(domain)) {
      return this.result(false, 'disposable', false);
    }

    const hasMx = await this.hasMxRecords(domain);
    if (!hasMx) {
      return this.result(false, 'no_mx', false);
    }

    const suspicious = await this.smtpMailboxLooksSuspicious(normalizedEmail);
    return this.result(true, 'ok', suspicious);
  }

  private result(valid: boolean, reason: EmailValidationReason, suspicious: boolean): EmailValidationResult {
    const reasonMessages: Record<EmailValidationReason, string> = {
      ok: 'Email is valid',
      invalid_format: 'Invalid email format',
      fake_pattern: 'Invalid email format',
      disposable: 'Disposable emails are not allowed',
      no_mx: 'Email domain cannot receive emails',
    };

    return {
      valid,
      reason,
      message: reasonMessages[reason],
      suspicious,
    };
  }

  private isFormatValid(email: string): boolean {
    return this.strictEmailRegex.test(email);
  }

  private matchesFakePattern(localPart: string, domain: string): boolean {
    const domainName = domain.split('.')[0] ?? '';
    const localNoDigits = localPart.replace(/\d+/g, '');
    const domainNoDigits = domainName.replace(/\d+/g, '');

    const exactFakePairs = new Set([
      'test@test.com',
      'example@example.com',
      'admin@admin.com',
      'user@user.com',
      'abc@abc.com',
      'fake@fake.com',
    ]);

    if (exactFakePairs.has(`${localPart}@${domain}`)) return true;
    if (this.blockedDomains.has(domain)) return true;
    if (localNoDigits === domainNoDigits && localNoDigits.length >= 3) return true;
    if (this.fakeTokens.has(localNoDigits) && this.fakeTokens.has(domainNoDigits)) return true;
    if (/^([a-z0-9])\1{2,}$/i.test(localPart)) return true;
    if (/^([a-z]{2,4})\1{1,}$/i.test(localPart)) return true;
    if (/^(test|fake|example)\d*$/i.test(localPart)) return true;

    const domainParts = domain.split('.');
    const tld = domainParts[domainParts.length - 1] ?? '';
    if (this.blockedTlds.has(tld)) return true;

    return false;
  }

  private isDisposableDomain(domain: string): boolean {
    if (this.disposableDomains.has(domain)) return true;
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      const root = domainParts.slice(-2).join('.');
      if (this.disposableDomains.has(root)) return true;
    }
    return false;
  }

  private async hasMxRecords(domain: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.domainCache.get(domain);
    if (cached && cached.expiresAt > now) return cached.valid;

    const mxLookupPromise = dns.resolveMx(domain).then((records) =>
      records.some((record) => !!record.exchange && !/^localhost$/i.test(record.exchange)),
    );

    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), this.mxTimeoutMs),
    );

    const hasMx = await Promise.race([mxLookupPromise, timeoutPromise]).catch(() => false);
    this.domainCache.set(domain, { valid: hasMx, expiresAt: now + this.cacheTtlMs });
    return hasMx;
  }

  private async smtpMailboxLooksSuspicious(email: string): Promise<boolean> {
    if (process.env.EMAIL_SMTP_EXISTENCE_CHECK !== 'true') return false;

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(true), this.smtpProbeTimeoutMs);
      emailExistence.check(email, (error: unknown, response: boolean) => {
        clearTimeout(timeout);
        if (error) {
          this.logger.warn(`SMTP mailbox probe failed for ${email}`);
          resolve(true);
          return;
        }
        resolve(!response);
      });
    });
  }
}
