import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { UserService } from '../user/user.service';

const REPLY_PREVIEW_MAX = 100;

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly userService: UserService,
  ) {}

  async getRooms() {
    return [{ id: 'general', name: 'Arena Chat' }];
  }

  async getHistory(roomId: string, page = 1, limit = 50) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (safePage - 1) * safeLimit;

    const [messagesDesc, total] = await Promise.all([
      this.messageModel
        .find({ roomId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.messageModel.countDocuments({ roomId }).exec(),
    ]);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: skip + messagesDesc.length < total,
      messages: messagesDesc.reverse(),
    };
  }

  async sendMessage(
    userId: string,
    username: string,
    roomId: string,
    content: string,
    replyTo?: string,
  ) {
    const trimmed = String(content || '').trim();
    if (!trimmed) throw new BadRequestException('Message cannot be empty');
    if (trimmed.length > 2000)
      throw new BadRequestException('Message too long');

    const user = (await this.userService.findOne(userId)) as any;
    let replyToSnapshot: any = null;
    let replyToId: Types.ObjectId | null = null;

    if (replyTo) {
      const target = await this.messageModel.findById(replyTo).lean().exec();
      if (!target) throw new NotFoundException('Reply target not found');
      replyToId = new Types.ObjectId(replyTo);
      replyToSnapshot = {
        senderId: target.senderId,
        senderUsername: target.senderUsername,
        contentPreview: String(target.content || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, REPLY_PREVIEW_MAX),
      };
    }

    const created = await this.messageModel.create({
      senderId: new Types.ObjectId(userId),
      senderUsername: user.username || username,
      senderAvatar: user.avatar || null,
      roomId: roomId || 'general',
      content: trimmed,
      replyTo: replyToId,
      replyToSnapshot,
      reactions: [],
      isDeleted: false,
      editedAt: null,
    });

    return created.toObject();
  }

  async toggleReaction(
    userId: string,
    messageId: string,
    emoji: string,
    shouldAdd = true,
  ) {
    const message = await this.messageModel.findById(messageId).exec();
    if (!message) throw new NotFoundException('Message not found');

    const uid = String(userId);
    const idx = message.reactions.findIndex((r) => r.emoji === emoji);

    if (idx === -1 && shouldAdd) {
      message.reactions.push({
        emoji,
        userIds: [new Types.ObjectId(userId)],
        count: 1,
      } as any);
    } else if (idx >= 0) {
      const reaction = message.reactions[idx];
      const has = reaction.userIds.some((id) => String(id) === uid);
      if (shouldAdd && !has) reaction.userIds.push(new Types.ObjectId(userId));
      if (!shouldAdd && has)
        reaction.userIds = reaction.userIds.filter((id) => String(id) !== uid);
      if (!shouldAdd && !has) return message.toObject();
      if (!shouldAdd && reaction.userIds.length === 0) {
        message.reactions.splice(idx, 1);
      }
    }

    message.reactions = message.reactions.map((r) => ({
      ...r,
      count: r.userIds.length,
    })) as any;
    await message.save();
    return message.toObject();
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await this.messageModel.findById(messageId).exec();
    if (!message) throw new NotFoundException('Message not found');
    if (String(message.senderId) !== String(userId))
      throw new ForbiddenException('Not allowed');
    const trimmed = String(content || '').trim();
    if (!trimmed) throw new BadRequestException('Message cannot be empty');
    if (trimmed.length > 2000)
      throw new BadRequestException('Message too long');
    message.content = trimmed;
    message.editedAt = new Date();
    await message.save();
    return message.toObject();
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageModel.findById(messageId).exec();
    if (!message) throw new NotFoundException('Message not found');
    if (String(message.senderId) !== String(userId))
      throw new ForbiddenException('Not allowed');
    message.isDeleted = true;
    message.content = '';
    message.editedAt = new Date();
    message.reactions = [];
    await message.save();
    return message.toObject();
  }
}
