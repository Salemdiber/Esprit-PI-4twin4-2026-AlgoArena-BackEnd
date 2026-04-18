import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ _id: false })
export class MessageReaction {
  @Prop({ required: true })
  emoji: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  userIds: Types.ObjectId[];

  @Prop({ default: 0 })
  count: number;
}

@Schema({ _id: false })
export class ReplyToSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  senderUsername: string;

  @Prop({ required: true, maxlength: 100 })
  contentPreview: string;
}

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  senderUsername: string;

  @Prop({ type: String, default: null })
  senderAvatar: string | null;

  @Prop({ required: true, maxlength: 2000 })
  content: string;

  @Prop({ type: [MessageReaction], default: [] })
  reactions: MessageReaction[];

  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  replyTo: Types.ObjectId | null;

  @Prop({ type: ReplyToSnapshot, default: null })
  replyToSnapshot: ReplyToSnapshot | null;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  editedAt: Date | null;

  @Prop({ default: 'general', index: true })
  roomId: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ roomId: 1, createdAt: 1 });

