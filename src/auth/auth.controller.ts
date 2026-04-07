import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Body, Controller, Post, Get, Req, Res, UnauthorizedException, BadRequestException, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import type { Response } from 'express';
import type { Request } from 'express';
import { UserService } from '../user/user.service';

class LoginDto {
	@IsString()
	username: string;

	@IsString()
	password: string;

	@IsString()
	recaptchaToken?: string;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly users: UserService,
	) { }

	        @ApiOperation({
        summary: 'Post_register_1 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/register HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/register\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
	@Post('register')
        async register(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
		const existingUsername = await this.users.findByUsername(dto.username);
		if (existingUsername) throw new BadRequestException('Username is already taken');

		const existingEmail = await this.users.findByEmail(dto.email);
		if (existingEmail) throw new BadRequestException('Email is already taken');
		this.authService.ensurePasswordIsSafe(dto.password, dto.username, dto.email);

                const created = await this.authService.register(dto);
                const tokens = await this.authService.login(created);
                res.cookie('refresh_token', tokens.refresh_token, {
                        path: '/',
                        maxAge: 7 * 24 * 60 * 60 * 1000,
                        httpOnly: true,
                        sameSite: 'lax',
                        secure: process.env.NODE_ENV === 'production',
                });
                res.cookie('access_token', tokens.access_token, {
                        path: '/',
                        maxAge: 15 * 60 * 1000,
                        sameSite: 'lax',
                        secure: process.env.NODE_ENV === 'production',
                });
                return { access_token: tokens.access_token };
	}

	        @ApiOperation({
        summary: 'Post_check_availability_2 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/check-availability HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/check-availability\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post('check-availability')
	async checkAvailability(@Body() body: { username?: string; email?: string }) {
		if (body.username) {
			const existingUsername = await this.users.findByUsername(body.username);
			if (existingUsername) return { available: false, message: 'Username is already taken' };
			return { available: true };
		}
		if (body.email) {
			const validation = await this.authService.validateDeliverableEmail(body.email);
			if (!validation.valid) {
				return { available: false, message: validation.message, reason: validation.reason };
			}

			const existingEmail = await this.users.findByEmail(body.email);
			if (existingEmail) return { available: false, message: 'Email is already taken' };
			return { available: true, suspicious: validation.suspicious };
		}
		throw new BadRequestException('Must provide username or email');
	}

	        @ApiOperation({
        summary: 'Post_login_3 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/login HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/login\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post('login')
	async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
		if (!body || !body.username || !body.password) throw new BadRequestException('username and password are required');
		const user = await this.authService.validateUser(body.username, body.password, body.recaptchaToken);
		if (!user) throw new UnauthorizedException('Invalid credentials');
		const tokens = await this.authService.login(user);
		res.cookie('refresh_token', tokens.refresh_token, {
			path: '/',
			maxAge: 7 * 24 * 60 * 60 * 1000,
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
		});
		return { access_token: tokens.access_token };
	}

	        @ApiOperation({
        summary: 'Get_google_4 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/google HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`GET /api/google\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Get('google')
	@UseGuards(AuthGuard('google'))
	async googleAuth() {
		// initiates the Google OAuth flow
	}

	        @ApiOperation({
        summary: 'Get_google_callback_5 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/google/callback HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`GET /api/google/callback\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleAuthRedirect(@Req() req, @Res() res: Response) {
		const tokens = await this.authService.login(req.user);
		res.cookie('refresh_token', tokens.refresh_token, { path: '/', maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
		res.cookie('access_token', tokens.access_token, { path: '/', maxAge: 15 * 60 * 1000, sameSite: 'lax' });
		return res.redirect('http://localhost:5173/auth/callback');
	}

	        @ApiOperation({
        summary: 'Get_github_6 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/github HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`GET /api/github\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Get('github')
	@UseGuards(AuthGuard('github'))
	async githubAuth() {
		// initiates the Github OAuth flow
	}

	        @ApiOperation({
        summary: 'Get_github_callback_7 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
GET /api/github/callback HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`GET /api/github/callback\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Get('github/callback')
	@UseGuards(AuthGuard('github'))
	async githubAuthRedirect(@Req() req, @Res() res: Response) {
		const tokens = await this.authService.login(req.user);
		res.cookie('refresh_token', tokens.refresh_token, { path: '/', maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
		res.cookie('access_token', tokens.access_token, { path: '/', maxAge: 15 * 60 * 1000, sameSite: 'lax' });
		return res.redirect('http://localhost:5173/auth/callback');
	}

	        @ApiOperation({
        summary: 'Post_refresh_8 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/refresh HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/refresh\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post('refresh')
	@HttpCode(200)
	async refresh(@Req() req: Request, @Res() res: Response) {
		const refreshToken = req.cookies?.refresh_token;
		if (!refreshToken) throw new UnauthorizedException('No refresh token');
		const tokens = await this.authService.refreshTokens(refreshToken);
		res.cookie('refresh_token', tokens.refresh_token, {
			httpOnly: true,
			path: '/',
			maxAge: 7 * 24 * 60 * 60 * 1000,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
		});
		return res.json({ access_token: tokens.access_token });
	}

	        @ApiOperation({
        summary: 'Post_logout_9 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/logout HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/logout\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post('logout')
	@HttpCode(200)
	async logout(@Req() req: Request, @Res() res: Response) {
		const refreshToken = req.cookies?.refresh_token;
		if (refreshToken) await this.authService.logout(refreshToken);
		res.clearCookie('refresh_token', { path: '/' });
		return res.json({ ok: true });
	}

	        @ApiOperation({
        summary: 'Post_forgot_password_10 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/forgot-password HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/forgot-password\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post('forgot-password')
	async forgotPassword(@Body() body: { email: string }) {
		if (!body.email) throw new BadRequestException('email is required');
		return this.authService.requestPasswordReset(body.email);
	}

	        @ApiOperation({
        summary: 'Post_verify_reset_code_11 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/verify-reset-code HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/verify-reset-code\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post('verify-reset-code')
	async verifyResetCode(@Body() body: { email: string; code: string }) {
		if (!body.email || !body.code) throw new BadRequestException('Missing email or code');
		return this.authService.verifyResetPasswordCode(body.email, body.code);
	}

	        @ApiOperation({
        summary: 'Post_reset_password_12 operation',
        description: `
### Required Permissions
- Public or authenticated User

### Example Request
\`\`\`http
POST /api/reset-password HTTP/1.1
Content-Type: application/json
\`\`\`

### Example Response
\`\`\`json
{
  "success": true,
  "data": { "id": "example-123" }
}
\`\`\`

### Test Cases (Working Examples)
- **Valid Test Case**: Call \`POST /api/reset-password\` with valid data -> Returns \`200 OK\` or \`201 Created\`.
- **Invalid Test Case**: Call with malformed data or missing fields -> Returns \`400 Bad Request\`.
- **Authentication Test Case**: Call without token (if protected) -> Returns \`401 Unauthorized\`.
        `
    })
    @ApiResponse({ status: 200, description: 'Successful operation' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid parameters/body' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid token' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @Post('reset-password')
	async resetPassword(@Body() body: any) {
		if (!body.token || !body.newPassword || !body.confirmPassword) {
			throw new BadRequestException('Missing required fields');
		}
		return this.authService.resetPassword(body.token, body.newPassword, body.confirmPassword);
	}
}
