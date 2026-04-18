import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Challenge') private readonly challengeModel: Model<any>,
  ) {}

  private toTwoDecimals(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private getPastNDaysStart(days: number) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private async aggregateSubmissionMetrics() {
    const difficultyAgg = await this.userModel.aggregate([
      { $unwind: '$challengeProgress' },
      { $unwind: '$challengeProgress.submissions' },
      {
        $addFields: {
          challengeObjectId: {
            $convert: {
              input: '$challengeProgress.challengeId',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'challenges',
          localField: 'challengeObjectId',
          foreignField: '_id',
          as: 'challengeDoc',
        },
      },
      {
        $unwind: {
          path: '$challengeDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$challengeDoc.difficulty', 'Unknown'] },
          total: { $sum: 1 },
          successful: {
            $sum: {
              $cond: [
                { $eq: ['$challengeProgress.submissions.passed', true] },
                1,
                0,
              ],
            },
          },
          failed: {
            $sum: {
              $cond: [
                { $eq: ['$challengeProgress.submissions.passed', false] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const abandonedAgg = await this.userModel.aggregate([
      { $unwind: '$challengeProgress' },
      {
        $addFields: {
          challengeObjectId: {
            $convert: {
              input: '$challengeProgress.challengeId',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'challenges',
          localField: 'challengeObjectId',
          foreignField: '_id',
          as: 'challengeDoc',
        },
      },
      {
        $unwind: {
          path: '$challengeDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$challengeDoc.difficulty', 'Unknown'] },
          abandoned: {
            $sum: { $ifNull: ['$challengeProgress.incompleteAttemptCount', 0] },
          },
        },
      },
    ]);

    const orderedDifficulties = ['Easy', 'Medium', 'Hard', 'Expert'];
    const byDifficultyMap = new Map(
      difficultyAgg.map((item) => [
        item._id || 'Unknown',
        {
          total: Number(item.total || 0),
          successful: Number(item.successful || 0),
          failed: Number(item.failed || 0),
        },
      ]),
    );
    const abandonedMap = new Map(
      abandonedAgg.map((item) => [
        item._id || 'Unknown',
        Number(item.abandoned || 0),
      ]),
    );

    const byDifficulty = orderedDifficulties.map((difficulty) => {
      const entry = byDifficultyMap.get(difficulty) || {
        total: 0,
        successful: 0,
        failed: 0,
      };
      const successRate =
        entry.total > 0
          ? this.toTwoDecimals((entry.successful / entry.total) * 100)
          : 0;
      return {
        difficulty,
        submissions: entry.total,
        totalSubmissions: entry.total,
        successfulSubmissions: entry.successful,
        failedSubmissions: entry.failed,
        abandonedAttempts: abandonedMap.get(difficulty) || 0,
        successRate,
      };
    });

    const totalSubmissions = byDifficulty.reduce(
      (acc, item) => acc + item.totalSubmissions,
      0,
    );
    const totalSuccessfulSubmissions = byDifficulty.reduce(
      (acc, item) => acc + item.successfulSubmissions,
      0,
    );
    const totalFailedSubmissions = byDifficulty.reduce(
      (acc, item) => acc + item.failedSubmissions,
      0,
    );
    const totalAbandonedAttempts = byDifficulty.reduce(
      (acc, item) => acc + item.abandonedAttempts,
      0,
    );
    const successRate =
      totalSubmissions > 0
        ? this.toTwoDecimals(
            (totalSuccessfulSubmissions / totalSubmissions) * 100,
          )
        : 0;

    return {
      totalSubmissions,
      totalSuccessfulSubmissions,
      totalFailedSubmissions,
      totalAbandonedAttempts,
      successRate,
      byDifficulty,
    };
  }

  async getAdminOverviewStats() {
    const activeSince = this.getPastNDaysStart(7);

    const [
      totalUsers,
      activeUsers,
      totalChallenges,
      draftChallenges,
      publishedChallenges,
      submissionStats,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({
        status: true,
        updatedAt: { $gte: activeSince },
      }),
      this.challengeModel.countDocuments(),
      this.challengeModel.countDocuments({ status: 'draft' }),
      this.challengeModel.countDocuments({ status: 'published' }),
      this.aggregateSubmissionMetrics(),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalChallenges,
      draftChallenges,
      publishedChallenges,
      totalSubmissions: submissionStats.totalSubmissions,
      successRate: submissionStats.successRate,
    };
  }

  async getAdminUsersStats() {
    const now = new Date();
    const activeSince = this.getPastNDaysStart(7);
    const thirtyDaysAgo = this.getPastNDaysStart(30);
    const signupSince = this.getPastNDaysStart(6);
    const labels = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date(signupSince);
      day.setDate(signupSince.getDate() + idx);
      return day.toLocaleDateString('en-US', { weekday: 'short' });
    });

    const [totalUsers, activeUsers, newUsersLast30Days, signupAgg] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.userModel.countDocuments({
          status: true,
          updatedAt: { $gte: activeSince },
        }),
        this.userModel.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        this.userModel.aggregate([
          { $match: { createdAt: { $gte: signupSince, $lte: now } } },
          {
            $group: {
              _id: {
                y: { $year: '$createdAt' },
                m: { $month: '$createdAt' },
                d: { $dayOfMonth: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    const signupMap = new Map(
      signupAgg.map((item) => [
        `${item._id.y}-${item._id.m}-${item._id.d}`,
        item.count,
      ]),
    );

    const signupsLast7Days = labels.map((_, idx) => {
      const day = new Date(signupSince);
      day.setDate(signupSince.getDate() + idx);
      const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
      return signupMap.get(key) || 0;
    });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: Math.max(0, totalUsers - activeUsers),
      newUsersLast30Days,
      signupsLast7Days: { labels, values: signupsLast7Days },
    };
  }

  async getAdminChallengesStats() {
    const [
      totalChallenges,
      draftChallenges,
      publishedChallenges,
      difficultyAgg,
    ] = await Promise.all([
      this.challengeModel.countDocuments(),
      this.challengeModel.countDocuments({ status: 'draft' }),
      this.challengeModel.countDocuments({ status: 'published' }),
      this.challengeModel.aggregate([
        {
          $group: {
            _id: '$difficulty',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const buckets = { Easy: 0, Medium: 0, Hard: 0, Expert: 0 };
    difficultyAgg.forEach((item) => {
      if (item?._id && buckets[item._id] !== undefined) {
        buckets[item._id] = item.count;
      }
    });

    return {
      totalChallenges,
      draftChallenges,
      publishedChallenges,
      difficultyDistribution: buckets,
    };
  }

  async getAdminSubmissionsStats() {
    return this.aggregateSubmissionMetrics();
  }

  async getAdminDashboardSubmissionStats() {
    const base = await this.aggregateSubmissionMetrics();
    const response: Record<
      string,
      {
        total: number;
        successful: number;
        failed: number;
        abandoned: number;
        successRate: number;
      }
    > = {
      easy: {
        total: 0,
        successful: 0,
        failed: 0,
        abandoned: 0,
        successRate: 0,
      },
      medium: {
        total: 0,
        successful: 0,
        failed: 0,
        abandoned: 0,
        successRate: 0,
      },
      hard: {
        total: 0,
        successful: 0,
        failed: 0,
        abandoned: 0,
        successRate: 0,
      },
      expert: {
        total: 0,
        successful: 0,
        failed: 0,
        abandoned: 0,
        successRate: 0,
      },
    };
    for (const item of base.byDifficulty || []) {
      const key = String(item.difficulty || '').toLowerCase();
      if (!response[key]) continue;
      response[key] = {
        total: Number(item.totalSubmissions || item.submissions || 0),
        successful: Number(item.successfulSubmissions || 0),
        failed: Number(item.failedSubmissions || 0),
        abandoned: Number(item.abandonedAttempts || 0),
        successRate: Number(item.successRate || 0),
      };
    }
    return response;
  }

  async getAdminChallengeSubmissionsOverview() {
    const [challenges, users] = await Promise.all([
      this.challengeModel
        .find({}, { _id: 1, title: 1, difficulty: 1 })
        .lean()
        .exec(),
      this.userModel
        .find({}, { _id: 1, username: 1, challengeProgress: 1 })
        .lean()
        .exec(),
    ]);

    const challengeMap = new Map<string, any>();
    for (const challenge of challenges) {
      const id = String((challenge as any)._id);
      challengeMap.set(id, {
        challengeId: id,
        challengeTitle: (challenge as any).title,
        difficulty: (challenge as any).difficulty,
        totalSubmissions: 0,
        successfulSubmissions: 0,
        failedSubmissions: 0,
        abandonedAttempts: 0,
        successRate: 0,
        averageSolveTime: 0,
        recentSubmissions: [],
      });
    }

    const solveAccumulator: Record<string, { total: number; count: number }> =
      {};

    for (const user of users as any[]) {
      const progressEntries = Array.isArray(user.challengeProgress)
        ? user.challengeProgress
        : [];
      for (const entry of progressEntries) {
        const challengeId = String(entry.challengeId || '');
        if (!challengeMap.has(challengeId)) continue;
        const target = challengeMap.get(challengeId);
        const submissions = Array.isArray(entry.submissions)
          ? entry.submissions
          : [];

        target.abandonedAttempts += Number(entry.incompleteAttemptCount || 0);
        for (const submission of submissions) {
          const passed = Boolean(submission?.passed);
          target.totalSubmissions += 1;
          if (passed) target.successfulSubmissions += 1;
          else target.failedSubmissions += 1;

          const solveSeconds = Number(
            submission?.solveTimeSeconds ?? entry?.solveTimeSeconds,
          );
          if (passed && Number.isFinite(solveSeconds) && solveSeconds > 0) {
            solveAccumulator[challengeId] = solveAccumulator[challengeId] || {
              total: 0,
              count: 0,
            };
            solveAccumulator[challengeId].total += solveSeconds;
            solveAccumulator[challengeId].count += 1;
          }

          target.recentSubmissions.push({
            userId: String(user._id),
            username: user.username || 'Unknown',
            submittedAt: submission?.submittedAt || null,
            status: passed ? 'success' : 'failed',
            code: submission?.code || '',
            executionTime: Number(submission?.executionTimeMs || 0),
            memoryUsed: submission?.memoryAllocated || 'Not available',
            language: submission?.language || 'javascript',
            errorMessage:
              submission?.error?.message || submission?.error?.stderr || '',
          });
        }

        if (entry.attemptStatus === 'abandoned') {
          target.recentSubmissions.push({
            userId: String(user._id),
            username: user.username || 'Unknown',
            submittedAt:
              entry.gracePeriodExpiresAt ||
              entry.leftAt ||
              entry.updatedAt ||
              null,
            status: 'abandoned',
            code: '',
            executionTime: 0,
            memoryUsed: 'N/A',
            language: 'N/A',
            errorMessage: entry.abandonmentReason
              ? `Attempt abandoned (${entry.abandonmentReason})`
              : 'Attempt abandoned',
          });
        }
      }
    }

    const overview = [...challengeMap.values()].map((entry: any) => {
      const solveStats = solveAccumulator[entry.challengeId];
      const successRate =
        entry.totalSubmissions > 0
          ? this.toTwoDecimals(
              (entry.successfulSubmissions / entry.totalSubmissions) * 100,
            )
          : 0;
      const recentSubmissions = entry.recentSubmissions
        .sort(
          (a: any, b: any) =>
            new Date(b.submittedAt || 0).getTime() -
            new Date(a.submittedAt || 0).getTime(),
        )
        .slice(0, 10);
      return {
        ...entry,
        successRate,
        averageSolveTime: solveStats?.count
          ? this.toTwoDecimals(solveStats.total / solveStats.count)
          : 0,
        recentSubmissions,
      };
    });

    return overview.sort((a, b) => b.totalSubmissions - a.totalSubmissions);
  }

  async getPlatformInsights() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

      const totalUsers = await this.userModel.countDocuments();
      const newUsers = await this.userModel.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      // Mocks for data we can't accurately get without tracking tools

      const dau = Math.floor(totalUsers * 0.15); // mock 15% DAU
      const peakHours = ['18:00', '20:00', '22:00'];
      const avgTimeSpent = '24m 32s';

      const frequentlyAccessed = [
        { section: 'Battles', accesses: 1250 },
        { section: 'Challenges', accesses: 980 },
        { section: 'Leaderboard', accesses: 850 },
        { section: 'Profile', accesses: 620 },
      ];

      return {
        users: {
          total: totalUsers,
          newUsers30Days: newUsers,
          dailyActiveUsers: dau > 0 ? dau : 1,
        },
        engagement: {
          peakUsageTimes: peakHours,
          averageTimeSpent: avgTimeSpent,
          mostFrequentlyAccessed: frequentlyAccessed,
        },
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
