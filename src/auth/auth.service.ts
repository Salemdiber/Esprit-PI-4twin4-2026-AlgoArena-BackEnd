import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { RecaptchaService } from './recaptcha.service';
import { EmailService } from './email.service';
import { SettingsService } from '../settings/settings.service';
import { CacheService } from '../cache/cache.service';
import {
  EmailDeliverabilityService,
  EmailValidationResult,
} from './email-deliverability.service';
import { passwordContainsIdentityData } from './password-policy.util';
import { I18nContext, I18nService } from 'nestjs-i18n';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class AuthService {
  private readonly groqApiKey = process.env.GROQ_API_KEY;
  private readonly groqModel = 'llama-3.1-8b-instant';

  constructor(
    private readonly users: UserService,
    private readonly jwtService: JwtService,
    private readonly recaptchaService: RecaptchaService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly emailDeliverabilityService: EmailDeliverabilityService,
    private readonly i18n: I18nService,
  ) {}

  private tr(key: string, args?: Record<string, unknown>): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang, args });
  }

  async register(dto: any) {
    const settings: any = await this.settingsService.getSettings();
    if (settings && !settings.userRegistration) {
      throw new BadRequestException(this.tr('auth.registrationDisabled'));
    }
    if (!dto.recaptchaToken)
      throw new UnauthorizedException(this.tr('auth.recaptchaRequired'));
    await this.recaptchaService.validate(dto.recaptchaToken);
    this.ensurePasswordIsSafe(dto.password, dto.username, dto.email);
    const emailValidation = await this.validateDeliverableEmail(dto.email);
    if (!emailValidation.valid) {
      throw new BadRequestException(emailValidation.message);
    }

    const created = await this.users.create(dto);
    await this.emailService.sendWelcomeEmail(dto.email, dto.username);

    // Generate placement problems synchronously at registration (blocking, with timeout)
    try {
      const generated = await this.generateChallenges();
      if (generated && Array.isArray(generated) && generated.length) {
        await this.users.setPlacementProblems(
          created._id.toString(),
          generated,
        );
      }
    } catch (e) {
      // ignore generation errors — registration should succeed regardless
    }

    return created;
  }

  async validateDeliverableEmail(
    email: string,
  ): Promise<EmailValidationResult> {
    return this.emailDeliverabilityService.validate(email);
  }

  ensurePasswordIsSafe(password: string, username: string, email: string) {
    if (passwordContainsIdentityData(password, username, email)) {
      throw new BadRequestException(this.tr('auth.passwordContainsIdentity'));
    }
  }

  private async generateChallenges(timeoutMs = 15000): Promise<any[] | null> {
    const model =
      process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b-instruct-q4_K_M';
    const promptPath = join(process.cwd(), 'prompt.txt');
    let prompt = '';
    if (fs.existsSync(promptPath)) {
      try {
        prompt = fs.readFileSync(promptPath, 'utf8');
      } catch {
        prompt = '';
      }
    }
    if (!prompt) {
      // fallback prompt
      prompt = `Generate 3 distinct programming "speed challenge" problems in plain English.\nOutput must be a JSON array with 3 objects. For each object include these fields:\n- \"title\": short unique title\n- \"difficulty\": \"Easy\" | \"Medium\" | \"Hard\"\n- \"estimated_time_minutes\": integer\n- \"statement\": full problem description\n- \"input\": description of input format\n- \"output\": description of output format\n- \"constraints\": numeric limits and complexity hints\n- \"time_limit_seconds\": integer\n- \"memory_limit_mb\": integer\n- \"samples\": array of 3 sample test cases; each sample is { \"input\": \"...\", \"output\": \"...\", \"explanation\": \"...\" }\n- \"tags\": array of short tags\nRequirements:\n- Provide only the JSON array (no extra commentary).\n- Do NOT provide solutions or code.\n- Make challenges appropriate for speed-solving (target short implementations).\n- Ensure inputs/outputs are precise and tests are runnable.`;
    }

    // Check cache first
    try {
      const promptHash = crypto
        .createHash('sha256')
        .update(prompt)
        .digest('hex');
      const cacheKey = `groq:challenges:${promptHash}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return null;
        }
      }
    } catch (e) {
      console.warn('Groq challenge cache check error:', (e as Error).message);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.groqApiKey}`,
          },
          body: JSON.stringify({
            model: this.groqModel,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2048,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Groq API error: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices[0]?.message?.content ?? '';

      // Try to extract JSON from the response
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            // Save to cache for 3 days
            try {
              const promptHash = crypto
                .createHash('sha256')
                .update(prompt)
                .digest('hex');
              const cacheKey = `groq:challenges:${promptHash}`;
              await this.cacheService.set(
                cacheKey,
                JSON.stringify(parsed),
                60 * 60 * 24 * 3,
              );
            } catch (e) {
              console.warn(
                'Failed to cache generated challenges:',
                (e as Error).message,
              );
            }
            return parsed;
          }
        }
        // If no JSON array found, try parsing the whole response
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn(
          'Failed to parse Groq response as JSON:',
          (e as Error).message,
        );
        return null;
      }

      return null;
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        console.warn('Challenge generation timed out');
      } else {
        console.warn('Challenge generation error:', (e as Error).message);
      }
      return null;
    }
  }

  async validateUser(
    username: string,
    password: string,
    recaptchaToken?: string,
  ) {
    if (!recaptchaToken)
      throw new UnauthorizedException(this.tr('auth.recaptchaRequired'));
    await this.recaptchaService.validate(recaptchaToken);
    if (!password) return null;
    const crypto = require('crypto');
    const passwordHash = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    const user: any = await this.users.findLatestByUsernameOrEmail(username);

    if (user && user.passwordHash === passwordHash) {
      const { passwordHash: _ph, ...rest } = user;
      return rest;
    }
    return null;
  }

  async validateOAuthLogin(profile: any, provider: 'google' | 'github') {
    if (!profile?.id) {
      throw new UnauthorizedException(this.tr('auth.oauthProviderIdMissing'));
    }

    if (!profile?.email) {
      throw new BadRequestException(this.tr('auth.oauthEmailMissing'));
    }

    let user =
      provider === 'google'
        ? await this.users.findByGoogleId(profile.id)
        : await this.users.findByGithubId(profile.id);

    if (!user) {
      user = await this.users.findByEmail(profile.email);
      if (user) {
        const providerField = provider === 'google' ? 'googleId' : 'githubId';
        const alreadyLinkedProviderId = (user as any)[providerField];
        if (
          alreadyLinkedProviderId &&
          String(alreadyLinkedProviderId) !== String(profile.id)
        ) {
          throw new ConflictException(this.tr('auth.oauthAlreadyLinked'));
        }

        user = await this.users.linkOAuthProvider(
          (user as any)._id.toString(),
          provider,
          profile.id,
          {
            avatar: profile.avatar || null,
            username: (user as any).username || profile.username || null,
          },
        );
      }
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const fallbackUsername = `${provider}_${profile.id}`.slice(0, 30);
      const dto: any = {
        username: profile.username || fallbackUsername,
        email: profile.email,
        password: randomPassword,
        role: 'Player',
        avatar: profile.avatar || null,
      };

      const created = await this.users.create(dto);
      user = await this.users.linkOAuthProvider(
        (created as any)._id.toString(),
        provider,
        profile.id,
        {
          avatar: profile.avatar || null,
          username: profile.username || fallbackUsername,
        },
      );

      await this.emailService.sendWelcomeEmail(
        profile.email,
        profile.username || fallbackUsername,
      );
    }

    const normalized = (user as any).toObject ? (user as any).toObject() : user;
    const { passwordHash: _ph, ...rest } = normalized as any;
    return rest;
  }

  async login(user: any) {
    if (!user) throw new UnauthorizedException();
    const rawId = user._id || user.userId || user.id;
    const sub = rawId ? rawId.toString() : '';
    const payload = { sub, username: user.username, role: user.role };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // store hashed refresh token server-side
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.users.setRefreshTokenHash(sub, hash);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload: any = this.jwtService.verify(refreshToken);
      const userId = payload.sub;
      const user = await this.users.findOne(userId);
      if (!user) throw new UnauthorizedException();

      const storedHash = (user as any).refreshTokenHash;
      if (!storedHash) throw new UnauthorizedException();

      const hash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      if (hash !== storedHash) throw new UnauthorizedException();

      const newPayload = {
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      };
      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: '15m',
      });
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });

      // rotate refresh token
      const newHash = crypto
        .createHash('sha256')
        .update(newRefreshToken)
        .digest('hex');
      await this.users.setRefreshTokenHash(userId, newHash);

      return { access_token: accessToken, refresh_token: newRefreshToken };
    } catch (e) {
      throw new UnauthorizedException(this.tr('auth.invalidRefreshToken'));
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload: any = this.jwtService.verify(refreshToken);
      const userId = payload.sub;
      await this.users.setRefreshTokenHash(userId, null);
    } catch (e) {
      // ignore invalid token
    }
    return { ok: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return { message: this.tr('auth.resetIfExists') };

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    const confirmationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    await this.users.setResetPasswordToken(
      email,
      tokenHash,
      expires,
      confirmationCode,
    );
    await this.emailService.sendPasswordResetEmail(
      email,
      plainToken,
      confirmationCode,
    );

    return { message: this.tr('auth.resetEmailSent') };
  }

  /**
   * Verifies the confirmation code sent to the user's email for password reset.
   */
  async verifyResetPasswordCode(email: string, code: string) {
    const user = await this.users.verifyResetPasswordCode(email, code);
    if (!user)
      throw new BadRequestException(this.tr('auth.invalidConfirmationCode'));
    return { message: this.tr('auth.codeVerified') };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (newPassword !== confirmPassword)
      throw new BadRequestException(this.tr('auth.passwordsDoNotMatch'));

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await this.users.findByResetPasswordToken(tokenHash);

    if (!user)
      throw new BadRequestException(this.tr('auth.invalidOrExpiredToken'));
    if (!user.resetPasswordCodeVerified) {
      throw new BadRequestException(this.tr('auth.confirmationNotVerified'));
    }

    const passwordHash = crypto
      .createHash('sha256')
      .update(newPassword)
      .digest('hex');

    const rawId = user._id || user.userId || user.id;
    await this.users.updatePasswordAndClearToken(
      rawId.toString(),
      passwordHash,
    );

    return { message: this.tr('auth.passwordUpdated') };
  }
}
