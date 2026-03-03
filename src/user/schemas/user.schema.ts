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
    // Generated placement problems (stored at registration)
    placementProblems: { type: Array, default: [] },
  },
  { timestamps: true },
);

