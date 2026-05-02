import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
  Query,
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
import { SaveSpeedTestSessionDto } from './dto/save-speed-test-session.dto';
import { UpdateAccessibilitySettingsDto } from './dto/update-accessibility-settings.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { I18nContext, I18nService } from 'nestjs-i18n';

// Rank order for promo/demotion direction checks
const RANK_ORDER = [
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'DIAMOND',
  'RUBY',
  'EMERALD',
  'SAPPHIRE',
  'OBSIDIAN',
  'ALGOARENA CHAMPION',
];

const ALLOWED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
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
  if (
    !ALLOWED_IMAGE_TYPES.includes(ext) ||
    !ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)
  ) {
    return cb(
      new BadRequestException(
        'Only image files are allowed (jpg, jpeg, png, webp)',
      ),
      false,
    );
  }
  cb(null, true);
};

@ApiTags('Users Profile')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditLogService: AuditLogService,
    private readonly i18n: I18nService,
  ) {}

  private tr(key: string, args?: Record<string, unknown>): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang, args });
  }

  private safeDebugLog(obj: any) {
    try {
      appendFileSync(
        join(process.cwd(), 'debug_nest.log'),
        JSON.stringify(obj) + '\n',
      );
    } catch (e) {
      const error = e as { message?: string };
      console.error('Failed to write debug_nest.log', error?.message || e);
    }
  }

  // ── Account Settings (must be declared before /:id routes) ───────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my profile',
    description:
      "Returns the authenticated user's full profile (excluding password hash).",
  })
  @ApiResponse({ status: 200, description: 'Profile returned successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @Get('me')
  async getMyProfile(@CurrentUser() user: { userId: string }) {
    this.safeDebugLog({ hit: 'me', user });
    return this.userService.getMyProfile(user?.userId);
  }

  // ── Rank & XP Stats ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my rank & XP stats',
    description: `
Returns the authenticated user's gamification stats for the challenges rank bar.
All values are computed from real database data.

### Response Fields
| Field | Type | Description |
|---|---|---|
| \`rank\` | \`string \\| null\` | BRONZE, SILVER, GOLD, PLATINUM, DIAMOND, or null if unranked |
| \`xp\` | \`number\` | Total XP earned |
| \`nextRankXp\` | \`number\` | XP threshold of the next rank |
| \`progressPercentage\` | \`number\` | Progress within current rank band (0–100) |
| \`streak\` | \`number\` | Current daily activity streak (days) |
| \`isMaxRank\` | \`boolean\` | True when user is at DIAMOND (max rank) |

### Example Response
\`\`\`json
{
  "rank": "GOLD",
  "xp": 2450,
  "nextRankXp": 3000,
  "progressPercentage": 63,
  "streak": 7,
  "isMaxRank": false
}
\`\`\`

### Required Permissions
Authenticated user (JWT required)
		`,
  })
  @ApiResponse({
    status: 200,
    description: 'Rank stats returned',
    schema: {
      example: {
        rank: 'GOLD',
        xp: 2450,
        nextRankXp: 3000,
        progressPercentage: 63,
        streak: 7,
        isMaxRank: false,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get('me/rank-stats')
  async getMyRankStats(
    @CurrentUser() user: { userId: string; username?: string },
  ) {
    return this.userService.getRankStats(user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my daily streak',
    description:
      'Returns current streak, longest streak, last login date, motivational streak message, and 7-day activity markers.',
  })
  @ApiResponse({ status: 200, description: 'Streak returned successfully' })
  @Get('me/streak')
  async getMyStreak(@CurrentUser() user: { userId: string }) {
    return this.userService.getStreak(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my accessibility settings' })
  @ApiResponse({
    status: 200,
    description: 'Accessibility settings returned successfully',
  })
  @Get('me/settings/accessibility')
  async getMyAccessibilitySettings(@CurrentUser() user: { userId: string }) {
    return this.userService.getAccessibilitySettings(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my accessibility settings' })
  @ApiResponse({
    status: 200,
    description: 'Accessibility settings updated successfully',
  })
  @Patch('me/settings/accessibility')
  async updateMyAccessibilitySettings(
    @CurrentUser() user: { userId: string },
    @Body() settings: Record<string, unknown>,
  ) {
    return this.userService.updateAccessibilitySettings(
      user.userId,
      settings,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('streak')
  async getStreak(@CurrentUser() user: { userId: string }) {
    return this.userService.getStreak(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('attempts')
  async getMyAttempts(@CurrentUser() user: { userId: string }) {
    return this.userService.getUserAttempts(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update my XP (and auto-update rank)',
    description: `
Adds or subtracts XP from the authenticated user. Rank is automatically recalculated.

Audit logs are created for every call:
- \`XP_UPDATED\` — always
- \`RANK_PROMOTED\` — when rank increases
- \`RANK_DEMOTED\` — when rank decreases

### Example Request
\`\`\`json
{ "xpDelta": 150 }
\`\`\`

### Example Response
\`\`\`json
{
  "previousXp": 2300,
  "newXp": 2450,
  "previousRank": "SILVER",
  "newRank": "GOLD",
  "rankChanged": true
}
\`\`\`
		`,
  })
  @ApiBody({ schema: { example: { xpDelta: 150 } } })
  @ApiResponse({ status: 200, description: 'XP updated and audit logged' })
  @ApiResponse({ status: 400, description: 'Invalid xpDelta' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch('me/xp')
  async updateMyXp(
    @CurrentUser() user: { userId: string; username?: string },
    @Body() body: { xpDelta: number },
  ) {
    const xpDelta = Number(body?.xpDelta);
    if (!Number.isFinite(xpDelta)) {
      throw new BadRequestException(this.tr('userController.xpDeltaInvalid'));
    }

    const result = await this.userService.updateXpAndRank(user.userId, xpDelta);
    const actor = user.username || `user:${user.userId}`;

    // Audit: XP change
    await this.auditLogService.create({
      actionType: 'XP_UPDATED',
      actor: 'System',
      entityType: 'user',
      targetId: user.userId,
      targetLabel: actor,
      previousState: { xp: result.previousXp, rank: result.previousRank },
      newState: { xp: result.newXp, rank: result.newRank },
      description: `System updated user ${actor} XP from ${result.previousXp} to ${result.newXp}`,
      status: 'active',
    });

    // Audit: rank change
    if (result.rankChanged) {
      const prevIdx = result.previousRank
        ? RANK_ORDER.indexOf(result.previousRank)
        : -1;
      const newIdx = RANK_ORDER.indexOf(result.newRank);
      const promoted = newIdx > prevIdx;
      await this.auditLogService.create({
        actionType: promoted ? 'RANK_PROMOTED' : 'RANK_DEMOTED',
        actor: 'System',
        entityType: 'user',
        targetId: user.userId,
        targetLabel: actor,
        previousState: { rank: result.previousRank },
        newState: { rank: result.newRank },
        description: `System ${promoted ? 'promoted' : 'demoted'} user ${actor} from ${result.previousRank ?? 'Unranked'} to ${result.newRank}`,
        status: 'active',
      });
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload my avatar' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
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
      throw new BadRequestException(this.tr('userController.avatarRequired'));
    }
    return this.userService.updateAvatar(user.userId, file.filename);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change my password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: { userId: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit placement test result' })
  @ApiResponse({ status: 200, description: 'Placement updated' })
  @Patch('me/placement')
  @HttpCode(HttpStatus.OK)
  async updatePlacement(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdatePlacementDto,
  ) {
    return this.userService.updatePlacement(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my accessibility settings' })
  @ApiResponse({ status: 200, description: 'Accessibility settings returned' })
  @Get('me/settings/accessibility')
  async getMyAccessibilitySettings(@CurrentUser() user: { userId: string }) {
    return this.userService.getAccessibilitySettings(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my accessibility settings' })
  @ApiResponse({ status: 200, description: 'Accessibility settings updated' })
  @Patch('me/settings/accessibility')
  @HttpCode(HttpStatus.OK)
  async updateMyAccessibilitySettings(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateAccessibilitySettingsDto,
  ) {
    return this.userService.updateAccessibilitySettings(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark speed challenge as completed' })
  @ApiResponse({
    status: 200,
    description: 'Speed challenge marked as completed',
  })
  @Post('me/speed-challenge/complete')
  @HttpCode(HttpStatus.OK)
  async completeSpeedChallenge(@CurrentUser() user: { userId: string }) {
    await this.userService.completeSpeedChallenge(user.userId);
    return { message: this.tr('user.speedChallengeCompleted') };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get hint credit balance' })
  @ApiResponse({ status: 200, description: 'Hint credit balance returned' })
  @Get('me/hints/balance')
  async getHintBalance(@CurrentUser() user: { userId: string }) {
    return this.userService.getHintBalance(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consume one hint credit' })
  @ApiResponse({ status: 200, description: 'Hint credit consumed' })
  @Post('me/hints/consume')
  @HttpCode(HttpStatus.OK)
  async consumeHintCredit(@CurrentUser() user: { userId: string }) {
    return this.userService.consumeHintCredit(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save ongoing speed test session (for resuming later)',
  })
  @ApiResponse({ status: 200, description: 'Session saved successfully' })
  @Post('me/speed-challenge/session/save')
  @HttpCode(HttpStatus.OK)
  async saveSpeedTestSession(
    @CurrentUser() user: { userId: string },
    @Body() sessionData: SaveSpeedTestSessionDto,
  ) {
    await this.userService.saveSpeedTestSession(user.userId, sessionData);
    return { message: this.tr('user.sessionSaved') };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ongoing speed test session (for resuming)' })
  @ApiResponse({ status: 200, description: 'Session retrieved' })
  @Get('me/speed-challenge/session')
  async getSpeedTestSession(@CurrentUser() user: { userId: string }) {
    const session = await this.userService.getSpeedTestSession(user.userId);
    return session || { message: this.tr('user.noOngoingSession') };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear ongoing speed test session' })
  @ApiResponse({ status: 200, description: 'Session cleared' })
  @Post('me/speed-challenge/session/clear')
  @HttpCode(HttpStatus.OK)
  async clearSpeedTestSession(@CurrentUser() user: { userId: string }) {
    await this.userService.clearSpeedTestSession(user.userId);
    return { message: this.tr('user.sessionCleared') };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my profile (username, email, bio)' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @Patch('me')
  async updateProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @Delete('me')
  async deleteAccount(
    @CurrentUser() user: { userId: string },
    @Body() dto: DeleteAccountDto,
  ) {
    return this.userService.deleteAccount(user.userId, dto);
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new admin account (Admin only)' })
  @ApiResponse({ status: 201, description: 'Admin created' })
  @Post('admin')
  async createAdmin(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: { userId: string; username?: string },
  ) {
    try {
      const result = await this.userService.create({
        ...dto,
        role: 'Admin' as any,
      });
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
      throw new HttpException(
        this.tr('userController.failedCreateAdmin'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @Post()
  async create(@Body() dto: CreateUserDto) {
    try {
      return await this.userService.create(dto);
    } catch (err) {
      throw new HttpException(
        this.tr('userController.failedCreateUser'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @ApiOperation({ summary: 'List all users (Admin)' })
  @ApiResponse({ status: 200, description: 'User list' })
  @Get()
  async findAll() {
    return await this.userService.findAll();
  }

  @ApiOperation({ summary: 'List public leaderboard users' })
  @ApiResponse({ status: 200, description: 'Limited public leaderboard list' })
  @Get('leaderboard')
  async findLeaderboard(@Query('limit') limit?: string) {
    return await this.userService.findLeaderboard(Number(limit || 20));
  }

  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId of the user' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.safeDebugLog({ hit: ':id', id });
    return await this.userService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload avatar for a user by ID (Admin)' })
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
      throw new BadRequestException(this.tr('userController.avatarRequired'));
    }
    return this.userService.updateAvatar(id, file.filename);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable a user account (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Status updated and audit logged' })
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: { userId: string; username?: string },
  ) {
    const previous = (await this.userService
      .findOne(id)
      .catch(() => null)) as any;
    const result = await this.userService.updateStatus(id, dto.status);

    const isDisabling = previous?.status === true && dto.status === false;
    const isReactivating = previous?.status === false && dto.status === true;

    await this.auditLogService.create({
      actionType: isDisabling
        ? 'USER_DISABLED'
        : isReactivating
          ? 'USER_REACTIVATED'
          : 'USER_ROLE_CHANGED',
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated and audit logged' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateUserDto>,
    @CurrentUser() actor: { userId: string; username?: string },
  ) {
    const previous = (await this.userService
      .findOne(id)
      .catch(() => null)) as any;
    const result = (await this.userService.update(id, dto)) as any;

    const actionType = 'USER_ROLE_CHANGED';
    let description = `Admin "${actor?.username || 'System'}" updated user "${result.username}"`;
    if (dto.role && dto.role !== previous?.role) {
      description = `Admin "${actor?.username || 'System'}" changed role of "${result.username}" from "${previous?.role}" to "${dto.role}"`;
    }

    await this.auditLogService.create({
      actionType,
      actor: actor?.username || 'System',
      actorId: actor?.userId,
      entityType: 'user',
      targetId: id,
      targetLabel: result.username,
      previousState: previous
        ? {
            role: previous.role,
            username: previous.username,
            email: previous.email,
            bio: previous.bio,
          }
        : undefined,
      newState: {
        role: result.role,
        username: result.username,
        email: result.email,
        bio: result.bio,
      },
      description,
      status: 'active',
    });

    return result;
  }
}
