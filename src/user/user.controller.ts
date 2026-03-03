import {
	Controller,
	Get,
	Post,
	Body,
	Param,
	Patch,
	Delete,
	HttpException,
	HttpStatus,
	UseGuards,
	UseInterceptors,
	UploadedFile,
	BadRequestException,
	HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync, appendFileSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdatePlacementDto } from './dto/update-placement.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';


const ALLOWED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_IMAGE_MIME_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const avatarStorage = diskStorage({
	destination: (_req, _file, cb) => {
		const dir = join(process.cwd(), 'uploads', 'avatars');
		mkdirSync(dir, { recursive: true });
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		const ext = extname(file.originalname).toLowerCase();
		cb(null, `${(req as any).user.userId}-${Date.now()}${ext}`);
	},
});

const imageFileFilter = (
	_req: any,
	file: Express.Multer.File,
	cb: (error: Error | null, acceptFile: boolean) => void,
) => {
	const ext = extname(file.originalname).toLowerCase();
	if (!ALLOWED_IMAGE_TYPES.includes(ext) || !ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
		return cb(
			new BadRequestException('Only image files are allowed (jpg, jpeg, png, webp)'),
			false,
		);
	}
	cb(null, true);
};

@Controller('user')
export class UserController {
	constructor(
		private readonly userService: UserService,
		private readonly auditLogService: AuditLogService,
	) { }

	private safeDebugLog(obj: any) {
		try {
			appendFileSync(join(process.cwd(), 'debug_nest.log'), JSON.stringify(obj) + '\n');
		} catch (e) {
			// Don't throw - logging failure must not crash the app
			console.error('Failed to write debug_nest.log', e?.message || e);
		}
	}

	// ── Account Settings (must be declared before /:id routes) ───────────────

	@UseGuards(JwtAuthGuard)
	@Get('me')
	async getMyProfile(@CurrentUser() user: { userId: string }) {
		this.safeDebugLog({ hit: 'me', user });
		return this.userService.getMyProfile(user?.userId);
	}

	@UseGuards(JwtAuthGuard)
	@Patch('me/avatar')
	@UseInterceptors(
		FileInterceptor('avatar', {
			storage: avatarStorage,
			fileFilter: imageFileFilter,
			limits: { fileSize: MAX_FILE_SIZE },
		}),
	)
	async uploadAvatar(
		@CurrentUser() user: { userId: string },
		@UploadedFile() file: Express.Multer.File,
	) {
		if (!file) {
			throw new BadRequestException('Avatar file is required');
		}
		return this.userService.updateAvatar(user.userId, file.filename);
	}

	@UseGuards(JwtAuthGuard)
	@Patch('me/password')
	@HttpCode(HttpStatus.OK)
	async changePassword(
		@CurrentUser() user: { userId: string },
		@Body() dto: ChangePasswordDto,
	) {
		return this.userService.changePassword(user.userId, dto);
	}

	@UseGuards(JwtAuthGuard)
	@Patch('me/placement')
	@HttpCode(HttpStatus.OK)
	async updatePlacement(
		@CurrentUser() user: { userId: string },
		@Body() dto: UpdatePlacementDto,
	) {
		return this.userService.updatePlacement(user.userId, dto);
	}

