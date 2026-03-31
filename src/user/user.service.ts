import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdatePlacementDto } from './dto/update-placement.dto';

// ── Rank system constants (single source of truth) ──────────────────────────
export const RANK_THRESHOLDS: Record<string, number> = {
  BRONZE: 500,
  SILVER: 1500,
  GOLD: 3000,
  PLATINUM: 5000,
  DIAMOND: 10000,
};

const RANK_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

/** Returns the rank name a user should hold based on their XP. */
export function xpToRank(xp: number): string {
  let rank = 'BRONZE';
  for (const r of RANK_ORDER) {
    if (xp >= RANK_THRESHOLDS[r]) rank = r;
  }
  return rank;
}

@Injectable()
export class UserService {
  constructor(@InjectModel('User') private userModel: Model<any>) { }

  private ensureValidObjectId(id: string) {
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id) || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user id');
    }
  }

  async create(dto: CreateUserDto) {
    const passwordHash = crypto.createHash('sha256').update(dto.password).digest('hex');
    const created = await this.userModel.create({
      username: dto.username,
      passwordHash,
      email: dto.email,
      role: dto.role ?? 'Player',
      avatar: dto.avatar ?? null,
      bio: dto.bio ?? null,
      status: true,
    });
    return created.toObject();
  }

  async findAll() {
    return this.userModel.find().lean().exec();
  }

  async findLatestByUsernameOrEmail(identifier: string) {
    return this.userModel.findOne({
      $or: [{ username: identifier }, { email: identifier }]
    }).sort({ createdAt: -1 }).lean().exec();
  }

  async findOne(id: string) {
    this.ensureValidObjectId(id);
    const user = await this.userModel.findById(id).lean().exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, partial: Partial<CreateUserDto>) {
    this.ensureValidObjectId(id);
    const update: any = {};
    if (partial.username) update.username = partial.username;
    if (partial.email) update.email = partial.email;
    if (partial.avatar !== undefined) update.avatar = partial.avatar;
    if (partial.bio !== undefined) update.bio = partial.bio;
    if (partial.role) update.role = partial.role;
    if (partial.password) update.passwordHash = crypto.createHash('sha256').update(partial.password).digest('hex');

    const updated = await this.userModel.findByIdAndUpdate(id, update, { new: true }).lean().exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  // ── Account Settings ──────────────────────────────────────────────────────

  async getMyProfile(userId: string): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    const { passwordHash: _omit, ...rest } = user as any;
    return rest;
  }

  // ── Rank & XP Stats ───────────────────────────────────────────────────────

  /**
   * Returns gamification stats for the rank bar on the front office challenges page.
   * All values are derived from real DB data — no hardcoding.
   *
   * @returns rank, xp, nextRankXp (XP ceiling of next rank),
   *          progressPercentage (within current rank band), streak, isMaxRank
   */
  async getRankStats(userId: string): Promise<{
    rank: string | null;
    xp: number;
    nextRankXp: number;
    progressPercentage: number;
    streak: number;
    isMaxRank: boolean;
  }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    const xp: number = user.xp ?? 0;
    const rank: string | null = user.rank ?? null;
    const streak: number = user.streak ?? 0;

    // No rank yet (pre-placement)
    if (!rank) {
      return {
        rank: null,
        xp,
        nextRankXp: RANK_THRESHOLDS['BRONZE'],
        progressPercentage: 0,
        streak,
        isMaxRank: false,
      };
    }

    const rankIdx = RANK_ORDER.indexOf(rank);
    const isMaxRank = rankIdx === RANK_ORDER.length - 1;

    // XP floor = the threshold of the previous rank (0 for BRONZE)
    const xpFloor = rankIdx > 0 ? RANK_THRESHOLDS[RANK_ORDER[rankIdx - 1]] : 0;
    // XP ceiling = threshold of current rank
    const xpCeil = RANK_THRESHOLDS[rank];
    // Next rank XP threshold
    const nextRankXp = isMaxRank ? xpCeil : RANK_THRESHOLDS[RANK_ORDER[rankIdx + 1]];

    // Progress within the current rank band
    const bandWidth = xpCeil - xpFloor;
    const xpInBand = Math.max(0, xp - xpFloor);
    const progressPercentage = isMaxRank
      ? 100
      : Math.min(100, Math.round((xpInBand / bandWidth) * 100));

    return { rank, xp, nextRankXp, progressPercentage, streak, isMaxRank };
  }

  /**
   * Adds (or subtracts) XP from a user and auto-promotes / demotes their rank.
   * Returns change details for audit logging in the controller.
   */
  async updateXpAndRank(userId: string, xpDelta: number): Promise<{
    previousXp: number;
    newXp: number;
    previousRank: string | null;
    newRank: string;
    rankChanged: boolean;
  }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    const previousXp: number = user.xp ?? 0;
    const previousRank: string | null = user.rank ?? null;
    const newXp = Math.max(0, previousXp + xpDelta);
    const newRank = xpToRank(newXp);
    const rankChanged = newRank !== previousRank;

    await this.userModel.findByIdAndUpdate(userId, { xp: newXp, rank: newRank }).exec();

    return { previousXp, newXp, previousRank, newRank, rankChanged };
  }

  async updateAvatar(userId: string, filename: string): Promise<{ message: string; avatarUrl: string }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    if ((user as any).avatar) {
      const oldPath = join(process.cwd(), (user as any).avatar);
      try { await fs.promises.unlink(oldPath); } catch { /* already gone */ }
    }

    const avatarPath = `/uploads/avatars/${filename}`;
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { avatar: avatarPath }, { new: true })
      .lean().exec();
    if (!updated) throw new NotFoundException('User not found');

    return { message: 'Avatar updated successfully', avatarUrl: avatarPath };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    this.ensureValidObjectId(userId);
    if (dto.username === undefined && dto.email === undefined && dto.bio === undefined) {
      throw new BadRequestException('At least one field is required: username, email, or bio');
    }

    if (dto.username) {
      const conflict = await this.userModel.findOne({ username: dto.username }).lean().exec();
      if (conflict && (conflict as any)._id.toString() !== userId) {
        throw new ConflictException('Username already taken');
      }
    }

    if (dto.email) {
      const conflict = await this.userModel.findOne({ email: dto.email }).lean().exec();
      if (conflict && (conflict as any)._id.toString() !== userId) {
        throw new ConflictException('Email already in use');
      }
    }

    const update: Record<string, any> = {};
    if (dto.username !== undefined) update.username = dto.username;
    if (dto.email !== undefined) update.email = dto.email;
    if (dto.bio !== undefined) update.bio = dto.bio;

    const updated = await this.userModel
      .findByIdAndUpdate(userId, update, { new: true })
      .lean().exec();
    if (!updated) throw new NotFoundException('User not found');

    const { passwordHash: _omit, ...rest } = updated as any;
    return rest;
  }

  async setRefreshTokenHash(userId: string, hash: string | null) {
    this.ensureValidObjectId(userId);
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: hash }).exec();
  }

  // ── Speed Challenge Placement ─────────────────────────────────────────────

  async updatePlacement(userId: string, dto: UpdatePlacementDto, force = false): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    if (user.rank && !force) {
      const { passwordHash: _omit, ...rest } = user;
      return rest;
    }

    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { rank: dto.rank, xp: dto.xp, level: dto.level ?? dto.rank },
        { new: true },
      )
      .lean().exec() as any;

    const { passwordHash: _omit, ...rest } = updated;
    return rest;
  }

  async setPlacementProblems(userId: string, problems: any[]) {
    this.ensureValidObjectId(userId);
    await this.userModel.findByIdAndUpdate(userId, { placementProblems: problems }, { new: true }).exec();
  }

  async completeSpeedChallenge(userId: string): Promise<void> {
    this.ensureValidObjectId(userId);
    await this.userModel.findByIdAndUpdate(userId, { speedChallengeCompleted: true }, { new: true }).exec();
  }

  async hasCompletedSpeedChallenge(userId: string): Promise<boolean> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    return user ? (user as any).speedChallengeCompleted === true : false;
  }

  async saveSpeedTestSession(userId: string, sessionData: any): Promise<void> {
    this.ensureValidObjectId(userId);
    await this.userModel.findByIdAndUpdate(
      userId,
      {
        speedTestSession: {
          ...sessionData,
          savedAt: new Date(),
        },
      },
      { new: true }
    ).exec();
  }

  async getSpeedTestSession(userId: string): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    return user ? (user as any).speedTestSession : null;
  }

  async clearSpeedTestSession(userId: string): Promise<void> {
    this.ensureValidObjectId(userId);
    await this.userModel.findByIdAndUpdate(
      userId,
      {
        speedTestSession: {
          phase: null,
          secondsLeft: null,
          currentIndex: null,
          solvedIds: [],
          codes: {},
          languages: {},
          elapsedSeconds: null,
          savedAt: null,
        },
      },
      { new: true }
    ).exec();
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('newPassword and confirmPassword do not match');
    }

    const currentHash = crypto.createHash('sha256').update(dto.currentPassword).digest('hex');
    if ((user as any).passwordHash !== currentHash) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newHash = crypto.createHash('sha256').update(dto.newPassword).digest('hex');
    await this.userModel.findByIdAndUpdate(userId, { passwordHash: newHash }).exec();

    return { message: 'Password updated successfully' };
  }

  async updateStatus(id: string, status: boolean): Promise<any> {
    this.ensureValidObjectId(id);
    const updated = await this.userModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .lean().exec();
    if (!updated) throw new NotFoundException('User not found');

    const { passwordHash: _omit, ...rest } = updated as any;
    return rest;
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<{ message: string }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    const hash = crypto.createHash('sha256').update(dto.password).digest('hex');
    if ((user as any).passwordHash !== hash) {
      throw new UnauthorizedException('Invalid password');
    }

    if ((user as any).avatar) {
      const avatarPath = join(process.cwd(), (user as any).avatar);
      try { await fs.promises.unlink(avatarPath); } catch { /* already gone */ }
    }

    await this.userModel.findByIdAndDelete(userId).exec();
    return { message: 'Account deleted successfully' };
  }

  // ── Password Reset ────────────────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).sort({ createdAt: -1 }).exec();
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username }).sort({ createdAt: -1 }).exec();
  }

  async setResetPasswordToken(email: string, tokenHash: string, expires: Date, confirmationCode?: string) {
    const code = confirmationCode || Math.floor(100000 + Math.random() * 900000).toString();
    return this.userModel.findOneAndUpdate(
      { email },
      {
        resetPasswordToken: tokenHash,
        resetPasswordExpires: expires,
        resetPasswordCode: code,
        resetPasswordCodeVerified: false,
      },
      { new: true, sort: { createdAt: -1 } },
    ).exec();
  }

  async findByResetPasswordToken(tokenHash: string) {
    return this.userModel.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).exec();
  }

  async findByEmailAndResetCode(email: string, code: string) {
    const c = String(code).trim();
    return this.userModel.findOne({
      email,
      resetPasswordCode: c,
      resetPasswordExpires: { $gt: new Date() },
      resetPasswordToken: { $ne: null },
      resetPasswordCodeVerified: false,
    }).exec();
  }

  async verifyResetPasswordCode(email: string, code: string) {
    const user = await this.findByEmailAndResetCode(email, String(code).trim());
    if (!user) return null;
    await this.userModel.findByIdAndUpdate(user._id, { resetPasswordCodeVerified: true }).exec();
    return user;
  }

  async updatePasswordAndClearToken(userId: string, passwordHash: string) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        resetPasswordCode: null,
        resetPasswordCodeVerified: false,
      },
      { new: true },
    ).exec();
  }
}
