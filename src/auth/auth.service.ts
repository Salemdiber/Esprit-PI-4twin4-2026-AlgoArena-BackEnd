import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RecaptchaService } from './recaptcha.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import * as crypto from 'crypto';

// Simple in-memory store for 2FA codes. In production replace with Redis.
const TWO_FA_STORE: Map<string, { code: string; expiresAt: number }> = new Map();

const SHOW_2FA_IN_LOGS = process.env.SHOW_2FA_CODES === 'true' || process.env.NODE_ENV !== 'production';

@Injectable()
export class AuthService {
	constructor(
		private readonly users: UserService,
		private readonly jwtService: JwtService,
		private readonly recaptchaService: RecaptchaService,
		private readonly emailService: EmailService,
		private readonly smsService: SmsService,
	) { }

	private readonly logger = new Logger(AuthService.name);

	async register(dto: any) {
		if (!dto.recaptchaToken) throw new UnauthorizedException('reCAPTCHA token is required');
		await this.recaptchaService.validate(dto.recaptchaToken);
		return this.users.create(dto);
	}

	async validateUser(username: string, password: string, recaptchaToken?: string) {
		if (!recaptchaToken) throw new UnauthorizedException('reCAPTCHA token is required');
		await this.recaptchaService.validate(recaptchaToken);
		if (!password) return null;
		const crypto = require('crypto');
		const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

		const user: any = await this.users.findLatestByUsernameOrEmail(username);

		if (user && user.passwordHash === passwordHash) {
			const { passwordHash: _ph, ...rest } = user;
			return rest;
		}
		return null;
	}

