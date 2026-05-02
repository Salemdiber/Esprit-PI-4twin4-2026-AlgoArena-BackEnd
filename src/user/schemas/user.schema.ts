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
    accessibilitySettings: {
      type: {
        highContrast: { type: Boolean, default: false },
        reducedMotion: { type: Boolean, default: false },
        dyslexiaFont: { type: Boolean, default: false },
        fontScale: {
          type: String,
          enum: ['small', 'medium', 'large'],
          default: 'medium',
        },
        voiceMode: { type: Boolean, default: false },
        voiceCommandsEnabled: { type: Boolean, default: false },
      },
      default: {},
    },

    // ── Hint Wallet / Billing ─────────────────────────────────────
    hintCredits: { type: Number, default: 1 },
    totalHintsUsed: { type: Number, default: 0 },
    hintPurchases: {
      type: [
        {
          provider: { type: String, default: 'stripe' },
          stripeSessionId: { type: String, default: null },
          creditsPurchased: { type: Number, default: 0 },
          amountTotal: { type: Number, default: 0 },
          currency: { type: String, default: 'usd' },
          status: { type: String, default: 'pending' },
          createdAt: { type: Date, default: Date.now },
          fulfilledAt: { type: Date, default: null },
        },
      ],
      default: [],
    },

    // ── Speed Challenge Placement ──────────────────────────────────
    rank: {
      type: String,
      enum: [
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
        null,
      ],
      default: null,
    },
    xp: { type: Number, default: 0 },
    level: { type: String, default: null },
    streak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastLoginDate: { type: Date, default: null },
    streakUpdatedAt: { type: Date, default: null },
    loginActivityDates: { type: [String], default: [] },
    speedChallengeCompleted: { type: Boolean, default: false },
    // Generated placement problems (stored at registration)
    placementProblems: { type: Array, default: [] },
    challengeProgress: {
      type: [
        {
          challengeId: { type: String, required: true },
          status: {
            type: String,
            enum: ['UNSOLVED', 'ATTEMPTED', 'SOLVED'],
            default: 'UNSOLVED',
          },
          failedAttempts: { type: Number, default: 0 },
          solveTimeSeconds: { type: Number, default: null },
          xpAwarded: { type: Number, default: 0 },
          solvedAt: { type: Date, default: null },
          attemptId: { type: String, default: null },
          attemptStatus: {
            type: String,
            enum: ['in_progress', 'completed', 'abandoned'],
            default: 'completed',
          },
          mode: {
            type: String,
            enum: ['challenge', 'practice', 'contest'],
            default: 'challenge',
          },
          attemptStartedAt: { type: Date, default: null },
          lastActiveAt: { type: Date, default: null },
          lastAttemptAt: { type: Date, default: null },
          savedCode: { type: String, default: '' },
          totalElapsedTime: { type: Number, default: 0 },
          wasReduced: { type: Boolean, default: false },
          leftAt: { type: Date, default: null },
          gracePeriodExpiresAt: { type: Date, default: null },
          returnedAt: { type: Date, default: null },
          abandonmentReason: {
            type: String,
            enum: ['left_page', 'timeout', 'tab_closed', null],
            default: null,
          },
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
                // Attribution of the complexity prediction. Kept on the
                // submission record so the UI can render the correct badge
                // ('ML model' vs 'AI estimate') when the user revisits a
                // historical submission. Without these fields Mongoose
                // would silently strip them on save.
                complexitySource: {
                  type: String,
                  enum: ['ml-model', 'ai', 'unknown'],
                  default: 'unknown',
                },
                complexityConfidence: { type: Number, default: null },
                complexityModelVersion: { type: String, default: null },
                // Human-readable justification populated by the
                // pattern-rule layer of the model service. Empty when
                // the trained classifier was the decider.
                complexityReasoning: { type: String, default: '' },
                // Internal label of the deciding layer
                // ("rule:<name>" or "model"). Stored for telemetry,
                // not displayed directly to the user.
                complexityMethod: { type: String, default: null },
                aiDetection: {
                  type: String,
                  enum: ['MANUAL', 'AI_SUSPECTED'],
                  default: 'MANUAL',
                },
                recommendations: { type: [String], default: [] },
                aiAnalysis: { type: String, default: null },
                results: { type: Array, default: [] },
                error: { type: Object, default: null },
                source: { type: String, default: 'docker' },
                totalElapsedTime: { type: Number, default: 0 },
                xpGained: { type: Number, default: 0 },
                wasReduced: { type: Boolean, default: false },
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

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ googleId: 1 }, { unique: true, sparse: true });
UserSchema.index({ githubId: 1 }, { unique: true, sparse: true });
