import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel('CommunityPost')
    private readonly postModel: Model<any>,
  ) { }

  private ensureValidObjectId(id: string) {
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id) || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post id');
    }
  }

  private isAdmin(role?: string) {
    return String(role || '').toUpperCase() === 'ADMIN';
  }

  private findCommentById(comments: any[], commentId: string): any | null {
    if (!Array.isArray(comments)) return null;

    for (const comment of comments) {
      if (String(comment?._id) === String(commentId)) {
        return comment;
      }
      const nested = this.findCommentById(comment?.replies || [], commentId);
      if (nested) return nested;
    }

    return null;
  }

  async listPosts() {
    return this.postModel.find().sort({ pinned: -1, pinnedAt: -1, createdAt: -1 }).lean().exec();
  }

  async createPost(dto: CreatePostDto, user: { userId: string; username: string; avatar?: string }) {
    const title = dto.title.trim();
    const content = dto.content.trim();

    const created = await this.postModel.create({
      title,
      content,
      imageUrl: dto.imageUrl || null,
      videoUrl: dto.videoUrl || null,
      type: dto.type || 'normal',
      tags: Array.isArray(dto.tags) ? dto.tags.filter(Boolean).map((t) => String(t).trim().toLowerCase()).slice(0, 8) : [],
      problemType: dto.problemType || null,
      solved: false,
      solvedAt: null,
      pinned: false,
      pinnedAt: null,
      authorId: user.userId,
      authorUsername: user.username,
      authorAvatar: user.avatar || null,
      comments: [],
    });

    return created.toObject();
  }

  async addComment(postId: string, dto: CreateCommentDto, user: { userId: string; username: string; avatar?: string }) {
    this.ensureValidObjectId(postId);

    const text = dto.text.trim();
    const post = await this.postModel.findById(postId).exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const commentPayload = {
      authorId: user.userId,
      authorUsername: user.username,
      authorAvatar: user.avatar || null,
      text,
      imageUrl: dto.imageUrl || null,
      videoUrl: dto.videoUrl || null,
      replies: [],
    };

    if (dto.parentCommentId) {
      this.ensureValidObjectId(dto.parentCommentId);
      const parent = this.findCommentById(post.comments || [], dto.parentCommentId);
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }
      parent.replies = parent.replies || [];
      parent.replies.push(commentPayload);
    } else {
      post.comments.push(commentPayload);
    }

    await post.save();

    return post.toObject();
  }

  async updatePost(postId: string, dto: UpdatePostDto, user: { userId: string; username: string }) {
    this.ensureValidObjectId(postId);

    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== user.userId && !this.isAdmin((user as any).role)) {
      throw new BadRequestException('You can only modify your own post');
    }

    if (dto.title !== undefined) {
      post.title = dto.title.trim();
    }

    if (dto.content !== undefined) {
      post.content = dto.content.trim();
    }

    if (dto.tags !== undefined) {
      post.tags = Array.isArray(dto.tags)
        ? dto.tags.filter(Boolean).map((t) => String(t).trim().toLowerCase()).slice(0, 8)
        : [];
    }

    if (dto.problemType !== undefined) {
      post.problemType = dto.problemType || null;
    }

    if (dto.solved !== undefined) {
      post.solved = Boolean(dto.solved);
      post.solvedAt = post.solved ? new Date() : null;
    }

    if (dto.pinned !== undefined) {
      if (!this.isAdmin((user as any).role)) {
        throw new BadRequestException('Only admins can pin posts');
      }
      post.pinned = Boolean(dto.pinned);
      post.pinnedAt = post.pinned ? new Date() : null;
    }

    await post.save();
    return post.toObject();
  }

  async updateComment(
    postId: string,
    commentId: string,
    dto: UpdateCommentDto,
    user: { userId: string; username: string },
  ) {
    this.ensureValidObjectId(postId);
    this.ensureValidObjectId(commentId);

    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = post.comments?.id(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== user.userId && !this.isAdmin((user as any).role)) {
      throw new BadRequestException('You can only modify your own comment');
    }

    if (dto.text !== undefined) {
      comment.text = dto.text.trim();
    }

    if (dto.pinned !== undefined) {
      if (!this.isAdmin((user as any).role)) {
        throw new BadRequestException('Only admins can pin comments');
      }
      comment.pinned = Boolean(dto.pinned);
      comment.pinnedAt = comment.pinned ? new Date() : null;
    }

    await post.save();
    return post.toObject();
  }

  async deletePost(postId: string, user: { userId: string; role?: string }) {
    this.ensureValidObjectId(postId);
    const post = await this.postModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found');

    if (String(post.authorId) !== String(user.userId) && !this.isAdmin(user.role)) {
      throw new BadRequestException('You can only delete your own post');
    }

    await this.postModel.deleteOne({ _id: postId }).exec();
    return { ok: true };
  }

  async deleteComment(postId: string, commentId: string, user: { userId: string; role?: string }) {
    this.ensureValidObjectId(postId);
    this.ensureValidObjectId(commentId);

    const post = await this.postModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found');

    const removeRecursively = (comments: any[]): boolean => {
      if (!Array.isArray(comments)) return false;
      for (let i = 0; i < comments.length; i += 1) {
        const item = comments[i];
        if (String(item?._id) === String(commentId)) {
          if (String(item.authorId) !== String(user.userId) && !this.isAdmin(user.role)) {
            throw new BadRequestException('You can only delete your own comment');
          }
          comments.splice(i, 1);
          return true;
        }
        if (removeRecursively(item?.replies || [])) return true;
      }
      return false;
    };

    const removed = removeRecursively(post.comments || []);
    if (!removed) throw new NotFoundException('Comment not found');

    await post.save();
    return post.toObject();
  }
}
