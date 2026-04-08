import { Schema } from 'mongoose';

const CommentSchema = new Schema(
  {
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    authorAvatar: { type: String, default: null },
    text: { type: String, required: true },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
  },
  {
    _id: true,
    timestamps: true,
  },
);

CommentSchema.add({
  replies: {
    type: [CommentSchema],
    default: [],
  },
});

export const CommunityPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    authorAvatar: { type: String, default: null },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    type: { type: String, enum: ['discussion', 'strategy', 'normal', 'problem'], default: 'normal' },
    tags: { type: [String], default: [] },
    problemType: { type: String, enum: ['bug', 'algorithm', 'help', 'optimization', null], default: null },
    solved: { type: Boolean, default: false },
    solvedAt: { type: Date, default: null },
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    comments: {
      type: [CommentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);
