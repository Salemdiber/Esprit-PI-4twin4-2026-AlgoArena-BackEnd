import { Body, Controller, Post, Get, Req, Res, UnauthorizedException, BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import type { Response } from 'express';
import { UserService } from '../user/user.service';

class LoginDto {
	@IsString()
	username: string;

	@IsString()
	password: string;

	@IsString()
	recaptchaToken?: string;
}

@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly users: UserService,
	) { }

	@Post('register')
	async register(@Body() dto: CreateUserDto) {
		const existingUsername = await this.users.findByUsername(dto.username);
		if (existingUsername) throw new BadRequestException('Username is already taken');

		const existingEmail = await this.users.findByEmail(dto.email);
		if (existingEmail) throw new BadRequestException('Email is already taken');

		return this.authService.register(dto);
	}

	@Post('check-availability')
	async checkAvailability(@Body() body: { username?: string; email?: string }) {
		if (body.username) {
			const existingUsername = await this.users.findByUsername(body.username);
			if (existingUsername) return { available: false, message: 'Username is already taken' };
			return { available: true };
		}
		if (body.email) {
			const existingEmail = await this.users.findByEmail(body.email);
			if (existingEmail) return { available: false, message: 'Email is already taken' };
			return { available: true };
		}
		throw new BadRequestException('Must provide username or email');
	}

	@Post('login')
	async login(@Body() body: LoginDto) {
		if (!body || !body.username || !body.password) throw new BadRequestException('username and password are required');
		const user = await this.authService.validateUser(body.username, body.password, body.recaptchaToken);
		if (!user) throw new UnauthorizedException('Invalid credentials');
		return this.authService.login(user);
	}

	@Get('google')
	@UseGuards(AuthGuard('google'))
	async googleAuth() {
		// initiates the Google OAuth flow
	}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleAuthRedirect(@Req() req, @Res() res: Response) {
		const { access_token } = await this.authService.login(req.user);
		res.cookie('access_token', access_token, { path: '/', maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
		return res.redirect('http://localhost:5173/');
	}

	@Get('github')
	@UseGuards(AuthGuard('github'))
	async githubAuth() {
		// initiates the Github OAuth flow
	}

	@Get('github/callback')
	@UseGuards(AuthGuard('github'))
	async githubAuthRedirect(@Req() req, @Res() res: Response) {
		const { access_token } = await this.authService.login(req.user);
		res.cookie('access_token', access_token, { path: '/', maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
		return res.redirect('http://localhost:5173/');
	}

	@Post('forgot-password')
	async forgotPassword(@Body() body: { email: string; recaptchaToken: string }) {
		if (!body.email) throw new BadRequestException('email is required');
		if (!body.recaptchaToken) throw new BadRequestException('recaptchaToken is required');
		return this.authService.requestPasswordReset(body.email, body.recaptchaToken);
	}

	@Post('reset-password')
	async resetPassword(@Body() body: any) {
		if (!body.token || !body.newPassword || !body.confirmPassword || !body.recaptchaToken) {
			throw new BadRequestException('Missing required fields');
		}
		return this.authService.resetPassword(body.token, body.newPassword, body.confirmPassword, body.recaptchaToken);
	}
}
