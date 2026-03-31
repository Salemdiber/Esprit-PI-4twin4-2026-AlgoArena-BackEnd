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

  async listPosts() {
    return this.postModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async createPost(dto: CreatePostDto, user: { userId: string; username: string }) {
    const title = dto.title.trim();
    const content = dto.content.trim();

    const created = await this.postModel.create({
      title,
      content,
      imageUrl: dto.imageUrl || null,
      videoUrl: dto.videoUrl || null,
      type: dto.type || 'normal',
      authorId: user.userId,
      authorUsername: user.username,
      comments: [],
    });

    return created.toObject();
  }

  async addComment(postId: string, dto: CreateCommentDto, user: { userId: string; username: string }) {
    this.ensureValidObjectId(postId);

    const text = dto.text.trim();
    const updated = await this.postModel
      .findByIdAndUpdate(
        postId,
        {
          $push: {
            comments: {
              authorId: user.userId,
              authorUsername: user.username,
              text,
              type: dto.type || 'discussion',
            },
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Post not found');
    }

    return updated;
  }

  async updatePost(postId: string, dto: UpdatePostDto, user: { userId: string; username: string }) {
    this.ensureValidObjectId(postId);

    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== user.userId) {
      throw new BadRequestException('You can only modify your own post');
    }

    if (dto.title !== undefined) {
      post.title = dto.title.trim();
    }

    if (dto.content !== undefined) {
      post.content = dto.content.trim();
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

    if (comment.authorId !== user.userId) {
      throw new BadRequestException('You can only modify your own comment');
    }

    if (dto.text !== undefined) {
      comment.text = dto.text.trim();
    }

    await post.save();
    return post.toObject();
  }
}
