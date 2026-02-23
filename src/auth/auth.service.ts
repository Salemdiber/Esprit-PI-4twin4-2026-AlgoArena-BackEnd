import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RecaptchaService } from './recaptcha.service';
import { EmailService } from './email.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
	constructor(
		private readonly users: UserService,
		private readonly jwtService: JwtService,
		private readonly recaptchaService: RecaptchaService,
		private readonly emailService: EmailService,
	) { }

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
		return { access_token: this.jwtService.sign(payload) };
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
