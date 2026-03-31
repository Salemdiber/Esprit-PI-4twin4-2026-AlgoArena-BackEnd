import { Schema } from 'mongoose';

const CommentSchema = new Schema(
  {
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['discussion', 'strategy'], default: 'discussion' },
  },
  {
    _id: true,
    timestamps: true,
  },
);

export const CommunityPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    authorId: { type: String, required: true },
    authorUsername: { type: String, required: true },
    imageUrl: { type: String, default: null },
    videoUrl: { type: String, default: null },
    type: { type: String, enum: ['discussion', 'strategy', 'normal', 'problem'], default: 'normal' },
    comments: {
      type: [CommentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);
