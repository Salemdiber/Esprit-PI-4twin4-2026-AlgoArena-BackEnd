import { Schema } from 'mongoose';

export const UserSchema = new Schema(
  {
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['Player', 'Admin'], default: 'Player' },
    avatar: { type: String, default: null },
    bio: { type: String, default: null },
    phone: { type: String, default: null },
    status: { type: Boolean, default: true },
    googleId: { type: String, default: null },
    githubId: { type: String, default: null },
    refreshTokenHash: { type: String, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    two_factor_enabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);
