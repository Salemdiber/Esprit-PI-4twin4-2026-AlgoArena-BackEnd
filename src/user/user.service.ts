import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
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
import { UpdateAccessibilitySettingsDto } from './dto/update-accessibility-settings.dto';

const DEFAULT_ACCESSIBILITY_SETTINGS = {
  highContrast: false,
  reducedMotion: false,
  dyslexiaFont: false,
  fontScale: 'medium',
  voiceMode: false,
  voiceCommandsEnabled: false,
};

const FONT_SCALES = new Set(['small', 'medium', 'large']);

// â”€â”€ Rank system constants (single source of truth) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const RANK_CONFIG = [
  {
    level: 1,
    name: 'BRONZE',
    title: 'Novice',
    xpRequired: 500,
    badgeColor: '#CD7F32',
  },
  {
    level: 2,
    name: 'SILVER',
    title: 'Apprentice',
    xpRequired: 1500,
    badgeColor: '#C0C0C0',
  },
  {
    level: 3,
    name: 'GOLD',
    title: 'Coder',
    xpRequired: 3000,
    badgeColor: '#FFD700',
  },
  {
    level: 4,
    name: 'PLATINUM',
    title: 'Developer',
    xpRequired: 5000,
    badgeColor: '#E5E4E2',
  },
  {
    level: 5,
    name: 'DIAMOND',
    title: 'Engineer',
    xpRequired: 10000,
    badgeColor: '#B9F2FF',
  },
  {
    level: 6,
    name: 'RUBY',
    title: 'Architect',
    xpRequired: 15000,
    badgeColor: '#E0115F',
  },
  {
    level: 7,
    name: 'EMERALD',
    title: 'Master',
    xpRequired: 25000,
    badgeColor: '#50C878',
  },
  {
    level: 8,
    name: 'SAPPHIRE',
    title: 'Grandmaster',
    xpRequired: 40000,
    badgeColor: '#0F52BA',
  },
  {
    level: 9,
    name: 'OBSIDIAN',
    title: 'Legend',
    xpRequired: 60000,
    badgeColor: '#3D3635',
  },
  {
    level: 10,
    name: 'ALGOARENA CHAMPION',
    title: 'Champion',
    xpRequired: 100000,
    badgeColor: '#D4AF37',
  },
] as const;

export const RANK_THRESHOLDS: Record<string, number> = RANK_CONFIG.reduce(
  (acc, rank) => {
    acc[rank.name] = rank.xpRequired;
    return acc;
  },
  {} as Record<string, number>,
);

const RANK_ORDER = RANK_CONFIG.map((rank) => rank.name);
const STREAK_ACTIVITY_WINDOW_DAYS = 30;
const ABANDON_AFTER_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

const STREAK_MESSAGES = {
  dayOne: [
    "Welcome back, warrior! Every legend starts with Day 1. Let's build something unstoppable. \u{1F525}",
    "Day 1 — The grind begins NOW. Show these algorithms who's boss! \u{1F4AA}",
    'Fresh start, fresh fire. Your coding journey resets today. Make it count! \u{1F680}',
    'Day 1 locked in. One solid session today can change your entire trajectory. \u{2B50}',
    "A new streak starts today. Keep showing up and you'll shock yourself in a week. \u{1F947}",
  ],
  buildMomentum: [
    "Day {streak} — You're building momentum! Keep this energy going and watch your skills skyrocket! \u{26A1}",
    "{streak} days strong! The consistency is starting to show. Don't stop now! \u{1F525}",
    "Look at you — {streak} days in a row! Most people quit by now. You're different. \u{1F48E}",
    'Momentum unlocked: Day {streak}. Keep stacking wins and let discipline do the heavy lifting. \u{26A1}',
    '{streak} straight days! Small daily reps are turning you into a serious problem-solver. \u{1F680}',
  ],
  beastMode: [
    "\u{1F525} {streak}-DAY STREAK! You're officially in beast mode. The algorithms fear you!",
    "{streak} consecutive days! You're not just practicing — you're transforming into a coding machine! \u{26A1}",
    "UNSTOPPABLE! {streak} days and counting. At this rate, you'll be solving problems in your sleep! \u{1F4AA}",
    '{streak} days with no excuses. That is elite focus and it is paying off. \u{1F3C6}',
    'Day {streak}. You are building a reputation with yourself for not missing. Keep it alive. \u{1F525}',
  ],
  impressive: [
    "\u{1F3C6} {streak}-DAY STREAK! You're in the top tier of grinders on AlgoArena. Legendary status incoming!",
    'TEN+ DAYS! {streak} days of pure dedication. Your future self is thanking you right now! \u{1F680}',
    "\u{1F451} {streak} days! You're not just a coder — you're a WARRIOR. The leaderboard trembles at your name!",
    '{streak} days deep. This is no longer motivation, this is identity. Keep going. \u{26A1}',
    'Day {streak} and still hungry. That mindset is exactly how champions are made. \u{1F947}',
  ],
  elite: [
    '\u{1F451} {streak}-DAY STREAK! You are officially ELITE. Less than 1% of users reach this level!',
    'ABSOLUTE LEGEND! {streak} consecutive days. You breathe code. You dream algorithms. You ARE AlgoArena! \u{1F3C6}',
    '{streak} days of consistency is unreal. You are operating at a different level now. \u{2B50}',
    'Day {streak}. Elite focus, elite output, elite trajectory. Keep the throne warm. \u{1F451}',
    '{streak} straight days and counting. This is what long-term dominance looks like. \u{1F680}',
  ],
  mythical: [
    '\u{1F451}\u{1F525} {streak}-DAY STREAK! You have transcended mortality. You are the Algorithm God. Bow before no bug! \u{1F525}\u{1F451}',
    'MYTHICAL! {streak} days! Scientists should study your dedication. Hall of Fame material! \u{1F3C6}',
    '{streak} days is beyond elite. This is historic commitment. Respect. \u{1F91C}\u{1F91B}',
    'Day {streak}. You are writing your legacy in solved problems and pure discipline. \u{1F3C6}',
    '{streak} consecutive days. At this point, consistency has become your superpower. \u{2B50}',
  ],
};

