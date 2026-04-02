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
const STREAK_ACTIVITY_WINDOW_DAYS = 30;
const GRACE_PERIOD_SECONDS = 120;

const STREAK_MESSAGES = {
  dayOne: [
    "Welcome back, warrior! Every legend starts with Day 1. Let's build something unstoppable. \u{1F525}",
    "Day 1 � The grind begins NOW. Show these algorithms who's boss! \u{1F4AA}",
    "Fresh start, fresh fire. Your coding journey resets today. Make it count! \u{1F680}",
    'Day 1 locked in. One solid session today can change your entire trajectory. \u{2B50}',
    "A new streak starts today. Keep showing up and you'll shock yourself in a week. \u{1F947}",
  ],
  buildMomentum: [
    "Day {streak} � You're building momentum! Keep this energy going and watch your skills skyrocket! \u{26A1}",
    "{streak} days strong! The consistency is starting to show. Don't stop now! \u{1F525}",
    "Look at you � {streak} days in a row! Most people quit by now. You're different. \u{1F48E}",
    'Momentum unlocked: Day {streak}. Keep stacking wins and let discipline do the heavy lifting. \u{26A1}',
    '{streak} straight days! Small daily reps are turning you into a serious problem-solver. \u{1F680}',
  ],
  beastMode: [
    "\u{1F525} {streak}-DAY STREAK! You're officially in beast mode. The algorithms fear you!",
    "{streak} consecutive days! You're not just practicing � you're transforming into a coding machine! \u{26A1}",
    "UNSTOPPABLE! {streak} days and counting. At this rate, you'll be solving problems in your sleep! \u{1F4AA}",
    '{streak} days with no excuses. That is elite focus and it is paying off. \u{1F3C6}',
    'Day {streak}. You are building a reputation with yourself for not missing. Keep it alive. \u{1F525}',
  ],
  impressive: [
    "\u{1F3C6} {streak}-DAY STREAK! You're in the top tier of grinders on AlgoArena. Legendary status incoming!",
    'TEN+ DAYS! {streak} days of pure dedication. Your future self is thanking you right now! \u{1F680}',
    "\u{1F451} {streak} days! You're not just a coder � you're a WARRIOR. The leaderboard trembles at your name!",
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
  let rank = 'BRONZE';
  for (const r of RANK_ORDER) {
    if (xp >= RANK_THRESHOLDS[r]) rank = r;
  }
  return rank;
}

@Injectable()
export class UserService {
  constructor(@InjectModel('User') private userModel: Model<any>) { }

  private utcDateOnly(value: Date = new Date()): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private dateToken(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private daysBetweenUtc(a: Date, b: Date): number {
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.round((this.utcDateOnly(a).getTime() - this.utcDateOnly(b).getTime()) / dayMs);
  }

  private pickTierMessage(streak: number): string {
    const pick = (pool: string[]) => pool[Math.floor(Math.random() * pool.length)];
    if (streak <= 1) return pick(STREAK_MESSAGES.dayOne);
    if (streak <= 4) return pick(STREAK_MESSAGES.buildMomentum).replaceAll('{streak}', String(streak));
    if (streak <= 9) return pick(STREAK_MESSAGES.beastMode).replaceAll('{streak}', String(streak));
    if (streak <= 19) return pick(STREAK_MESSAGES.impressive).replaceAll('{streak}', String(streak));
    if (streak <= 49) return pick(STREAK_MESSAGES.elite).replaceAll('{streak}', String(streak));
    return pick(STREAK_MESSAGES.mythical).replaceAll('{streak}', String(streak));
  }

  private buildRecentActivity(loginActivityDates: string[] = [], referenceDay: Date = new Date()): boolean[] {
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

    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    const lastLoginDateRaw = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    const lastLoginDay = lastLoginDateRaw ? this.utcDateOnly(lastLoginDateRaw) : null;
    const previousCurrent = Number(user.currentStreak ?? user.streak ?? 0);
    const previousLongest = Number(user.longestStreak ?? user.streak ?? 0);
    const loginActivityDates = Array.isArray(user.loginActivityDates) ? [...user.loginActivityDates] : [];

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
        longestStreak = Math.max(longestStreak, previousCurrent, previousLongest, 1);
        shouldPersist = true;
      }
    }

    const nextActivitySet = new Set(loginActivityDates);
    nextActivitySet.add(todayToken);
    const nextActivity = [...nextActivitySet]
      .sort((a, b) => (a < b ? -1 : 1))
      .slice(-STREAK_ACTIVITY_WINDOW_DAYS);

    if (shouldPersist || !loginActivityDates.includes(todayToken)) {
      await this.userModel.findByIdAndUpdate(
        userId,
        {
          currentStreak,
          longestStreak,
          streak: currentStreak,
          lastLoginDate: today,
          streakUpdatedAt: now,
          loginActivityDates: nextActivity,
        },
      ).exec();
    } else if (Number(user.streak ?? 0) !== currentStreak) {
      await this.userModel.findByIdAndUpdate(userId, { streak: currentStreak }).exec();
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
    const streak: number = user.currentStreak ?? user.streak ?? 0;

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

  async getChallengeProgress(userId: string): Promise<any[]> {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');
    return Array.isArray(user.challengeProgress) ? user.challengeProgress : [];
  }

  async getChallengeProgressEntry(userId: string, challengeId: string): Promise<any | null> {
    const progress = await this.getChallengeProgress(userId);
    return progress.find((entry: any) => entry.challengeId === challengeId) || null;
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
      attemptStartedAt: null,
      leftAt: null,
      gracePeriodExpiresAt: null,
      returnedAt: null,
      abandonmentReason: null,
      incompleteAttemptCount: 0,
      submissions: [],
    };
  }

  async startChallengeAttempt(userId: string, challengeId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    const challengeProgress = Array.isArray(user.challengeProgress) ? [...user.challengeProgress] : [];
    const index = challengeProgress.findIndex((entry: any) => entry.challengeId === challengeId);
    const existing = index >= 0 ? challengeProgress[index] : this.createDefaultProgressEntry(challengeId);

    const now = new Date();
    const attemptId = `${challengeId}-${now.getTime()}`;
    const nextEntry = {
      ...existing,
      attemptId,
      attemptStatus: existing.status === 'SOLVED' ? 'completed' : 'in_progress',
      attemptStartedAt: now,
      leftAt: null,
      gracePeriodExpiresAt: null,
      returnedAt: null,
      abandonmentReason: null,
    };

    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);

    await this.userModel.findByIdAndUpdate(userId, { challengeProgress }).exec();
    return {
      challengeId,
      attemptId,
      startedAt: now.toISOString(),
      status: nextEntry.attemptStatus,
    };
  }

  async leaveChallengeAttempt(userId: string, challengeId: string, reason: 'left_page' | 'tab_closed' = 'left_page') {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    const challengeProgress = Array.isArray(user.challengeProgress) ? [...user.challengeProgress] : [];
    const index = challengeProgress.findIndex((entry: any) => entry.challengeId === challengeId);
    const existing = index >= 0 ? challengeProgress[index] : this.createDefaultProgressEntry(challengeId);
    const now = new Date();
    const currentGraceExpiry = existing.gracePeriodExpiresAt ? new Date(existing.gracePeriodExpiresAt) : null;
    const isExistingGraceStillValid = currentGraceExpiry && currentGraceExpiry.getTime() > now.getTime();
    const expiresAt = isExistingGraceStillValid
      ? currentGraceExpiry
      : new Date(now.getTime() + GRACE_PERIOD_SECONDS * 1000);

    const nextEntry = {
      ...existing,
      attemptStatus: existing.status === 'SOLVED' ? 'completed' : 'grace_period',
      leftAt: now,
      gracePeriodExpiresAt: existing.status === 'SOLVED' ? null : expiresAt,
      abandonmentReason: reason,
      attemptStartedAt: existing.attemptStartedAt || now,
    };

    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);

    await this.userModel.findByIdAndUpdate(userId, { challengeProgress }).exec();
    return {
      challengeId,
      status: nextEntry.attemptStatus,
      gracePeriodExpiresAt: nextEntry.gracePeriodExpiresAt?.toISOString?.() || null,
    };
  }

  async abandonChallengeAttempt(userId: string, challengeId: string, reason: 'timeout' | 'left_page' | 'tab_closed' = 'timeout') {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');
    const challengeProgress = Array.isArray(user.challengeProgress) ? [...user.challengeProgress] : [];
    const index = challengeProgress.findIndex((entry: any) => entry.challengeId === challengeId);
    const existing = index >= 0 ? challengeProgress[index] : this.createDefaultProgressEntry(challengeId);
    const nextEntry = {
      ...existing,
      attemptStatus: existing.status === 'SOLVED' ? 'completed' : 'abandoned',
      abandonmentReason: existing.status === 'SOLVED' ? null : reason,
      leftAt: existing.leftAt || new Date(),
      gracePeriodExpiresAt: existing.gracePeriodExpiresAt || new Date(),
      incompleteAttemptCount: existing.status === 'SOLVED'
        ? Number(existing.incompleteAttemptCount || 0)
        : Number(existing.incompleteAttemptCount || 0) + 1,
    };
    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);
    await this.userModel.findByIdAndUpdate(userId, { challengeProgress }).exec();
    return {
      challengeId,
      status: nextEntry.attemptStatus,
      abandonmentReason: nextEntry.abandonmentReason,
    };
  }

  async returnChallengeAttempt(userId: string, challengeId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    const challengeProgress = Array.isArray(user.challengeProgress) ? [...user.challengeProgress] : [];
    const index = challengeProgress.findIndex((entry: any) => entry.challengeId === challengeId);
    const existing = index >= 0 ? challengeProgress[index] : this.createDefaultProgressEntry(challengeId);
    const now = new Date();
    const expiresAt = existing.gracePeriodExpiresAt ? new Date(existing.gracePeriodExpiresAt) : null;

    if (existing.status === 'SOLVED') {
      return { allowed: false, remainingTime: 0, status: 'completed' };
    }

    if (!expiresAt || now.getTime() > expiresAt.getTime()) {
      const nextEntry = {
        ...existing,
        attemptStatus: 'abandoned',
        abandonmentReason: 'timeout',
        gracePeriodExpiresAt: expiresAt || now,
        incompleteAttemptCount: Number(existing.incompleteAttemptCount || 0) + 1,
      };
      if (index >= 0) challengeProgress[index] = nextEntry;
      else challengeProgress.push(nextEntry);
      await this.userModel.findByIdAndUpdate(userId, { challengeProgress }).exec();
      return { allowed: false, remainingTime: 0, status: 'abandoned' };
    }

    const remainingTime = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    const nextEntry = {
      ...existing,
      attemptStatus: 'in_progress',
      returnedAt: now,
      leftAt: null,
      gracePeriodExpiresAt: expiresAt,
      abandonmentReason: null,
      attemptStartedAt: existing.attemptStartedAt || now,
    };
    if (index >= 0) challengeProgress[index] = nextEntry;
    else challengeProgress.push(nextEntry);
    await this.userModel.findByIdAndUpdate(userId, { challengeProgress }).exec();
    return { allowed: true, remainingTime, status: 'in_progress' };
  }

  async expireChallengeAttempt(userId: string, challengeId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');
    const challengeProgress = Array.isArray(user.challengeProgress) ? [...user.challengeProgress] : [];
    const index = challengeProgress.findIndex((entry: any) => entry.challengeId === challengeId);
    if (index < 0) return { updated: false, status: 'UNSOLVED' };

    const existing = challengeProgress[index];
    const expiresAt = existing.gracePeriodExpiresAt ? new Date(existing.gracePeriodExpiresAt) : null;
    if (existing.attemptStatus !== 'grace_period' || !expiresAt || Date.now() <= expiresAt.getTime()) {
      return { updated: false, status: existing.attemptStatus || 'completed' };
    }

    challengeProgress[index] = {
      ...existing,
      attemptStatus: 'abandoned',
      abandonmentReason: 'timeout',
      incompleteAttemptCount: Number(existing.incompleteAttemptCount || 0) + 1,
    };
    await this.userModel.findByIdAndUpdate(userId, { challengeProgress }).exec();
    return { updated: true, status: 'abandoned' };
  }

  async getUserAttempts(userId: string) {
    this.ensureValidObjectId(userId);
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');
    const progress = Array.isArray(user.challengeProgress) ? user.challengeProgress : [];
    return progress.map((entry: any) => ({
      challengeId: entry.challengeId,
      status: entry.status || 'UNSOLVED',
      attemptId: entry.attemptId || null,
      attemptStatus: entry.attemptStatus || 'completed',
      attemptStartedAt: entry.attemptStartedAt || null,
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
    const user = await this.userModel.findById(userId).lean().exec() as any;
    if (!user) throw new NotFoundException('User not found');

    const challengeProgress = Array.isArray(user.challengeProgress) ? [...user.challengeProgress] : [];
    const index = challengeProgress.findIndex((entry: any) => entry.challengeId === challengeId);
    const existing = index >= 0 ? challengeProgress[index] : null;

    const baseEntry = existing || this.createDefaultProgressEntry(challengeId);

    const submissions = Array.isArray(baseEntry.submissions) ? [...baseEntry.submissions, submission] : [submission];
    let nextStatus = baseEntry.status || 'UNSOLVED';
    let failedAttempts = Number(baseEntry.failedAttempts || 0);
    let solveTimeSeconds = baseEntry.solveTimeSeconds ?? null;
    let xpAwarded = Number(baseEntry.xpAwarded || 0);
    let solvedAt = baseEntry.solvedAt || null;
    let xpGranted = 0;

    if (submission.passed) {
      if (nextStatus !== 'SOLVED') {
        nextStatus = 'SOLVED';
        solveTimeSeconds = opts?.solveTimeSeconds ?? null;
        xpGranted = Number(opts?.xpReward || 0);
        xpAwarded = xpGranted;
        solvedAt = new Date();
      }
    } else if (nextStatus !== 'SOLVED') {
      nextStatus = 'ATTEMPTED';
      failedAttempts += 1;
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
      leftAt: null,
      gracePeriodExpiresAt: null,
      returnedAt: submission.passed ? new Date() : baseEntry.returnedAt || null,
      abandonmentReason: null,
      submissions,
      lastSubmittedAt: new Date(),
    };

    if (index >= 0) challengeProgress[index] = updatedEntry;
    else challengeProgress.push(updatedEntry);

    await this.userModel.findByIdAndUpdate(
      userId,
      { challengeProgress },
      { new: false },
    ).exec();

    return { progressEntry: updatedEntry, xpGranted };
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


