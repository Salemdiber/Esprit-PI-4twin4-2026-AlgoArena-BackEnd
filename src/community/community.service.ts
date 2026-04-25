import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    @InjectModel('CommunityComment')
    private readonly commentModel: Model<any>,
  ) {}

  private ensureValidObjectId(id: string) {
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id) || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post id');
    }
  }

  private isAdmin(role?: string) {
    return String(role || '').toUpperCase() === 'ADMIN';
  }

  private buildCommentTree(flatComments: any[]) {
    const normalized = Array.isArray(flatComments)
      ? flatComments.map((comment) => ({
          ...(comment || {}),
          _id: String(comment?._id || ''),
          postId: String(comment?.postId || ''),
          parentCommentId: comment?.parentCommentId
            ? String(comment.parentCommentId)
            : null,
          replies: [],
        }))
      : [];

    const byId = new Map<string, any>();
    normalized.forEach((comment) => {
      if (comment?._id) byId.set(String(comment._id), comment);
    });

    const roots: any[] = [];
    normalized.forEach((comment) => {
      const parentId = comment?.parentCommentId
        ? String(comment.parentCommentId)
        : '';
      if (parentId && byId.has(parentId)) {
        const parent = byId.get(parentId);
        parent.replies = Array.isArray(parent.replies) ? parent.replies : [];
        parent.replies.push(comment);
      } else {
        roots.push(comment);
      }
    });

    const sortTree = (items: any[]) => {
      if (!Array.isArray(items)) return [];
      const sorted = [...items].sort((a, b) => {
        const aPinned = a?.pinned ? 1 : 0;
        const bPinned = b?.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        const aDate = new Date(a?.createdAt || 0).getTime();
        const bDate = new Date(b?.createdAt || 0).getTime();
        return bDate - aDate;
      });

      return sorted.map((item) => ({
        ...item,
        replies: sortTree(item?.replies || []),
      }));
    };

    return sortTree(roots);
  }

  private async migrateEmbeddedCommentsToCollection() {
    const posts = await this.postModel.find({}, { comments: 1 }).lean().exec();

    for (const post of posts as any[]) {
      const postId = String(post?._id || '');
      if (!postId) continue;

      const embedded = Array.isArray(post?.comments) ? post.comments : [];
      if (embedded.length === 0) continue;

      const alreadyMigrated = await this.commentModel.exists({ postId }).exec();
      if (alreadyMigrated) continue;

      const toInsert: any[] = [];

      const walk = (comments: any[], parentCommentId: string | null = null) => {
        if (!Array.isArray(comments)) return;

        comments.forEach((comment) => {
          const currentId = String(
            comment?._id || new Types.ObjectId().toString(),
          );

          toInsert.push({
            _id: currentId,
            postId,
            parentCommentId,
            authorId: String(comment?.authorId || ''),
            authorUsername: String(comment?.authorUsername || 'unknown'),
            authorAvatar: comment?.authorAvatar || null,
            text: String(comment?.text || ''),
            imageUrl: comment?.imageUrl || null,
            videoUrl: comment?.videoUrl || null,
            pinned: Boolean(comment?.pinned),
            pinnedAt: comment?.pinnedAt || null,
            createdAt: comment?.createdAt || new Date(),
            updatedAt: comment?.updatedAt || new Date(),
          });

          walk(comment?.replies || [], currentId);
        });
      };

      walk(embedded);

      if (toInsert.length > 0) {
        await this.commentModel
          .insertMany(toInsert, { ordered: false })
          .catch(() => undefined);
      }
    }
  }

  private async getPostWithComments(postId: string) {
    const post = (await this.postModel.findById(postId).lean().exec()) as any;
    if (!post) throw new NotFoundException('Post not found');

    const flatComments = await this.commentModel
      .find({ postId: String(postId) })
      .lean()
      .exec();
    return {
      ...post,
      comments: this.buildCommentTree(flatComments),
    };
  }

  private buildLegacySeedPosts() {
    const now = Date.now();
    return [
      {
        title: 'React state is not updating in my challenge form',
        content:
          'My input values lag behind after submit. Any clean approach for stable state updates?',
        type: 'problem',
        problemType: 'bug',
        tags: ['react', 'state', 'form'],
        imageUrl: null,
        videoUrl: null,
        authorId: 'u-lina',
        authorUsername: 'lina',
        authorAvatar: null,
        createdAt: new Date(now - 1000 * 60 * 60 * 8),
        updatedAt: new Date(now - 1000 * 60 * 60 * 8),
        pinned: false,
        solved: false,
        comments: [
          {
            authorId: 'u-omar',
            authorUsername: 'omar',
            authorAvatar: null,
            text: 'I hit the same issue with state updates not batching as expected.',
            imageUrl: null,
            videoUrl: null,
            pinned: false,
            replies: [],
            createdAt: new Date(now - 1000 * 60 * 60 * 5),
            updatedAt: new Date(now - 1000 * 60 * 60 * 5),
          },
        ],
      },
      {
        title: 'API authorization keeps failing after reload',
        content:
          'Calls work after login but fail after refreshing the page. How should I persist auth?',
        type: 'normal',
        tags: ['api', 'auth', 'token'],
        imageUrl: null,
        videoUrl: null,
        authorId: 'u-omar',
        authorUsername: 'omar',
        authorAvatar: null,
        createdAt: new Date(now - 1000 * 60 * 60 * 4),
        updatedAt: new Date(now - 1000 * 60 * 60 * 4),
        pinned: false,
        solved: false,
        comments: [
          {
            authorId: 'u-lina',
            authorUsername: 'lina',
            authorAvatar: null,
            text: 'The auth token is missing on refresh, maybe persisted state issue.',
            imageUrl: null,
            videoUrl: null,
            pinned: false,
            replies: [],
            createdAt: new Date(now - 1000 * 60 * 60 * 2),
            updatedAt: new Date(now - 1000 * 60 * 60 * 2),
          },
        ],
      },
    ];
  }

  async restoreLegacyPostsIfMissing() {
    const seedPosts = this.buildLegacySeedPosts();

    for (const seed of seedPosts) {
      const exists = await this.postModel
        .exists({ title: seed.title, authorUsername: seed.authorUsername })
        .exec();

      if (exists) continue;

      await this.postModel.create(seed);
    }
  }

  async listPosts() {
    await this.restoreLegacyPostsIfMissing();
    await this.migrateEmbeddedCommentsToCollection();

    const posts = (await this.postModel
      .find()
      .sort({ pinned: -1, pinnedAt: -1, createdAt: -1 })
      .lean()
      .exec()) as any[];

    if (posts.length === 0) return [];

    const postIds = posts
      .map((post) => String(post?._id || ''))
      .filter(Boolean);
    const flatComments = await this.commentModel
      .find({ postId: { $in: postIds } })
      .lean()
      .exec();

    const commentsByPostId = new Map<string, any[]>();
    flatComments.forEach((comment: any) => {
      const key = String(comment?.postId || '');
      if (!commentsByPostId.has(key)) commentsByPostId.set(key, []);
      commentsByPostId.get(key)?.push(comment);
    });

    return posts.map((post) => {
      const key = String(post?._id || '');
      const postComments = commentsByPostId.get(key) || [];
      return {
        ...post,
        comments: this.buildCommentTree(postComments),
      };
    });
  }

  async listComments(postId?: string) {
    if (postId) {
      this.ensureValidObjectId(postId);
      const postExists = await this.postModel.exists({ _id: postId }).exec();
      if (!postExists) throw new NotFoundException('Post not found');

      return this.commentModel
        .find({ postId: String(postId) })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
    }

    return this.commentModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async createPost(
    dto: CreatePostDto,
    user: { userId: string; username: string; avatar?: string },
  ) {
    const title = dto.title.trim();
    const content = dto.content.trim();

    const created = await this.postModel.create({
      title,
      content,
      imageUrl: dto.imageUrl || null,
      videoUrl: dto.videoUrl || null,
      type: dto.type || 'normal',
      tags: Array.isArray(dto.tags)
        ? dto.tags
            .filter(Boolean)
            .map((t) => String(t).trim().toLowerCase())
            .slice(0, 8)
        : [],
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

  async addComment(
    postId: string,
    dto: CreateCommentDto,
    user: { userId: string; username: string; avatar?: string },
  ) {
    this.ensureValidObjectId(postId);

    const text = dto.text.trim();
    const postExists = await this.postModel.exists({ _id: postId }).exec();
    if (!postExists) throw new NotFoundException('Post not found');

    let normalizedParentCommentId: string | null = null;
    if (dto.parentCommentId) {
      this.ensureValidObjectId(dto.parentCommentId);
      const parentExists = await this.commentModel
        .exists({ _id: dto.parentCommentId, postId: String(postId) })
        .exec();
      if (!parentExists) {
        throw new NotFoundException('Parent comment not found');
      }
      normalizedParentCommentId = String(dto.parentCommentId);
    }

    await this.commentModel.create({
      postId: String(postId),
      parentCommentId: normalizedParentCommentId,
      authorId: user.userId,
      authorUsername: user.username,
      authorAvatar: user.avatar || null,
      text,
      imageUrl: dto.imageUrl || null,
      videoUrl: dto.videoUrl || null,
      pinned: false,
      pinnedAt: null,
    });

    return this.getPostWithComments(postId);
  }

  async addCommentAndReturnSaved(
    postId: string,
    dto: CreateCommentDto,
    user: { userId: string; username: string; avatar?: string },
  ) {
    this.ensureValidObjectId(postId);

    const text = dto.text.trim();
    const postExists = await this.postModel.exists({ _id: postId }).exec();
    if (!postExists) throw new NotFoundException('Post not found');

    let normalizedParentCommentId: string | null = null;
    if (dto.parentCommentId) {
      this.ensureValidObjectId(dto.parentCommentId);
      const parentExists = await this.commentModel
        .exists({ _id: dto.parentCommentId, postId: String(postId) })
        .exec();
      if (!parentExists) {
        throw new NotFoundException('Parent comment not found');
      }
      normalizedParentCommentId = String(dto.parentCommentId);
    }

    const createdComment = await this.commentModel.create({
      postId: String(postId),
      parentCommentId: normalizedParentCommentId,
      authorId: user.userId,
      authorUsername: user.username,
      authorAvatar: user.avatar || null,
      text,
      imageUrl: dto.imageUrl || null,
      videoUrl: dto.videoUrl || null,
      pinned: false,
      pinnedAt: null,
    });

    return {
      ...(createdComment?.toObject
        ? createdComment.toObject()
        : createdComment),
      postId,
      parentCommentId: normalizedParentCommentId,
    };
  }

  async updatePost(
    postId: string,
    dto: UpdatePostDto,
    user: { userId: string; username: string },
  ) {
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
        ? dto.tags
            .filter(Boolean)
            .map((t) => String(t).trim().toLowerCase())
            .slice(0, 8)
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

    const postExists = await this.postModel.exists({ _id: postId }).exec();
    if (!postExists) throw new NotFoundException('Post not found');

    const comment = await this.commentModel
      .findOne({ _id: commentId, postId: String(postId) })
      .exec();
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

    await comment.save();
    return this.getPostWithComments(postId);
  }

  async deletePost(postId: string, user: { userId: string; role?: string }) {
    this.ensureValidObjectId(postId);
    const post = await this.postModel.findById(postId).exec();
    if (!post) throw new NotFoundException('Post not found');

    if (
      String(post.authorId) !== String(user.userId) &&
      !this.isAdmin(user.role)
    ) {
      throw new BadRequestException('You can only delete your own post');
    }

    await this.postModel.deleteOne({ _id: postId }).exec();
    await this.commentModel.deleteMany({ postId: String(postId) }).exec();
    return { ok: true };
  }

  async deleteComment(
    postId: string,
    commentId: string,
    user: { userId: string; role?: string },
  ) {
    this.ensureValidObjectId(postId);
    this.ensureValidObjectId(commentId);

    const postExists = await this.postModel.exists({ _id: postId }).exec();
    if (!postExists) throw new NotFoundException('Post not found');

    const targetComment: any = await this.commentModel
      .findOne({ _id: commentId, postId: String(postId) })
      .lean()
      .exec();

    if (!targetComment) throw new NotFoundException('Comment not found');

    if (
      String(targetComment.authorId) !== String(user.userId) &&
      !this.isAdmin(user.role)
    ) {
      throw new BadRequestException('You can only delete your own comment');
    }

    const postComments = await this.commentModel
      .find({ postId: String(postId) }, { _id: 1, parentCommentId: 1 })
      .lean()
      .exec();

    const childrenByParent = new Map<string, string[]>();
    postComments.forEach((comment: any) => {
      const parentKey = String(comment?.parentCommentId || '');
      const currentId = String(comment?._id || '');
      if (!parentKey || !currentId) return;
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
      childrenByParent.get(parentKey)?.push(currentId);
    });

    const toDelete = new Set<string>([String(commentId)]);
    const stack = [String(commentId)];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      const children = childrenByParent.get(current) || [];
      children.forEach((childId) => {
        if (!toDelete.has(childId)) {
          toDelete.add(childId);
          stack.push(childId);
        }
      });
    }

    await this.commentModel
      .deleteMany({
        _id: { $in: [...toDelete] },
        postId: String(postId),
      })
      .exec();

    return this.getPostWithComments(postId);
  }
}
