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
    // Generated placement problems (stored at registration)
    placementProblems: { type: Array, default: [] },
    // Whether the user has completed the speed challenge (onboarding)
    speedChallengeCompleted: { type: Boolean, default: false },
    // Ongoing test session - stores progress if user leaves mid-test
    speedTestSession: {
      phase: { type: String, enum: [null, 'INTRO', 'CHALLENGE', 'RESULT'], default: null },
      secondsLeft: { type: Number, default: null },
      currentIndex: { type: Number, default: null },
      solvedIds: { type: Array, default: [] },
      codes: { type: Object, default: {} },
      languages: { type: Object, default: {} },
      elapsedSeconds: { type: Number, default: null },
      savedAt: { type: Date, default: null },
    },

  },
  { timestamps: true },
);

