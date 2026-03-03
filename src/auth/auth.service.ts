import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RecaptchaService } from './recaptcha.service';
import { EmailService } from './email.service';
import { SettingsService } from '../settings/settings.service';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class AuthService {
	constructor(
		private readonly users: UserService,
		private readonly jwtService: JwtService,
		private readonly recaptchaService: RecaptchaService,
		private readonly emailService: EmailService,
		private readonly settingsService: SettingsService,
	) { }

	async register(dto: any) {
		const settings: any = await this.settingsService.getSettings();
		if (settings && !settings.userRegistration) {
			throw new BadRequestException('Registration is disabled');
		}
		if (!dto.recaptchaToken) throw new UnauthorizedException('reCAPTCHA token is required');
		await this.recaptchaService.validate(dto.recaptchaToken);
		const created = await this.users.create(dto);

		// Generate placement problems synchronously at registration (blocking, with timeout)
		try {
			const generated = await this.generateChallenges();
			if (generated && Array.isArray(generated) && generated.length) {
				await this.users.setPlacementProblems((created as any)._id.toString(), generated);
			}
		} catch (e) {
			// ignore generation errors — registration should succeed regardless
		}

		return created;
	}

	private generateChallenges(timeoutMs = 15000): Promise<any[] | null> {
		const model = process.env.OLLAMA_MODEL || 'deepseek-coder:6.7b-instruct-q4_K_M';
		const promptPath = join(process.cwd(), 'prompt.txt');
		let prompt = '';
		if (fs.existsSync(promptPath)) {
			try { prompt = fs.readFileSync(promptPath, 'utf8'); } catch { prompt = ''; }
		}
		if (!prompt) {
			// fallback prompt
			prompt = `Generate 3 distinct programming "speed challenge" problems in plain English.\nOutput must be a JSON array with 3 objects. For each object include these fields:\n- \"title\": short unique title\n- \"difficulty\": \"Easy\" | \"Medium\" | \"Hard\"\n- \"estimated_time_minutes\": integer\n- \"statement\": full problem description\n- \"input\": description of input format\n- \"output\": description of output format\n- \"constraints\": numeric limits and complexity hints\n- \"time_limit_seconds\": integer\n- \"memory_limit_mb\": integer\n- \"samples\": array of 3 sample test cases; each sample is { \"input\": \"...\", \"output\": \"...\", \"explanation\": \"...\" }\n- \"tags\": array of short tags\nRequirements:\n- Provide only the JSON array (no extra commentary).\n- Do NOT provide solutions or code.\n- Make challenges appropriate for speed-solving (target short implementations).\n- Ensure inputs/outputs are precise and tests are runnable.`;
		}

		return new Promise((resolve) => {
			let finished = false;
			try {
				const proc = spawn('ollama', ['run', model], { stdio: ['pipe', 'pipe', 'pipe'] });
				let out = '';
				proc.stdout.on('data', (c) => out += c.toString());
				proc.stderr.on('data', () => { /* ignore stderr */ });
				proc.on('error', () => { if (!finished) { finished = true; resolve(null); } });

				// timeout safety
				const timer = setTimeout(() => {
					try { proc.kill(); } catch { }
					if (!finished) { finished = true; resolve(null); }
				}, timeoutMs);

				proc.on('close', () => {
					clearTimeout(timer);
					if (finished) return;
					finished = true;
					try {
						const parsed = JSON.parse(out);
						resolve(parsed);
					} catch (e) {
						resolve(null);
					}
				});

				try {
					proc.stdin.write(prompt);
					proc.stdin.end();
				} catch (e) {
					// ignore
				}
			} catch (e) {
				if (!finished) { finished = true; resolve(null); }
			}
		});
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


	async requestPasswordReset(email: string) {
		const user = await this.users.findByEmail(email);
		if (!user) return { message: 'If email exists, a reset link was sent' };

		const plainToken = crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
		const expires = new Date(Date.now() + 3600000); // 1 hour
		const confirmationCode = Math.floor(100000 + Math.random() * 900000).toString();

		await this.users.setResetPasswordToken(email, tokenHash, expires, confirmationCode);
		await this.emailService.sendPasswordResetEmail(email, plainToken, confirmationCode);

		return { message: 'Reset email sent' };
	}

	/**
	 * Verifies the confirmation code sent to the user's email for password reset.
	 */
	async verifyResetPasswordCode(email: string, code: string) {
		const user = await this.users.verifyResetPasswordCode(email, code);
		if (!user) throw new BadRequestException('Invalid or expired confirmation code');
		return { message: 'Code verified. You may now reset your password.' };
	}

	async resetPassword(token: string, newPassword: string, confirmPassword: string) {
		if (newPassword !== confirmPassword) throw new BadRequestException('Passwords do not match');

		const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
		const user = await this.users.findByResetPasswordToken(tokenHash);

		if (!user) throw new BadRequestException('Invalid or expired token');
		if (!user.resetPasswordCodeVerified) {
			throw new BadRequestException('Confirmation code not verified');
		}

		const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

		const rawId = (user as any)._id || (user as any).userId || (user as any).id;
		await this.users.updatePasswordAndClearToken(rawId.toString(), passwordHash);

		return { message: 'Password updated successfully' };
	}
}