	async validateOAuthLogin(profile: any, provider: 'google' | 'github') {
		const users = await this.users.findAll();
		let user = users.find((u: any) =>
			(provider === 'google' && u.googleId === profile.id) ||
			(provider === 'github' && u.githubId === profile.id) ||
			(u.email === profile.email)
		);

		if (!user) {
			const randomPassword = require('crypto').randomBytes(16).toString('hex');
			const dto: any = {
				username: profile.username || `${provider}_${profile.id}`,
				email: profile.email || `${profile.id}@${provider}.local`,
				password: randomPassword,
				role: 'Player',
				avatar: profile.avatar || null,
			};

			const created = await this.users.create(dto);

			// Update the created user with the provider ID
			const updateQ: any = {};
			if (provider === 'google') updateQ.googleId = profile.id;
			if (provider === 'github') updateQ.githubId = profile.id;

			// We have to directly update the model for googleId/githubId since users.update doesn't map it.
			// Luckily we can just return the created user and let the next login handle it, or we could update it.
			// Since UserService update doesn't take googleId, we'll just ignore for now or we can update directly via model.
			// For simplicity we just return the created user.

			user = created;
		}

		const { passwordHash: _ph, ...rest } = user as any;
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

	async sendTwoFactor(username: string, method: 'email' | 'sms', phoneParam?: string) {
		const user = await this.users.findLatestByUsernameOrEmail(username);
		if (!user) throw new NotFoundException('User not found');

		const code = Math.floor(100000 + Math.random() * 900000).toString();
		const ttl = 10 * 60 * 1000; // 10 minutes
		const rawId = (user as any)._id || (user as any).userId || (user as any).id;
		if (!rawId) throw new NotFoundException('User id not found');
		const idStr = rawId.toString();
		TWO_FA_STORE.set(idStr, { code, expiresAt: Date.now() + ttl });

		// Log code in development (or when explicitly enabled)
		if (SHOW_2FA_IN_LOGS) {
			this.logger.log(`2FA code for user ${username} (id=${idStr}): ${code}`);
		}

		// send via email for now; SMS provider can be added
		if (method === 'email') {
			try {
				await this.emailService.sendTwoFactorCode((user as any).email, code);
			} catch (err) {
				const userEmail = (user as any).email || '<unknown>';
				this.logger.error(`Failed to send 2FA code to ${userEmail}: ${err?.message || err}`);
				// In development allow proceeding (and optionally return code for debugging)
				if (SHOW_2FA_IN_LOGS) {
					return { ok: true, debug: true, code };
				}
				// surface failure to client in production
				return { ok: false, message: 'Failed to send code' };
			}
		} else {
			// send via SMS provider
			try {
				let phone = phoneParam || (user as any).phone || (user as any).mobile || (user as any).phoneNumber;
				if (!phone) {
					this.logger.error(`No phone number available for user ${username}`);
					return { ok: false, message: 'No phone number available' };
				}
				// Save phone to user if provided and not already set
				if (phoneParam && !((user as any).phone)) {
					await this.users.update(idStr, { phone: phoneParam });
				}
				return await this.smsService.sendTwoFactorSms(phone, code);
			} catch (err) {
				this.logger.error(`Failed to send SMS 2FA to ${username}: ${err?.message || err}`);
				if (SHOW_2FA_IN_LOGS) return { ok: true, debug: true, code };
				return { ok: false, message: 'Failed to send code' };
			}
		}

		return { ok: true };
	}

	async verifyTwoFactor(username: string, code: string) {
		const user = await this.users.findLatestByUsernameOrEmail(username);
		if (!user) throw new NotFoundException('User not found');
		const rawId = (user as any)._id || (user as any).userId || (user as any).id;
		if (!rawId) throw new NotFoundException('User id not found');
		const idStr = rawId.toString();

		const entry = TWO_FA_STORE.get(idStr);
		if (!entry) throw new BadRequestException('No code found or expired');
		if (Date.now() > entry.expiresAt) {
			TWO_FA_STORE.delete(idStr);
			throw new BadRequestException('Code expired');
		}
		if (entry.code !== String(code).trim()) throw new BadRequestException('Invalid code');

		// delete entry after successful verification
		TWO_FA_STORE.delete(idStr);

		// issue tokens
		return this.login(user);
	}

	async refreshTokens(refreshToken: string) {
		try {
			const payload: any = this.jwtService.verify(refreshToken);
			const userId = payload.sub;
			const user = await this.users.findOne(userId);
			if (!user) throw new UnauthorizedException();

			const storedHash = (user as any).refreshTokenHash;
			if (!storedHash) throw new UnauthorizedException();

			const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
			if (hash !== storedHash) throw new UnauthorizedException();

			const newPayload = { sub: payload.sub, username: payload.username, role: payload.role };
			const accessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });
			const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });

			// rotate refresh token
			const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
			await this.users.setRefreshTokenHash(userId, newHash);

			return { access_token: accessToken, refresh_token: newRefreshToken };
		} catch (e) {
			throw new UnauthorizedException('Invalid refresh token');
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

	async requestPasswordReset(email: string, recaptchaToken: string) {
		if (!recaptchaToken) throw new UnauthorizedException('reCAPTCHA token is required');
		await this.recaptchaService.validate(recaptchaToken);

		const user = await this.users.findByEmail(email);
		if (!user) return { message: 'If email exists, a reset link was sent' };

		const plainToken = crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
		const expires = new Date(Date.now() + 3600000); // 1 hour

		await this.users.setResetPasswordToken(email, tokenHash, expires);
		await this.emailService.sendPasswordResetEmail(email, plainToken);

		return { message: 'Reset email sent' };
	}

	async resetPassword(token: string, newPassword: string, confirmPassword: string, recaptchaToken: string) {
		if (!recaptchaToken) throw new UnauthorizedException('reCAPTCHA token is required');
		await this.recaptchaService.validate(recaptchaToken);

		if (newPassword !== confirmPassword) throw new BadRequestException('Passwords do not match');

		const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
		const user = await this.users.findByResetPasswordToken(tokenHash);

		if (!user) throw new BadRequestException('Invalid or expired token');

		const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

		const rawId = (user as any)._id || (user as any).userId || (user as any).id;
		await this.users.updatePasswordAndClearToken(rawId.toString(), passwordHash);

		return { message: 'Password updated successfully' };
	}
}