	@UseGuards(JwtAuthGuard)
	@Patch('me')
	async updateProfile(
		@CurrentUser() user: { userId: string },
		@Body() dto: UpdateProfileDto,
	) {
		return this.userService.updateProfile(user.userId, dto);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('me')
	async deleteAccount(
		@CurrentUser() user: { userId: string },
		@Body() dto: DeleteAccountDto,
	) {
		return this.userService.deleteAccount(user.userId, dto);
	}

	// ── Existing CRUD endpoints ───────────────────────────────────────────────

	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('Admin')
	@UseGuards(JwtAuthGuard)
	@Post('admin')
	async createAdmin(@Body() dto: CreateUserDto, @CurrentUser() actor: { userId: string; username?: string }) {
		try {
			const result = await this.userService.create({ ...dto, role: 'Admin' as any });
			await this.auditLogService.create({
				actionType: 'ADMIN_ADDED',
				actor: actor?.username || 'System',
				actorId: actor?.userId,
				entityType: 'admin',
				targetId: result._id?.toString(),
				targetLabel: dto.username,
				newState: { username: dto.username, email: dto.email, role: 'Admin' },
				description: `Admin "${actor?.username || 'System'}" created new admin "${dto.username}"`,
				status: 'active',
			});
			return result;
		} catch (err) {
			throw new HttpException('Failed to create admin', HttpStatus.BAD_REQUEST);
		}
	}

	@Post()
	async create(@Body() dto: CreateUserDto) {
		try {
			return await this.userService.create(dto);
		} catch (err) {
			throw new HttpException('Failed to create user', HttpStatus.BAD_REQUEST);
		}
	}

	@Get()
	async findAll() {
		return await this.userService.findAll();
	}

	@Get(':id')
	async findOne(@Param('id') id: string) {
		this.safeDebugLog({ hit: ':id', id });
		require('fs').appendFileSync('d:/4TWIN/Pi-JS/Next_Gen_Back/AlgoArenaBackEnd/debug_nest.log', JSON.stringify({ hit: ':id', id }) + '\n');
		return await this.userService.findOne(id);
	}

	@UseGuards(JwtAuthGuard)
	@Patch(':id/avatar')
	@UseInterceptors(
		FileInterceptor('avatar', {
			storage: diskStorage({
				destination: (_req, _file, cb) => {
					const dir = join(process.cwd(), 'uploads', 'avatars');
					mkdirSync(dir, { recursive: true });
					cb(null, dir);
				},
				filename: (req, file, cb) => {
					const ext = extname(file.originalname).toLowerCase();
					cb(null, `${req.params.id}-${Date.now()}${ext}`);
				},
			}),
			fileFilter: imageFileFilter,
			limits: { fileSize: MAX_FILE_SIZE },
		}),
	)
	async uploadAvatarByAdmin(
		@Param('id') id: string,
		@UploadedFile() file: Express.Multer.File,
	) {
		if (!file) {
			throw new BadRequestException('Avatar file is required');
		}
		return this.userService.updateAvatar(id, file.filename);
	}

	@UseGuards(JwtAuthGuard)
	@Patch(':id/status')
	async updateStatus(
		@Param('id') id: string,
		@Body() dto: UpdateStatusDto,
		@CurrentUser() actor: { userId: string; username?: string },
	) {
		const previous = await this.userService.findOne(id).catch(() => null) as any;
		const result = await this.userService.updateStatus(id, dto.status);

		const isDisabling = previous?.status === true && dto.status === false;
		const isReactivating = previous?.status === false && dto.status === true;

		await this.auditLogService.create({
			actionType: isDisabling ? 'USER_DISABLED' : isReactivating ? 'USER_REACTIVATED' : 'USER_ROLE_CHANGED',
			actor: actor?.username || 'System',
			actorId: actor?.userId,
			entityType: 'user',
			targetId: id,
			targetLabel: result.username,
			previousState: { status: previous?.status },
			newState: { status: dto.status },
			description: isDisabling
				? `Admin "${actor?.username || 'System'}" disabled account "${result.username}"`
				: isReactivating
					? `Admin "${actor?.username || 'System'}" reactivated account "${result.username}"`
					: `Admin "${actor?.username || 'System'}" updated status of "${result.username}"`,
			status: 'active',
		});

		return result;
	}

	@UseGuards(JwtAuthGuard)
	@Patch(':id')
	async update(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>, @CurrentUser() actor: { userId: string; username?: string }) {
		const previous = await this.userService.findOne(id).catch(() => null) as any;
		const result = await this.userService.update(id, dto) as any;

		// Determine action type
		let actionType = 'USER_ROLE_CHANGED';
		let description = `User "${result.username}" was updated`;
		if (dto.role && dto.role !== previous?.role) {
			description = `Admin "${actor?.username || 'System'}" changed role of "${result.username}" from "${previous?.role}" to "${dto.role}"`;
		} else {
			actionType = 'USER_ROLE_CHANGED';
			description = `Admin "${actor?.username || 'System'}" updated user "${result.username}"`;
		}

		await this.auditLogService.create({
			actionType,
			actor: actor?.username || 'System',
			actorId: actor?.userId,
			entityType: 'user',
			targetId: id,
			targetLabel: result.username,
			previousState: previous ? { role: previous.role, username: previous.username, email: previous.email, bio: previous.bio } : undefined,
			newState: { role: result.role, username: result.username, email: result.email, bio: result.bio },
			description,
			status: 'active',
		});

		return result;
	}
}
