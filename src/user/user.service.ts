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

  // ── Account Settings ─────────────────────────────────────────────────────

  async getMyProfile(userId: string): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    const { passwordHash: _omit, ...rest } = user as any;
    return rest;
  }

  async updateAvatar(userId: string, filename: string): Promise<{ message: string; avatarUrl: string }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    // Remove old avatar file from disk if one exists
    if ((user as any).avatar) {
      const oldPath = join(process.cwd(), (user as any).avatar);
      try {
        await fs.promises.unlink(oldPath);
      } catch {
        // File may have been removed already — safe to ignore
      }
    }

    const avatarPath = `/uploads/avatars/${filename}`;
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { avatar: avatarPath }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('User not found');

    return { message: 'Avatar updated successfully', avatarUrl: avatarPath };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    this.ensureValidObjectId(userId);
    if (
      dto.username === undefined
      && dto.email === undefined
      && dto.bio === undefined
    ) {
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
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('User not found');

    const { passwordHash: _omit, ...rest } = updated as any;
    return rest;
  }

  async setRefreshTokenHash(userId: string, hash: string | null) {
    this.ensureValidObjectId(userId);
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: hash }).exec();
  }

  // ── Speed Challenge Placement ─────────────────────────────────────────────

  /**
   * Set rank / xp / level from the Speed Challenge placement test.
   * Only applies once (if rank is still null); subsequent calls are ignored
   * unless force=true is passed (reserved for admin resets).
   */
  async updatePlacement(userId: string, dto: UpdatePlacementDto, force = false): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    // Prevent overwriting an existing rank unless forced
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
      .lean()
      .exec() as any;

    const { passwordHash: _omit, ...rest } = updated;
    return rest;
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
      .lean()
      .exec();
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

    // Remove avatar from disk if it exists
    if ((user as any).avatar) {
      const avatarPath = join(process.cwd(), (user as any).avatar);
      try {
        await fs.promises.unlink(avatarPath);
      } catch {
        // File may not exist — safe to ignore
      }
    }

    await this.userModel.findByIdAndDelete(userId).exec();
    return { message: 'Account deleted successfully' };
  }

  // ── Password Reset ───────────────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).sort({ createdAt: -1 }).exec();
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username }).sort({ createdAt: -1 }).exec();
  }


  /**
   * Sets the reset password token and a confirmation code (6 digits) for the user.
   * The confirmation code is required to complete the password reset.
   */
  async setResetPasswordToken(email: string, tokenHash: string, expires: Date, confirmationCode?: string) {
    // Generate a 6-digit code if not provided
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
    // Mark the code as verified if it matches and is not expired
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