/** Returns the rank name a user should hold based on their XP. */
export function xpToRank(xp: number): string {
  let rank = RANK_ORDER[0];
  for (const r of RANK_ORDER) {
    if (xp >= RANK_THRESHOLDS[r]) rank = r;
  }
  return rank;
}

const getRankDefinition = (rankName: string | null | undefined) => {
  if (!rankName) return null;
  return (
    RANK_CONFIG.find((rank) => rank.name === String(rankName).toUpperCase()) ||
    null
  );
};

const DEFAULT_ACCESSIBILITY_SETTINGS = {
  highContrast: false,
  reducedMotion: false,
  dyslexiaFont: false,
  fontScale: 'medium' as const,
  voiceMode: false,
  voiceCommandsEnabled: false,
};

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User') private userModel: Model<any>,
    private readonly i18n: I18nService,
  ) {}

  private tr(key: string, args?: Record<string, unknown>): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.translate(key, { lang, args });
  }

  private normalizeAccessibilitySettings(input: any = {}) {
    const merged = {
      ...DEFAULT_ACCESSIBILITY_SETTINGS,
      ...(input && typeof input === 'object' ? input : {}),
    };

    return {
      highContrast: Boolean(merged.highContrast),
      reducedMotion: Boolean(merged.reducedMotion),
      dyslexiaFont: Boolean(merged.dyslexiaFont),
      fontScale: FONT_SCALES.has(String(merged.fontScale))
        ? String(merged.fontScale)
        : DEFAULT_ACCESSIBILITY_SETTINGS.fontScale,
      voiceMode: Boolean(merged.voiceMode),
      voiceCommandsEnabled: Boolean(merged.voiceCommandsEnabled),
    };
  }

  private utcDateOnly(value: Date = new Date()): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private dateToken(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private daysBetweenUtc(a: Date, b: Date): number {
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.round(
      (this.utcDateOnly(a).getTime() - this.utcDateOnly(b).getTime()) / dayMs,
    );
  }

  private pickTierMessage(streak: number): string {
    const pick = (pool: string[]) =>
      pool[Math.floor(Math.random() * pool.length)];
    if (streak <= 1) return pick(STREAK_MESSAGES.dayOne);
    if (streak <= 4)
      return pick(STREAK_MESSAGES.buildMomentum).replaceAll(
        '{streak}',
        String(streak),
      );
    if (streak <= 9)
      return pick(STREAK_MESSAGES.beastMode).replaceAll(
        '{streak}',
        String(streak),
      );
    if (streak <= 19)
      return pick(STREAK_MESSAGES.impressive).replaceAll(
        '{streak}',
        String(streak),
      );
    if (streak <= 49)
      return pick(STREAK_MESSAGES.elite).replaceAll('{streak}', String(streak));
    return pick(STREAK_MESSAGES.mythical).replaceAll(
      '{streak}',
      String(streak),
    );
  }

  private buildRecentActivity(
    loginActivityDates: string[] = [],
    referenceDay: Date = new Date(),
  ): boolean[] {
    const normalized = new Set(loginActivityDates);
    const start = this.utcDateOnly(referenceDay);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() - (6 - index));
      return normalized.has(this.dateToken(day));
    });
  }

  private ensureValidObjectId(id: string) {
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id) || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(this.tr('user.invalidId'));
    }
  }

  async create(dto: CreateUserDto) {
    const passwordHash = crypto
      .createHash('sha256')
      .update(dto.password)
      .digest('hex');
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

  async findLeaderboard(limit = 20) {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const projection = {
      username: 1,
      role: 1,
      avatar: 1,
      rank: 1,
      level: 1,
      xp: 1,
      currentStreak: 1,
      streak: 1,
      longestStreak: 1,
      lastLoginDate: 1,
      streakUpdatedAt: 1,
      challengeProgress: 1,
      createdAt: 1,
      updatedAt: 1,
    };

    const [items, total] = await Promise.all([
      this.userModel
        .find({ role: { $ne: 'Admin' } }, projection)
        .sort({ xp: -1, currentStreak: -1, streak: -1, username: 1 })
        .limit(safeLimit)
        .lean()
        .exec(),
      this.userModel.countDocuments({ role: { $ne: 'Admin' } }).exec(),
    ]);

    return { items, total, limit: safeLimit };
  }

  async findLatestByUsernameOrEmail(identifier: string) {
    return this.userModel
      .findOne({
        $or: [{ username: identifier }, { email: identifier }],
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string) {
    this.ensureValidObjectId(id);
    const user = await this.userModel.findById(id).lean().exec();
    if (!user) throw new NotFoundException(this.tr('user.notFound'));
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
    if (partial.password)
      update.passwordHash = crypto
        .createHash('sha256')
        .update(partial.password)
        .digest('hex');

    const updated = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(this.tr('user.notFound'));
    return updated;
  }

  private normalizeAccessibilitySettings(settings: any = {}) {
    return {
      highContrast:
        typeof settings?.highContrast === 'boolean'
          ? settings.highContrast
          : DEFAULT_ACCESSIBILITY_SETTINGS.highContrast,
      reducedMotion:
        typeof settings?.reducedMotion === 'boolean'
          ? settings.reducedMotion
          : DEFAULT_ACCESSIBILITY_SETTINGS.reducedMotion,
      dyslexiaFont:
        typeof settings?.dyslexiaFont === 'boolean'
          ? settings.dyslexiaFont
          : DEFAULT_ACCESSIBILITY_SETTINGS.dyslexiaFont,
      fontScale: ['small', 'medium', 'large'].includes(settings?.fontScale)
        ? settings.fontScale
        : DEFAULT_ACCESSIBILITY_SETTINGS.fontScale,
      voiceMode:
        typeof settings?.voiceMode === 'boolean'
          ? settings.voiceMode
          : DEFAULT_ACCESSIBILITY_SETTINGS.voiceMode,
      voiceCommandsEnabled:
        typeof settings?.voiceCommandsEnabled === 'boolean'
          ? settings.voiceCommandsEnabled
          : DEFAULT_ACCESSIBILITY_SETTINGS.voiceCommandsEnabled,
    };
  }

  async getAccessibilitySettings(userId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException(this.tr('user.notFound'));
    return this.normalizeAccessibilitySettings((user as any).accessibilitySettings);
  }

  async updateAccessibilitySettings(
    userId: string,
    dto: UpdateAccessibilitySettingsDto,
  ) {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const current = this.normalizeAccessibilitySettings(
      (user as any).accessibilitySettings,
    );
    const next = this.normalizeAccessibilitySettings({ ...current, ...dto });

    await this.userModel
      .findByIdAndUpdate(userId, { accessibilitySettings: next }, { new: true })
      .exec();

    return next;
  }

  // â”€â”€ Account Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getMyProfile(userId: string): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const { passwordHash: _omit, ...rest } = user as any;
    const rankStats = await this.getRankStats(userId);
    return {
      ...rest,
      rank: rankStats.rank,
      rankDetails: rankStats.rankDetails,
      nextRank: rankStats.nextRank,
      totalXP: rankStats.totalXP,
      xpInCurrentRank: rankStats.xpInCurrentRank,
      xpNeededForNextRank: rankStats.xpNeededForNextRank,
      progressPercent: rankStats.progressPercent,
      isMaxRank: rankStats.isMaxRank,
      hintCredits: Number((user as any).hintCredits ?? 1),
      totalHintsUsed: Number((user as any).totalHintsUsed ?? 0),
    };
  }

  async getAccessibilitySettings(userId: string) {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel
      .findById(userId, { accessibilitySettings: 1 })
      .lean()
      .exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));
    return this.normalizeAccessibilitySettings(user.accessibilitySettings);
  }

  async updateAccessibilitySettings(userId: string, settings: any) {
    this.ensureValidObjectId(userId);
    const accessibilitySettings =
      this.normalizeAccessibilitySettings(settings);
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { accessibilitySettings },
        { new: true, projection: { accessibilitySettings: 1 } },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(this.tr('user.notFound'));
    return accessibilitySettings;
  }

  async syncDailyStreak(userId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastLoginDate: string;
    streakMessage: string;
    recentActivity: boolean[];
  }> {
    this.ensureValidObjectId(userId);
    const now = new Date();
    const today = this.utcDateOnly(now);
    const todayToken = this.dateToken(today);

    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const lastLoginDateRaw = user.lastLoginDate
      ? new Date(user.lastLoginDate)
      : null;
    const lastLoginDay = lastLoginDateRaw
      ? this.utcDateOnly(lastLoginDateRaw)
      : null;
    const previousCurrent = Number(user.currentStreak ?? user.streak ?? 0);
    const previousLongest = Number(user.longestStreak ?? user.streak ?? 0);
    const loginActivityDates = Array.isArray(user.loginActivityDates)
      ? [...user.loginActivityDates]
      : [];

    let currentStreak = previousCurrent;
    let longestStreak = previousLongest;
    let shouldPersist = false;

    if (!lastLoginDay) {
      currentStreak = 1;
      longestStreak = Math.max(longestStreak, 1);
      shouldPersist = true;
    } else {
      const diffDays = this.daysBetweenUtc(today, lastLoginDay);
      if (diffDays === 0) {
        // already counted today
      } else if (diffDays === 1) {
        currentStreak = previousCurrent + 1;
        longestStreak = Math.max(longestStreak, currentStreak);
        shouldPersist = true;
      } else if (diffDays > 1) {
        currentStreak = 1;
        longestStreak = Math.max(
          longestStreak,
          previousCurrent,
          previousLongest,
          1,
        );
        shouldPersist = true;
      }
    }

    const nextActivitySet = new Set(loginActivityDates);
    nextActivitySet.add(todayToken);
    const nextActivity = [...nextActivitySet]
      .sort((a, b) => (a < b ? -1 : 1))
      .slice(-STREAK_ACTIVITY_WINDOW_DAYS);

    if (shouldPersist || !loginActivityDates.includes(todayToken)) {
      await this.userModel
        .findByIdAndUpdate(userId, {
          currentStreak,
          longestStreak,
          streak: currentStreak,
          lastLoginDate: today,
          streakUpdatedAt: now,
          loginActivityDates: nextActivity,
        })
        .exec();
    } else if (Number(user.streak ?? 0) !== currentStreak) {
      await this.userModel
        .findByIdAndUpdate(userId, { streak: currentStreak })
        .exec();
    }

    return {
      currentStreak,
      longestStreak,
      lastLoginDate: today.toISOString(),
      streakMessage: this.pickTierMessage(currentStreak),
      recentActivity: this.buildRecentActivity(nextActivity, now),
    };
  }

  async getStreak(userId: string) {
    const synced = await this.syncDailyStreak(userId);
    return synced;
  }

  // â”€â”€ Rank & XP Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Returns gamification stats for the rank bar on the front office challenges page.
   * All values are derived from real DB data â€” no hardcoding.
   *
   * @returns rank, xp, nextRankXp (XP ceiling of next rank),
   *          progressPercentage (within current rank band), streak, isMaxRank
   */
  async getRankStats(userId: string): Promise<{
    rank: string | null;
    rankDetails: {
      level: number;
      name: string;
      title: string;
      badgeColor: string;
    } | null;
    nextRank: {
      level: number;
      name: string;
      title: string;
      xpRequired: number;
    } | null;
    totalXP: number;
    xpInCurrentRank: number;
    xpNeededForNextRank: number;
    xp: number;
    nextRankXp: number;
    progressPercentage: number;
    progressPercent: number;
    streak: number;
    isMaxRank: boolean;
  }> {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const xp: number = Number(user.xp ?? 0);
    const calculatedRank = xpToRank(xp);
    const persistedRank = user.rank ?? null;
    const rank: string | null = persistedRank || calculatedRank || null;
    const streak: number = user.currentStreak ?? user.streak ?? 0;

    if (!rank) {
      return {
        rank: null,
        rankDetails: null,
        nextRank: RANK_CONFIG[0],
        totalXP: xp,
        xpInCurrentRank: 0,
        xpNeededForNextRank: RANK_CONFIG[0].xpRequired,
        xp,
        nextRankXp: RANK_CONFIG[0].xpRequired,
        progressPercentage: 0,
        progressPercent: 0,
        streak,
        isMaxRank: false,
      };
    }

    const rankIdx = RANK_ORDER.indexOf(rank as (typeof RANK_ORDER)[number]);
    const isMaxRank = rankIdx === RANK_ORDER.length - 1;
    const currentRank = getRankDefinition(rank) || RANK_CONFIG[0];
    const nextRank = !isMaxRank ? RANK_CONFIG[rankIdx + 1] : null;
    const xpFloor = currentRank.xpRequired;
    const xpCeil = nextRank?.xpRequired ?? currentRank.xpRequired;
    const xpInCurrentRank = Math.max(0, xp - xpFloor);
    const xpNeededForNextRank = nextRank ? Math.max(0, xpCeil - xp) : 0;
    const progressPercentage = nextRank
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((xp - xpFloor) / Math.max(1, xpCeil - xpFloor)) * 100),
          ),
        )
      : 100;

    return {
      rank,
      rankDetails: {
        level: currentRank.level,
        name: currentRank.name,
        title: currentRank.title,
        badgeColor: currentRank.badgeColor,
      },
      nextRank: nextRank
        ? {
            level: nextRank.level,
            name: nextRank.name,
            title: nextRank.title,
            xpRequired: nextRank.xpRequired,
          }
        : null,
      totalXP: xp,
      xpInCurrentRank,
      xpNeededForNextRank,
      xp,
      nextRankXp: nextRank?.xpRequired ?? currentRank.xpRequired,
      progressPercentage,
      progressPercent: progressPercentage,
      streak,
      isMaxRank,
    };
  }

  /**
   * Adds (or subtracts) XP from a user and auto-promotes / demotes their rank.
   * Returns change details for audit logging in the controller.
   */
  async updateXpAndRank(
    userId: string,
    xpDelta: number,
  ): Promise<{
    previousXp: number;
    newXp: number;
    previousRank: string | null;
    newRank: string;
    rankChanged: boolean;
    rankUpgraded: boolean;
    newRankDetails: {
      level: number;
      name: string;
      title: string;
      badgeColor: string;
    } | null;
  }> {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const previousXp: number = user.xp ?? 0;
    const previousRank: string | null = user.rank ?? null;
    const newXp = Math.max(0, previousXp + xpDelta);
    const newRank = xpToRank(newXp);
    const rankChanged = newRank !== previousRank;
    const previousIdx = previousRank
      ? RANK_ORDER.indexOf(previousRank as (typeof RANK_ORDER)[number])
      : -1;
    const nextIdx = RANK_ORDER.indexOf(newRank as (typeof RANK_ORDER)[number]);
    const rankUpgraded = rankChanged && nextIdx > previousIdx;

    await this.userModel
      .findByIdAndUpdate(userId, { xp: newXp, rank: newRank })
      .exec();

    const newRankDef = getRankDefinition(newRank);
    return {
      previousXp,
      newXp,
      previousRank,
      newRank,
      rankChanged,
      rankUpgraded,
      newRankDetails: newRankDef
        ? {
            level: newRankDef.level,
            name: newRankDef.name,
            title: newRankDef.title,
            badgeColor: newRankDef.badgeColor,
          }
        : null,
    };
  }

  async getChallengeProgress(userId: string): Promise<any[]> {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));
    return Array.isArray(user.challengeProgress) ? user.challengeProgress : [];
  }

  async getChallengeProgressEntry(
    userId: string,
    challengeId: string,
  ): Promise<any | null> {
    const progress = await this.getChallengeProgress(userId);
    return (
      progress.find((entry: any) => entry.challengeId === challengeId) || null
    );
  }

  private createDefaultProgressEntry(challengeId: string) {
    return {
      challengeId,
      status: 'UNSOLVED',
      failedAttempts: 0,
      solveTimeSeconds: null,
      xpAwarded: 0,
      solvedAt: null,
      attemptId: null,
      attemptStatus: 'completed',
      mode: 'challenge',
      attemptStartedAt: null,
      lastActiveAt: null,
      lastAttemptAt: null,
      savedCode: '',
      totalElapsedTime: 0,
      wasReduced: false,
      leftAt: null,
      gracePeriodExpiresAt: null,
      returnedAt: null,
      abandonmentReason: null,
      incompleteAttemptCount: 0,
      submissions: [],
    };
  }

  private normalizeInactivityEntry(entry: any, now = new Date()) {
    if (!entry) return entry;
    if (entry.status === 'SOLVED') return entry;
    if (entry.attemptStatus !== 'in_progress') return entry;

    const lastActiveSource =
      entry.lastActiveAt || entry.lastAttemptAt || entry.attemptStartedAt;
    if (!lastActiveSource) return entry;

    const lastActive = new Date(lastActiveSource);
    if (!Number.isFinite(lastActive.getTime())) return entry;
    if (now.getTime() - lastActive.getTime() <= ABANDON_AFTER_INACTIVITY_MS)
      return entry;

    return {
      ...entry,
      attemptStatus: 'abandoned',
      abandonmentReason: entry.abandonmentReason || 'left_page',
      leftAt: entry.leftAt || lastActive,
      gracePeriodExpiresAt: null,
      incompleteAttemptCount: Number(entry.incompleteAttemptCount || 0) + 1,
    };
  }

  private normalizeElapsedByMode(
    mode: 'challenge' | 'practice' | 'contest',
    elapsedTime: number,
    fallbackValue = 0,
  ) {
    if (mode === 'practice') {
      return 0;
    }
    if (mode === 'contest') {
      // Contest mode wiring placeholder: timer policy will be enforced in dedicated contest flow.
      return Math.max(0, Number(elapsedTime || fallbackValue || 0));
    }
    return Math.max(0, Number(elapsedTime || fallbackValue || 0));
  }

  private syncInactivityLifecycle(progress: any[] = []) {
    const now = new Date();
    let changed = false;
    const next = progress.map((entry) => {
      const normalized = this.normalizeInactivityEntry(entry, now);
      if (normalized !== entry) changed = true;
      return normalized;
    });
    return { changed, next };
  }

  async startChallengeAttempt(
    userId: string,
    challengeId: string,
    mode: 'challenge' | 'practice' | 'contest' = 'challenge',
  ) {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const challengeProgressRaw = Array.isArray(user.challengeProgress)
      ? [...user.challengeProgress]
      : [];
    const { changed, next } =
      this.syncInactivityLifecycle(challengeProgressRaw);
    const challengeProgress = next;
    const index = challengeProgress.findIndex(
      (entry: any) => entry.challengeId === challengeId,
    );
    const existing =
      index >= 0
        ? challengeProgress[index]
        : this.createDefaultProgressEntry(challengeId);

    if (existing.status === 'SOLVED') {
      return {
        challengeId,
        attemptId: existing.attemptId || null,
        startedAt: existing.attemptStartedAt || null,
        status: 'completed',
        resumed: false,
        savedCode: existing.savedCode || '',
        elapsedTime: Number(existing.totalElapsedTime || 0),
        mode: existing.mode || mode,
      };
    }

    const now = new Date();
    if (existing.attemptStatus === 'in_progress' && existing.attemptId) {
      if (changed) {
        await this.userModel
          .findByIdAndUpdate(userId, { challengeProgress })
          .exec();
      }
      return {
        challengeId,
        attemptId: existing.attemptId,
        startedAt: existing.attemptStartedAt || now.toISOString(),
        status: 'in_progress',
        resumed: true,
        savedCode: existing.savedCode || '',
        elapsedTime: Number(existing.totalElapsedTime || 0),
        mode: existing.mode || mode,
      };
    }

    const attemptId = `${challengeId}-${now.getTime()}`;
    const nextEntry = {
      ...existing,
      attemptId,
      attemptStatus: 'in_progress',
      mode: existing.mode || mode,
      attemptStartedAt: existing.attemptStartedAt || now,
      lastActiveAt: now,
      lastAttemptAt: now,
      leftAt: null,
      gracePeriodExpiresAt: null,
      returnedAt: null,
      abandonmentReason: null,
    };

    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);

    await this.userModel
      .findByIdAndUpdate(userId, { challengeProgress })
      .exec();
    return {
      challengeId,
      attemptId,
      startedAt: now.toISOString(),
      status: nextEntry.attemptStatus,
      resumed: false,
      savedCode: nextEntry.savedCode || '',
      elapsedTime: Number(nextEntry.totalElapsedTime || 0),
      mode: nextEntry.mode || mode,
    };
  }

  async saveChallengeAttempt(
    userId: string,
    challengeId: string,
    payload: {
      attemptId?: string | null;
      savedCode?: string;
      elapsedTime?: number;
      mode?: 'challenge' | 'practice' | 'contest';
      reason?: 'left_page' | 'tab_closed' | 'manual_save';
    },
  ) {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const challengeProgressRaw = Array.isArray(user.challengeProgress)
      ? [...user.challengeProgress]
      : [];
    const { next } = this.syncInactivityLifecycle(challengeProgressRaw);
    const challengeProgress = next;
    const index = challengeProgress.findIndex(
      (entry: any) => entry.challengeId === challengeId,
    );
    const existing =
      index >= 0
        ? challengeProgress[index]
        : this.createDefaultProgressEntry(challengeId);
    const now = new Date();
    const mode = payload?.mode || existing.mode || 'challenge';
    const elapsedTime = this.normalizeElapsedByMode(
      mode,
      Number(payload?.elapsedTime || 0),
      Number(existing.totalElapsedTime || 0),
    );
    const attemptId =
      payload?.attemptId ||
      existing.attemptId ||
      `${challengeId}-${now.getTime()}`;

    const nextEntry = {
      ...existing,
      attemptId,
      attemptStatus: existing.status === 'SOLVED' ? 'completed' : 'in_progress',
      mode,
      attemptStartedAt: existing.attemptStartedAt || now,
      lastActiveAt: now,
      lastAttemptAt: now,
      savedCode: payload?.savedCode ?? existing.savedCode ?? '',
      totalElapsedTime: elapsedTime,
      leftAt:
        payload?.reason === 'left_page' || payload?.reason === 'tab_closed'
          ? now
          : existing.leftAt || null,
      gracePeriodExpiresAt: null,
      returnedAt: existing.returnedAt || null,
      abandonmentReason: null,
    };

    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);

    await this.userModel
      .findByIdAndUpdate(userId, { challengeProgress })
      .exec();
    return {
      challengeId,
      attemptId: nextEntry.attemptId,
      status: nextEntry.attemptStatus,
      mode: nextEntry.mode,
      savedCode: nextEntry.savedCode,
      elapsedTime: Number(nextEntry.totalElapsedTime || 0),
      savedAt: now.toISOString(),
      saved: true,
    };
  }

  async leaveChallengeAttempt(
    userId: string,
    challengeId: string,
    reason: 'left_page' | 'tab_closed' = 'left_page',
    payload?: {
      savedCode?: string;
      elapsedTime?: number;
      attemptId?: string | null;
    },
  ) {
    return this.saveChallengeAttempt(userId, challengeId, {
      ...payload,
      reason,
    });
  }

  async abandonChallengeAttempt(
    userId: string,
    challengeId: string,
    reason: 'timeout' | 'left_page' | 'tab_closed' = 'timeout',
  ) {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));
    const challengeProgressRaw = Array.isArray(user.challengeProgress)
      ? [...user.challengeProgress]
      : [];
    const { next } = this.syncInactivityLifecycle(challengeProgressRaw);
    const challengeProgress = next;
    const index = challengeProgress.findIndex(
      (entry: any) => entry.challengeId === challengeId,
    );
    const existing =
      index >= 0
        ? challengeProgress[index]
        : this.createDefaultProgressEntry(challengeId);
    const shouldIncrement =
      existing.status !== 'SOLVED' && existing.attemptStatus !== 'abandoned';
    const nextEntry = {
      ...existing,
      attemptStatus: existing.status === 'SOLVED' ? 'completed' : 'abandoned',
      abandonmentReason: existing.status === 'SOLVED' ? null : reason,
      leftAt: existing.leftAt || new Date(),
      gracePeriodExpiresAt: null,
      lastActiveAt: new Date(),
      lastAttemptAt: new Date(),
      incompleteAttemptCount:
        existing.status === 'SOLVED'
          ? Number(existing.incompleteAttemptCount || 0)
          : Number(existing.incompleteAttemptCount || 0) +
            (shouldIncrement ? 1 : 0),
    };
    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);
    await this.userModel
      .findByIdAndUpdate(userId, { challengeProgress })
      .exec();
    return {
      challengeId,
      status: nextEntry.attemptStatus,
      abandonmentReason: nextEntry.abandonmentReason,
    };
  }

  async returnChallengeAttempt(userId: string, challengeId: string) {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const challengeProgressRaw = Array.isArray(user.challengeProgress)
      ? [...user.challengeProgress]
      : [];
    const { next } = this.syncInactivityLifecycle(challengeProgressRaw);
    const challengeProgress = next;
    const index = challengeProgress.findIndex(
      (entry: any) => entry.challengeId === challengeId,
    );
    const existing =
      index >= 0
        ? challengeProgress[index]
        : this.createDefaultProgressEntry(challengeId);
    const now = new Date();

    if (existing.status === 'SOLVED') {
      return { allowed: false, remainingTime: 0, status: 'completed' };
    }

    const nextEntry = {
      ...existing,
      attemptStatus: 'in_progress',
      returnedAt: now,
      leftAt: null,
      gracePeriodExpiresAt: null,
      abandonmentReason: null,
      attemptStartedAt: existing.attemptStartedAt || now,
      lastActiveAt: now,
      lastAttemptAt: now,
    };
    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);
    await this.userModel
      .findByIdAndUpdate(userId, { challengeProgress })
      .exec();
    return {
      allowed: true,
      remainingTime: 0,
      status: 'in_progress',
      attemptId: nextEntry.attemptId || null,
      savedCode: nextEntry.savedCode || '',
      elapsedTime: Number(nextEntry.totalElapsedTime || 0),
    };
  }

  async expireChallengeAttempt(userId: string, challengeId: string) {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));
    const challengeProgress = Array.isArray(user.challengeProgress)
      ? [...user.challengeProgress]
      : [];
    const index = challengeProgress.findIndex(
      (entry: any) => entry.challengeId === challengeId,
    );
    if (index < 0) return { updated: false, status: 'UNSOLVED' };

    const existing = this.normalizeInactivityEntry(challengeProgress[index]);
    if (existing === challengeProgress[index]) {
      return { updated: false, status: existing.attemptStatus || 'completed' };
    }

    challengeProgress[index] = existing;
    await this.userModel
      .findByIdAndUpdate(userId, { challengeProgress })
      .exec();
    return { updated: true, status: 'abandoned' };
  }

  async getUserAttempts(userId: string) {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));
    const progressRaw = Array.isArray(user.challengeProgress)
      ? user.challengeProgress
      : [];
    const { changed, next: progress } =
      this.syncInactivityLifecycle(progressRaw);
    if (changed) {
      await this.userModel
        .findByIdAndUpdate(userId, { challengeProgress: progress })
        .exec();
    }

    return progress.map((entry: any) => ({
      challengeId: entry.challengeId,
      status: entry.status || 'UNSOLVED',
      attemptId: entry.attemptId || null,
      attemptStatus: entry.attemptStatus || 'completed',
      mode: entry.mode || 'challenge',
      attemptStartedAt: entry.attemptStartedAt || null,
      lastActiveAt: entry.lastActiveAt || null,
      lastAttemptAt: entry.lastAttemptAt || null,
      savedCode: entry.savedCode || '',
      totalElapsedTime: Number(entry.totalElapsedTime || 0),
      wasReduced: Boolean(entry.wasReduced),
      leftAt: entry.leftAt || null,
      gracePeriodExpiresAt: entry.gracePeriodExpiresAt || null,
      returnedAt: entry.returnedAt || null,
      abandonmentReason: entry.abandonmentReason || null,
      incompleteAttemptCount: Number(entry.incompleteAttemptCount || 0),
      solvedAt: entry.solvedAt || null,
    }));
  }

  async recordChallengeSubmission(
    userId: string,
    challengeId: string,
    submission: any,
    opts?: { xpReward?: number; solveTimeSeconds?: number | null },
  ): Promise<{ progressEntry: any; xpGranted: number }> {
    this.ensureValidObjectId(userId);
    const submissionCode =
      typeof submission?.code === 'string' ? submission.code.trim() : '';
    if (!submissionCode) {
      throw new BadRequestException(this.tr('user.invalidSubmissionCode'));
    }
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const challengeProgress = Array.isArray(user.challengeProgress)
      ? [...user.challengeProgress]
      : [];
    const index = challengeProgress.findIndex(
      (entry: any) => entry.challengeId === challengeId,
    );
    const existing = index >= 0 ? challengeProgress[index] : null;

    const baseEntry = existing || this.createDefaultProgressEntry(challengeId);

    const submissions = Array.isArray(baseEntry.submissions)
      ? [...baseEntry.submissions, submission]
      : [submission];
    let nextStatus = baseEntry.status || 'UNSOLVED';
    let failedAttempts = Number(baseEntry.failedAttempts || 0);
    let solveTimeSeconds = baseEntry.solveTimeSeconds ?? null;
    let xpAwarded = Number(baseEntry.xpAwarded || 0);
    let solvedAt = baseEntry.solvedAt || null;
    let xpGranted = 0;
    let wasReduced = Boolean(baseEntry.wasReduced);

    if (submission.passed) {
      if (nextStatus !== 'SOLVED') {
        nextStatus = 'SOLVED';
        const currentMode = (baseEntry.mode || 'challenge') as
          | 'challenge'
          | 'practice'
          | 'contest';
        const totalElapsed = this.normalizeElapsedByMode(
          currentMode,
          Number.isFinite(opts?.solveTimeSeconds as number)
            ? Number(opts?.solveTimeSeconds)
            : 0,
          Number(baseEntry.totalElapsedTime || 0),
        );
        solveTimeSeconds = totalElapsed;
        const fullXp = Math.max(0, Number(opts?.xpReward || 0));
        wasReduced = currentMode === 'challenge' ? totalElapsed > 3600 : false;
        xpGranted = wasReduced ? Math.floor(fullXp * 0.5) : fullXp;
        xpAwarded = xpGranted;
        solvedAt = new Date();
        submission.totalElapsedTime = totalElapsed;
        submission.xpGained = xpGranted;
        submission.wasReduced = wasReduced;
      }
    } else if (nextStatus !== 'SOLVED') {
      nextStatus = 'ATTEMPTED';
      failedAttempts += 1;
      submission.totalElapsedTime = Math.max(
        Number(baseEntry.totalElapsedTime || 0),
        Number.isFinite(opts?.solveTimeSeconds as number)
          ? Number(opts?.solveTimeSeconds)
          : 0,
      );
      submission.xpGained = 0;
      submission.wasReduced = false;
    }

    const updatedEntry = {
      ...baseEntry,
      status: nextStatus,
      failedAttempts,
      solveTimeSeconds,
      xpAwarded,
      solvedAt,
      attemptStatus: submission.passed ? 'completed' : 'in_progress',
      attemptStartedAt: baseEntry.attemptStartedAt || new Date(),
      mode: baseEntry.mode || 'challenge',
      lastActiveAt: new Date(),
      lastAttemptAt: new Date(),
      savedCode: submission.passed
        ? ''
        : submission.code || baseEntry.savedCode || '',
      totalElapsedTime: Number(
        submission.totalElapsedTime || baseEntry.totalElapsedTime || 0,
      ),
      wasReduced,
      leftAt: null,
      gracePeriodExpiresAt: null,
      returnedAt: submission.passed ? new Date() : baseEntry.returnedAt || null,
      abandonmentReason: null,
      submissions,
      lastSubmittedAt: new Date(),
    };

    if (index >= 0) challengeProgress[index] = updatedEntry;
    else challengeProgress.push(updatedEntry);

    await this.userModel
      .findByIdAndUpdate(userId, { challengeProgress }, { new: false })
      .exec();

    return { progressEntry: updatedEntry, xpGranted };
  }

  async updateAvatar(
    userId: string,
    filename: string,
  ): Promise<{ message: string; avatarUrl: string }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    if ((user as any).avatar && String((user as any).avatar).startsWith('/uploads/')) {
      const oldPath = join(process.cwd(), (user as any).avatar);
      try {
        await fs.promises.unlink(oldPath);
      } catch {
        /* already gone */
      }
    }

    const avatarPath = `/uploads/avatars/${filename}`;
    const diskPath = join(process.cwd(), avatarPath);
    const ext = filename.toLowerCase().split('.').pop();
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    const fileBuffer = await fs.promises.readFile(diskPath);
    const avatarDataUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { avatar: avatarDataUrl }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(this.tr('user.notFound'));

    try {
      await fs.promises.unlink(diskPath);
    } catch {
      /* temp upload already gone */
    }

    return { message: this.tr('user.avatarUpdated'), avatarUrl: avatarDataUrl };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    this.ensureValidObjectId(userId);
    if (
      dto.username === undefined &&
      dto.email === undefined &&
      dto.bio === undefined
    ) {
      throw new BadRequestException(this.tr('user.updateRequiresField'));
    }

    if (dto.username) {
      const conflict = await this.userModel
        .findOne({ username: dto.username })
        .lean()
        .exec();
      if (conflict && (conflict as any)._id.toString() !== userId) {
        throw new ConflictException(this.tr('user.usernameTaken'));
      }
    }

    if (dto.email) {
      const conflict = await this.userModel
        .findOne({ email: dto.email })
        .lean()
        .exec();
      if (conflict && (conflict as any)._id.toString() !== userId) {
        throw new ConflictException(this.tr('user.emailInUse'));
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
    if (!updated) throw new NotFoundException(this.tr('user.notFound'));

    const { passwordHash: _omit, ...rest } = updated as any;
    return rest;
  }

  async setRefreshTokenHash(userId: string, hash: string | null) {
    this.ensureValidObjectId(userId);
    await this.userModel
      .findByIdAndUpdate(userId, { refreshTokenHash: hash })
      .exec();
  }

  // â”€â”€ Speed Challenge Placement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async updatePlacement(
    userId: string,
    dto: UpdatePlacementDto,
    force = false,
  ): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    if (user.rank && !force) {
      const { passwordHash: _omit, ...rest } = user;
      return rest;
    }

    const updated = (await this.userModel
      .findByIdAndUpdate(
        userId,
        { rank: dto.rank, xp: dto.xp, level: dto.level ?? dto.rank },
        { new: true },
      )
      .lean()
      .exec()) as any;

    const { passwordHash: _omit, ...rest } = updated;
    return rest;
  }

  async getHintBalance(
    userId: string,
  ): Promise<{ hintCredits: number; totalHintsUsed: number }> {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException('User not found');

    return {
      hintCredits: Number(user.hintCredits ?? 1),
      totalHintsUsed: Number(user.totalHintsUsed ?? 0),
    };
  }

  async consumeHintCredit(
    userId: string,
  ): Promise<{ hintCredits: number; totalHintsUsed: number }> {
    this.ensureValidObjectId(userId);
    const user = (await this.userModel.findById(userId).lean().exec()) as any;
    if (!user) throw new NotFoundException('User not found');

    const currentCredits = Number(user.hintCredits ?? 1);
    if (currentCredits <= 0) {
      throw new BadRequestException('Hint credits required');
    }

    const updated = (await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $inc: {
            hintCredits: -1,
            totalHintsUsed: 1,
          },
        },
        { new: true },
      )
      .lean()
      .exec()) as any;

    return {
      hintCredits: Number(updated?.hintCredits ?? 0),
      totalHintsUsed: Number(updated?.totalHintsUsed ?? 0),
    };
  }

  async addHintCredits(
    userId: string,
    credits: number,
    purchase: {
      stripeSessionId?: string | null;
      amountTotal?: number;
      currency?: string;
      status?: string;
    } = {},
  ): Promise<{ hintCredits: number }> {
    this.ensureValidObjectId(userId);
    const safeCredits = Math.max(1, Math.floor(Number(credits) || 0));

    if (purchase.stripeSessionId) {
      const existingPurchase = (await this.userModel
        .findOne({
          _id: userId,
          'hintPurchases.stripeSessionId': purchase.stripeSessionId,
        })
        .lean()
        .exec()) as any;

      if (existingPurchase) {
        return { hintCredits: Number(existingPurchase.hintCredits ?? 0) };
      }
    }

    const updated = (await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $inc: { hintCredits: safeCredits },
          $push: {
            hintPurchases: {
              provider: 'stripe',
              stripeSessionId: purchase.stripeSessionId ?? null,
              creditsPurchased: safeCredits,
              amountTotal: Number(purchase.amountTotal ?? 0),
              currency: String(purchase.currency ?? 'usd'),
              status: purchase.status ?? 'pending',
              createdAt: new Date(),
              fulfilledAt: purchase.status === 'paid' ? new Date() : null,
            },
          },
        },
        { new: true },
      )
      .lean()
      .exec()) as any;

    return { hintCredits: Number(updated?.hintCredits ?? safeCredits) };
  }

  async setPlacementProblems(userId: string, problems: any[]) {
    this.ensureValidObjectId(userId);
    await this.userModel
      .findByIdAndUpdate(userId, { placementProblems: problems }, { new: true })
      .exec();
  }

  async completeSpeedChallenge(userId: string): Promise<void> {
    this.ensureValidObjectId(userId);
    await this.userModel
      .findByIdAndUpdate(
        userId,
        { speedChallengeCompleted: true },
        { new: true },
      )
      .exec();
  }

  async hasCompletedSpeedChallenge(userId: string): Promise<boolean> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    return user ? (user as any).speedChallengeCompleted === true : false;
  }

  async saveSpeedTestSession(userId: string, sessionData: any): Promise<void> {
    this.ensureValidObjectId(userId);
    await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          speedTestSession: {
            ...sessionData,
            savedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();
  }

  async getSpeedTestSession(userId: string): Promise<any> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    return user ? (user as any).speedTestSession : null;
  }

  async clearSpeedTestSession(userId: string): Promise<void> {
    this.ensureValidObjectId(userId);
    await this.userModel
      .findByIdAndUpdate(
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
        { new: true },
      )
      .exec();
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(this.tr('user.passwordMismatch'));
    }

    const currentHash = crypto
      .createHash('sha256')
      .update(dto.currentPassword)
      .digest('hex');
    if ((user as any).passwordHash !== currentHash) {
      throw new BadRequestException(this.tr('user.currentPasswordIncorrect'));
    }

    const newHash = crypto
      .createHash('sha256')
      .update(dto.newPassword)
      .digest('hex');
    await this.userModel
      .findByIdAndUpdate(userId, { passwordHash: newHash })
      .exec();

    return { message: this.tr('user.passwordUpdated') };
  }

  async updateStatus(id: string, status: boolean): Promise<any> {
    this.ensureValidObjectId(id);
    const updated = await this.userModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException(this.tr('user.notFound'));

    const { passwordHash: _omit, ...rest } = updated as any;
    return rest;
  }

  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
  ): Promise<{ message: string }> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException(this.tr('user.notFound'));

    const hash = crypto.createHash('sha256').update(dto.password).digest('hex');
    if ((user as any).passwordHash !== hash) {
      throw new UnauthorizedException(this.tr('user.invalidPassword'));
    }

    if ((user as any).avatar) {
      const avatarPath = join(process.cwd(), (user as any).avatar);
      try {
        await fs.promises.unlink(avatarPath);
      } catch {
        /* already gone */
      }
    }

    await this.userModel.findByIdAndDelete(userId).exec();
    return { message: this.tr('user.accountDeleted') };
  }

  // â”€â”€ Password Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).sort({ createdAt: -1 }).exec();
  }

  async findByGoogleId(googleId: string) {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findByGithubId(githubId: string) {
    return this.userModel.findOne({ githubId }).exec();
  }

  async linkOAuthProvider(
    userId: string,
    provider: 'google' | 'github',
    providerId: string,
    profile?: { avatar?: string | null; username?: string | null },
  ) {
    this.ensureValidObjectId(userId);
    const update: any = {};
    if (provider === 'google') update.googleId = providerId;
    if (provider === 'github') update.githubId = providerId;
    if (profile?.avatar) update.avatar = profile.avatar;
    if (profile?.username) update.username = profile.username;

    return this.userModel
      .findByIdAndUpdate(userId, update, { new: true })
      .exec();
  }

  async findByUsername(username: string) {
    return this.userModel.findOne({ username }).sort({ createdAt: -1 }).exec();
  }

  async setResetPasswordToken(
    email: string,
    tokenHash: string,
    expires: Date,
    confirmationCode?: string,
  ) {
    const code =
      confirmationCode ||
      Math.floor(100000 + Math.random() * 900000).toString();
    return this.userModel
      .findOneAndUpdate(
        { email },
        {
          resetPasswordToken: tokenHash,
          resetPasswordExpires: expires,
          resetPasswordCode: code,
          resetPasswordCodeVerified: false,
        },
        { new: true, sort: { createdAt: -1 } },
      )
      .exec();
  }

  async findByResetPasswordToken(tokenHash: string) {
    return this.userModel
      .findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: new Date() },
      })
      .exec();
  }

  async findByEmailAndResetCode(email: string, code: string) {
    const c = String(code).trim();
    return this.userModel
      .findOne({
        email,
        resetPasswordCode: c,
        resetPasswordExpires: { $gt: new Date() },
        resetPasswordToken: { $ne: null },
        resetPasswordCodeVerified: false,
      })
      .exec();
  }

  async verifyResetPasswordCode(email: string, code: string) {
    const user = await this.findByEmailAndResetCode(email, String(code).trim());
    if (!user) return null;
    await this.userModel
      .findByIdAndUpdate(user._id, { resetPasswordCodeVerified: true })
      .exec();
    return user;
  }

  async updatePasswordAndClearToken(userId: string, passwordHash: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          resetPasswordCode: null,
          resetPasswordCodeVerified: false,
        },
        { new: true },
      )
      .exec();
  }
}
