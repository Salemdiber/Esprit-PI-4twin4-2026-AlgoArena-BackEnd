import { Schema } from 'mongoose';

export const UserSchema = new Schema(
  {
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['Player', 'Admin'], default: 'Player' },
    avatar: { type: String, default: null },
    bio: { type: String, default: null },
    status: { type: Boolean, default: true },
    googleId: { type: String, default: null },
    githubId: { type: String, default: null },
    refreshTokenHash: { type: String, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    resetPasswordCode: { type: String, default: null },
    resetPasswordCodeVerified: { type: Boolean, default: false },

    // ── Speed Challenge Placement ──────────────────────────────────
    rank: { type: String, enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', null], default: null },
    xp: { type: Number, default: 0 },
    level: { type: String, default: null },
    streak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastLoginDate: { type: Date, default: null },
    streakUpdatedAt: { type: Date, default: null },
    loginActivityDates: { type: [String], default: [] },
    // Generated placement problems (stored at registration)
    placementProblems: { type: Array, default: [] },
    challengeProgress: {
      type: [
        {
          challengeId: { type: String, required: true },
          status: { type: String, enum: ['UNSOLVED', 'ATTEMPTED', 'SOLVED'], default: 'UNSOLVED' },
          failedAttempts: { type: Number, default: 0 },
          solveTimeSeconds: { type: Number, default: null },
          xpAwarded: { type: Number, default: 0 },
          solvedAt: { type: Date, default: null },
          attemptId: { type: String, default: null },
          attemptStatus: {
            type: String,
            enum: ['in_progress', 'completed', 'abandoned', 'grace_period'],
            default: 'completed',
          },
          attemptStartedAt: { type: Date, default: null },
          leftAt: { type: Date, default: null },
          gracePeriodExpiresAt: { type: Date, default: null },
          returnedAt: { type: Date, default: null },
          abandonmentReason: { type: String, enum: ['left_page', 'timeout', 'tab_closed', null], default: null },
          incompleteAttemptCount: { type: Number, default: 0 },
          submissions: {
            type: [
              {
                submittedAt: { type: Date, default: Date.now },
                language: { type: String, default: 'javascript' },
                code: { type: String, default: '' },
                passed: { type: Boolean, default: false },
                passedCount: { type: Number, default: 0 },
                total: { type: Number, default: 0 },
                executionTime: { type: String, default: null },
                executionTimeMs: { type: Number, default: null },
                memoryAllocated: { type: String, default: null },
                loadTime: { type: String, default: null },
                timeComplexity: { type: String, default: 'Unknown' },
                spaceComplexity: { type: String, default: 'Unknown' },
                aiDetection: { type: String, enum: ['MANUAL', 'AI_SUSPECTED'], default: 'MANUAL' },
                recommendations: { type: [String], default: [] },
                aiAnalysis: { type: String, default: null },
                results: { type: Array, default: [] },
                error: { type: Object, default: null },
                source: { type: String, default: 'docker' },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },

  },
  { timestamps: true },
);

