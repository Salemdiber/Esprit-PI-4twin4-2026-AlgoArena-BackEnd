import { Schema } from 'mongoose';

export const CommunityCommentSchema = new Schema(
  {
    postId: { type: String, required: true, index: true },
    parentCommentId: { type: String, default: null, index: true },
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    authorAvatar: { type: String, default: null },
    text: { type: String, required: true, maxlength: 1500 },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);
