import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';

const communityUploadDir = join(process.cwd(), 'uploads', 'community');

const ensureUploadDir = () => {
  if (!existsSync(communityUploadDir)) {
    mkdirSync(communityUploadDir, { recursive: true });
  }
};

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async writeAudit(entry: {
    actionType: string;
    actor: string;
    actorId?: string;
    targetId?: string | null;
    targetLabel?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.auditLogService.create({
        actionType: entry.actionType,
        actor: entry.actor,
        actorId: entry.actorId || null,
        entityType: 'community',
        targetId: entry.targetId || null,
        targetLabel: entry.targetLabel || null,
        description: entry.description,
        metadata: entry.metadata || {},
      } as any);
    } catch {
      // Audit logging is best effort and must not break API calls.
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, communityUploadDir);
        },
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || '').toLowerCase();
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `community-${unique}${safeExt}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const isImage = file.mimetype?.startsWith('image/');
        const isVideo = file.mimetype?.startsWith('video/');
        if (!isImage && !isVideo) {
          return cb(new BadRequestException('Only image or video files are allowed') as any, false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadMedia(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const relativePath = `/uploads/community/${file.filename}`;

    const result = {
      url: relativePath,
      absoluteUrl: `${protocol}://${host}${relativePath}`,
      mimetype: file.mimetype,
      size: file.size,
    };

    await this.writeAudit({
      actionType: 'COMMUNITY_MEDIA_UPLOADED',
      actor: 'system',
      description: 'Community media uploaded',
      metadata: {
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
    });

    return result;
  }

  @Get('posts')
  async listPosts() {
    return this.communityService.listPosts();
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  async createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: { userId: string; username: string; avatar?: string; role?: string },
  ) {
    const created = await this.communityService.createPost(dto, user);
    await this.writeAudit({
      actionType: 'COMMUNITY_POST_CREATED',
      actor: user.username,
      actorId: user.userId,
      targetId: created?._id ? String(created._id) : null,
      targetLabel: created?.title ? String(created.title) : 'Community post',
      description: `${user.username} created a community post`,
      metadata: {
        type: created?.type || 'normal',
        tagsCount: Array.isArray(created?.tags) ? created.tags.length : 0,
      },
    });
    return created;
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/comments')
  async addComment(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { userId: string; username: string; avatar?: string; role?: string },
  ) {
    const updated = await this.communityService.addComment(postId, dto, user);
    await this.writeAudit({
      actionType: 'COMMUNITY_COMMENT_ADDED',
      actor: user.username,
      actorId: user.userId,
      targetId: postId,
      targetLabel: updated?.title ? String(updated.title) : 'Community post',
      description: `${user.username} added a comment`,
      metadata: {
        postId,
        isReply: Boolean(dto?.parentCommentId),
      },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId')
  async updatePost(
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    const updated = await this.communityService.updatePost(postId, dto, user);
    await this.writeAudit({
      actionType: 'COMMUNITY_POST_UPDATED',
      actor: user.username,
      actorId: user.userId,
      targetId: postId,
      targetLabel: updated?.title ? String(updated.title) : 'Community post',
      description: `${user.username} updated a community post`,
      metadata: {
        postId,
        fields: Object.keys(dto || {}),
      },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/comments/:commentId')
  async updateComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    const updated = await this.communityService.updateComment(
      postId,
      commentId,
      dto,
      user,
    );
    await this.writeAudit({
      actionType: 'COMMUNITY_COMMENT_UPDATED',
      actor: user.username,
      actorId: user.userId,
      targetId: commentId,
      targetLabel: `Comment ${commentId}`,
      description: `${user.username} updated a community comment`,
      metadata: {
        postId,
        commentId,
        fields: Object.keys(dto || {}),
      },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId')
  async deletePost(
    @Param('postId') postId: string,
    @CurrentUser() user: { userId: string; role?: string },
  ) {
    const result = await this.communityService.deletePost(postId, user);
    await this.writeAudit({
      actionType: 'COMMUNITY_POST_DELETED',
      actor: user.userId,
      actorId: user.userId,
      targetId: postId,
      targetLabel: `Post ${postId}`,
      description: `User ${user.userId} deleted a community post`,
      metadata: { postId },
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/comments/:commentId')
  async deleteComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: { userId: string; role?: string },
  ) {
    const result = await this.communityService.deleteComment(postId, commentId, user);
    await this.writeAudit({
      actionType: 'COMMUNITY_COMMENT_DELETED',
      actor: user.userId,
      actorId: user.userId,
      targetId: commentId,
      targetLabel: `Comment ${commentId}`,
      description: `User ${user.userId} deleted a community comment`,
      metadata: { postId, commentId },
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/solve')
  async toggleSolved(
    @Param('postId') postId: string,
    @Body() dto: { solved?: boolean },
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    const updated = await this.communityService.updatePost(
      postId,
      { solved: Boolean(dto?.solved) },
      user,
    );
    await this.writeAudit({
      actionType: 'COMMUNITY_POST_SOLVED_TOGGLED',
      actor: user.username,
      actorId: user.userId,
      targetId: postId,
      targetLabel: updated?.title ? String(updated.title) : `Post ${postId}`,
      description: `${user.username} updated solved status on a community post`,
      metadata: { postId, solved: Boolean(dto?.solved) },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/pin')
  async togglePostPin(
    @Param('postId') postId: string,
    @Body() dto: { pinned?: boolean },
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    const updated = await this.communityService.updatePost(
      postId,
      { pinned: Boolean(dto?.pinned) },
      user,
    );
    await this.writeAudit({
      actionType: 'COMMUNITY_POST_PINNED_TOGGLED',
      actor: user.username,
      actorId: user.userId,
      targetId: postId,
      targetLabel: updated?.title ? String(updated.title) : `Post ${postId}`,
      description: `${user.username} updated pinned status on a community post`,
      metadata: { postId, pinned: Boolean(dto?.pinned) },
    });
    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/comments/:commentId/pin')
  async toggleCommentPin(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: { pinned?: boolean },
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    const updated = await this.communityService.updateComment(
      postId,
      commentId,
      { pinned: Boolean(dto?.pinned) },
      user,
    );
    await this.writeAudit({
      actionType: 'COMMUNITY_COMMENT_PINNED_TOGGLED',
      actor: user.username,
      actorId: user.userId,
      targetId: commentId,
      targetLabel: `Comment ${commentId}`,
      description: `${user.username} updated pinned status on a community comment`,
      metadata: { postId, commentId, pinned: Boolean(dto?.pinned) },
    });
    return updated;
  }
}
